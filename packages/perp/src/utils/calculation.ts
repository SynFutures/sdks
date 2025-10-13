import { fromWad } from '@derivation-tech/context';
import { PERP_EXPIRY, ONE_RATIO, ORDER_SPACING, EMPTY_AMM, PEARL_SPACING } from '../constants';
import { ONE, ZERO, Q96, r2w, sqrtX96ToWad, TickMath, SqrtPriceMath, WAD, wdiv, wmul, wmulDown, wmulUp } from '../math';
import { RawOrder, RawPosition, RawRange, RawAmm, Instrument, Position, Amm, Range, Order } from '../types';
import { FeederType, Side } from '../enum';
import { RANGE_SPACING } from '../constants';
import {
    reverseAmm,
    reverseInstrument,
    reverseOrder,
    reversePosition,
    reversePrice,
    reverseRange,
    reverseSide,
} from './reverse';
import { createPosition } from './factory';
import { alphaWadToTickDelta } from './utils';
import {
    calcLiquidationPrice,
    calcPnl,
    calcFundingFee,
    tally,
    withinOrderLimit,
    withinDeviationLimit,
    entryDelta,
} from '../math/perpMath';
import { SynfError } from '../errors/synfError';

//////////////////////////////////////////
// Inverse Functions
//////////////////////////////////////////

function toRawPosition(position: RawPosition | Position): RawPosition {
    if ('instrumentAddr' in position) {
        const _position = position as Position;
        return _position.isInverse ? reversePosition(_position) : _position;
    } else {
        return position;
    }
}

function toRawAmm(amm: RawAmm | Amm): RawAmm {
    if ('instrumentAddr' in amm) {
        const _amm = amm as Amm;
        return _amm.isInverse ? reverseAmm(_amm) : _amm;
    } else {
        return amm;
    }
}

function toRawRange(range: RawRange | Range): RawRange {
    if ('instrumentAddr' in range) {
        const _range = range as Range;
        return _range.isInverse ? reverseRange(_range) : _range;
    } else {
        return range;
    }
}

function toRawOrder(order: RawOrder | Order): RawOrder {
    if ('instrumentAddr' in order) {
        const _order = order as Order;
        return _order.isInverse ? reverseOrder(_order) : _order;
    } else {
        return order;
    }
}

//////////////////////////////////////////
// RawPosition Calculation Interface
//////////////////////////////////////////

export function positionLiquidationPrice(
    position: RawPosition | Position,
    amm: RawAmm | Amm = EMPTY_AMM,
    maintenanceMarginRatio = 500,
): bigint {
    const _position: any = position;

    position = toRawPosition(position);
    amm = toRawAmm(amm);

    if (position.size === 0n || position.balance === 0n) {
        return ZERO;
    }

    const price = calcLiquidationPrice(amm, position, maintenanceMarginRatio);

    return _position.isInverse ? reversePrice(price) : price;
}

export function positionUnrealizedSocialLoss(position: RawPosition | Position, amm: RawAmm | Amm): bigint {
    position = toRawPosition(position);
    amm = toRawAmm(amm);

    const { socialLoss } = tally(amm, position, amm.markPrice);

    return socialLoss;
}

export function positionUnrealizedPnl(position: RawPosition | Position, amm: RawAmm | Amm): bigint {
    position = toRawPosition(position);
    amm = toRawAmm(amm);

    return calcPnl(amm, position, amm.markPrice);
}

export function positionUnrealizedPnlByFairPrice(position: RawPosition | Position, amm: RawAmm | Amm): bigint {
    position = toRawPosition(position);
    amm = toRawAmm(amm);

    return calcPnl(amm, position, sqrtX96ToWad(amm.sqrtPX96));
}

export function positionUnrealizedFundingFee(position: RawPosition | Position, amm: RawAmm | Amm): bigint {
    if (amm.expiry !== PERP_EXPIRY) {
        return ZERO;
    }

    position = toRawPosition(position);
    amm = toRawAmm(amm);

    return calcFundingFee(amm, position);
}

export function positionEquity(position: RawPosition | Position, amm: RawAmm | Amm): bigint {
    position = toRawPosition(position);
    amm = toRawAmm(amm);

    return position.balance + positionUnrealizedPnl(position, amm);
}

export function positionLeverage(position: RawPosition | Position, amm: RawAmm | Amm): bigint {
    position = toRawPosition(position);
    amm = toRawAmm(amm);

    const value = wmul(amm.markPrice, position.size < 0n ? -position.size : position.size);
    const equity = positionEquity(position, amm);
    if (equity === 0n) {
        return ZERO;
    }

    return wdiv(value, equity);
}

export function positionMaxWithdrawableMargin(
    position: RawPosition | Position,
    amm: RawAmm | Amm,
    initialMarginRatio: number,
): bigint {
    position = toRawPosition(position);
    amm = toRawAmm(amm);

    const { pnl, socialLoss } = tally(amm, position, amm.markPrice);
    const funding = calcFundingFee(amm, position);

    const purePnl = pnl + socialLoss - funding;
    const unrealizedLoss = (purePnl > 0n ? 0n : purePnl) - socialLoss;

    const value = wmulUp(amm.markPrice, position.size < 0n ? -position.size : position.size);
    const imRequirement = wmulUp(value, r2w(BigInt(initialMarginRatio)));
    const maxWithdrawableMargin = position.balance + unrealizedLoss - imRequirement;
    return maxWithdrawableMargin > 0n ? maxWithdrawableMargin : 0n;
}

export function positionAdditionMarginToIMRSafe(
    position: RawPosition | Position,
    amm: RawAmm | Amm,
    initialMarginRatio: number,
    increase: boolean,
    slippage?: number,
): bigint {
    position = toRawPosition(position);
    amm = toRawAmm(amm);

    const positionValue = wmul(amm.markPrice, position.size < 0n ? -position.size : position.size);
    let imrValue = wmulUp(positionValue, r2w(BigInt(initialMarginRatio)));
    if (slippage) {
        imrValue = (imrValue * BigInt(ONE_RATIO + slippage)) / BigInt(ONE_RATIO);
    }
    let equity;
    if (increase) {
        const unrealizedPnl = positionUnrealizedPnl(position, amm);
        const unrealizedLoss = unrealizedPnl < 0n ? unrealizedPnl : 0n;
        equity = position.balance + unrealizedLoss;
    } else {
        equity = positionEquity(position, amm);
    }
    const additionMargin = imrValue - equity;
    return additionMargin > 0n ? additionMargin : 0n;
}

export function isPositionIMSafe(
    position: RawPosition | Position,
    amm: RawAmm | Amm,
    initialMarginRatio: number,
    increase: boolean,
): boolean {
    position = toRawPosition(position);
    amm = toRawAmm(amm);

    let equity: bigint;
    if (increase) {
        const unrealizedPnl = positionUnrealizedPnl(position, amm);
        const unrealizedLoss = unrealizedPnl < 0n ? unrealizedPnl : 0n;
        equity = position.balance + unrealizedLoss;
    } else {
        equity = positionEquity(position, amm);
    }

    if (equity < 0n) {
        return false;
    }

    const positionValue = wmulUp(amm.markPrice, position.size < 0n ? -position.size : position.size);
    return equity >= wmulUp(positionValue, r2w(BigInt(initialMarginRatio)));
}

export function isPositionMMSafe(position: RawPosition | Position, amm: RawAmm | Amm, maintenanceMarginRatio: number) {
    position = toRawPosition(position);
    amm = toRawAmm(amm);

    const equity = positionEquity(position, amm);

    if (equity < 0n) {
        return false;
    }

    const positionValue = wmulUp(amm.markPrice, position.size < 0n ? -position.size : position.size);
    return equity >= wmulUp(positionValue, r2w(BigInt(maintenanceMarginRatio)));
}

//////////////////////////////////////////
// RawRange Calculation Interface
//////////////////////////////////////////

export function rangeEntryDeltaBase(range: RawRange | Range): bigint {
    range = toRawRange(range);

    const sqrtUpperPX96 = TickMath.getSqrtRatioAtTick(range.tickUpper);
    return SqrtPriceMath.getDeltaBaseAutoRoundUp(range.sqrtEntryPX96, sqrtUpperPX96, range.liquidity);
}

export function rangeEntryDeltaQuote(range: RawRange | Range): bigint {
    range = toRawRange(range);

    const sqrtLowerPX96 = TickMath.getSqrtRatioAtTick(range.tickLower);
    return SqrtPriceMath.getDeltaQuoteAutoRoundUp(sqrtLowerPX96, range.sqrtEntryPX96, range.liquidity);
}

export function rangeToPosition(range: Range, amm: Amm | RawAmm): Position;
export function rangeToPosition(range: RawRange, amm: Amm | RawAmm): RawPosition;
export function rangeToPosition(range: RawRange | Range, amm: RawAmm | Amm): RawPosition | Position {
    const _range = range;

    range = toRawRange(range);
    amm = toRawAmm(amm);

    const sqrtUpperPX96 = TickMath.getSqrtRatioAtTick(range.tickUpper);
    const sqrtLowerPX96 = TickMath.getSqrtRatioAtTick(range.tickLower);
    const fair = sqrtX96ToWad(amm.sqrtPX96);
    const entryDeltaBase = rangeEntryDeltaBase(range);
    const entryDeltaQuote = rangeEntryDeltaQuote(range);

    let removeDeltaBase = ZERO;
    let removeDeltaQuote = ZERO;

    if (amm.tick < range.tickLower) {
        removeDeltaBase = SqrtPriceMath.getDeltaBaseAutoRoundUp(
            sqrtLowerPX96,
            TickMath.getSqrtRatioAtTick(range.tickUpper),
            range.liquidity,
        );
    } else if (amm.tick < range.tickUpper) {
        removeDeltaBase = SqrtPriceMath.getDeltaBaseAutoRoundUp(
            amm.sqrtPX96,
            TickMath.getSqrtRatioAtTick(range.tickUpper),
            range.liquidity,
        );
        removeDeltaQuote = SqrtPriceMath.getDeltaQuoteAutoRoundUp(sqrtLowerPX96, amm.sqrtPX96, range.liquidity);
    } else {
        removeDeltaQuote = SqrtPriceMath.getDeltaQuoteAutoRoundUp(sqrtLowerPX96, sqrtUpperPX96, range.liquidity);
    }

    // cal pnl
    const earnedByBase = wmul(removeDeltaBase - entryDeltaBase, fair);
    const earnedByQuote = removeDeltaQuote - entryDeltaQuote;
    const pnl = earnedByBase + earnedByQuote;
    const fee = wmulDown(amm.feeIndex - range.entryFeeIndex, range.liquidity);
    const size = removeDeltaBase - entryDeltaBase;
    const rawPosition = {
        balance: range.balance + fee + pnl - ONE,
        size: size,
        entryNotional: wmul(fair, size < 0n ? -size : size),
        entrySocialLossIndex: size > 0n ? amm.longSocialLossIndex : amm.shortSocialLossIndex,
        entryFundingIndex: size > 0n ? amm.longFundingIndex : amm.shortFundingIndex,
    };

    if ('instrumentAddr' in _range) {
        const __range = _range as Range;

        const position = createPosition({
            instrumentAddr: __range.instrumentAddr,
            expiry: __range.expiry,
            traderAddr: __range.traderAddr,
            ...rawPosition,
        });

        return __range.isInverse ? reversePosition(position) : position;
    } else {
        return rawPosition;
    }
}

export function rangeValueLocked(range: RawRange | Range, amm: RawAmm | Amm): bigint {
    range = toRawRange(range);
    amm = toRawAmm(amm);

    const position = rangeToPosition(range, amm);
    const total = tally(amm, position, amm.markPrice);
    return total.equity;
}

export function rangeFeeEarned(range: RawRange | Range, amm: RawAmm | Amm): bigint {
    range = toRawRange(range);
    amm = toRawAmm(amm);

    return wmulDown(amm.feeIndex - range.entryFeeIndex, range.liquidity);
}

function customAmm(tick: number, input: RawAmm): RawAmm {
    return {
        ...input,
        tick,
        sqrtPX96: TickMath.getSqrtRatioAtTick(tick),
    };
}

export function rangeLowerPositionIfRemove(range: Range, amm: RawAmm | Amm): Position;
export function rangeLowerPositionIfRemove(range: RawRange, amm: RawAmm | Amm): RawPosition;
export function rangeLowerPositionIfRemove(range: RawRange | Range, amm: RawAmm | Amm): RawPosition | Position {
    const _range = range;

    range = toRawRange(range);
    amm = toRawAmm(amm);

    const rawPosition = rangeToPosition(range, customAmm(range.tickLower, amm));

    if ('instrumentAddr' in _range) {
        const __range = _range as Range;

        const position = createPosition({
            instrumentAddr: __range.instrumentAddr,
            expiry: __range.expiry,
            traderAddr: __range.traderAddr,
            ...rawPosition,
        });

        return __range.isInverse ? reversePosition(position) : position;
    } else {
        return rawPosition;
    }
}

export function rangeUpperPositionIfRemove(range: Range, amm: RawAmm | Amm): Position;
export function rangeUpperPositionIfRemove(range: RawRange, amm: RawAmm | Amm): RawPosition;
export function rangeUpperPositionIfRemove(range: RawRange | Range, amm: RawAmm | Amm): RawPosition | Position {
    const _range = range;

    range = toRawRange(range);
    amm = toRawAmm(amm);

    const rawPosition = rangeToPosition(range, customAmm(range.tickUpper, amm));

    if ('instrumentAddr' in _range) {
        const __range = _range as Range;

        const position = createPosition({
            instrumentAddr: __range.instrumentAddr,
            expiry: __range.expiry,
            traderAddr: __range.traderAddr,
            ...rawPosition,
        });

        return __range.isInverse ? reversePosition(position) : position;
    } else {
        return rawPosition;
    }
}

//////////////////////////////////////////
// RawOrder Calculation Interface
//////////////////////////////////////////

export function orderToPosition(order: Order): Position;
export function orderToPosition(order: RawOrder): RawPosition;
export function orderToPosition(order: RawOrder | Order): RawPosition | Position {
    const _order = order;

    order = toRawOrder(order);

    const rawPosition = {
        balance: order.balance,
        size: order.size,
        entryNotional: wmul(TickMath.getWadAtTick(order.tick), order.size < 0n ? -order.size : order.size),
        entrySocialLossIndex: ZERO,
        entryFundingIndex: ZERO,
    };

    if ('instrumentAddr' in _order) {
        const __order = _order as Order;

        const position = createPosition({
            instrumentAddr: __order.instrumentAddr,
            expiry: __order.expiry,
            traderAddr: __order.traderAddr,
            ...rawPosition,
        });

        return __order.isInverse ? reversePosition(position) : position;
    } else {
        return rawPosition;
    }
}

export function orderLeverage(order: RawOrder | Order, amm: RawAmm | Amm): bigint {
    order = toRawOrder(order);
    amm = toRawAmm(amm);

    const limitPrice = TickMath.getWadAtTick(order.tick);
    const px = order.taken === 0n ? limitPrice : amm.markPrice;
    const value = wmul(px, order.size < 0n ? -order.size : order.size);
    return wdiv(value, order.balance);
}

export function orderEquity(order: RawOrder | Order, amm: RawAmm | Amm): bigint {
    order = toRawOrder(order);
    amm = toRawAmm(amm);

    return positionEquity(orderToPosition(order), amm);
}

//////////////////////////////////////////
// RawAmm Calculation Interface
//////////////////////////////////////////

export function ammPlaceOrderLimit(
    amm: RawAmm | Amm,
    initialMarginRatio: number,
): {
    upperTick: number;
    lowerTick: number;
} {
    const _amm: any = amm;

    amm = toRawAmm(amm);

    const maxDiff = wmul(amm.markPrice, r2w(BigInt(initialMarginRatio))) * 2n;
    const rawUpperTick = TickMath.getTickAtPWad(amm.markPrice + maxDiff);
    const rawLowerTick = TickMath.getTickAtPWad(amm.markPrice - maxDiff);
    let upperTick = ORDER_SPACING * Math.floor(rawUpperTick / ORDER_SPACING);
    let lowerTick = ORDER_SPACING * Math.ceil(rawLowerTick / ORDER_SPACING);
    if (!withinOrderLimit(TickMath.getWadAtTick(rawUpperTick), amm.markPrice, initialMarginRatio)) {
        upperTick = upperTick - ORDER_SPACING;
    }

    if (!withinOrderLimit(TickMath.getWadAtTick(rawLowerTick), amm.markPrice, initialMarginRatio)) {
        lowerTick = lowerTick + ORDER_SPACING;
    }

    return _amm.isInverse
        ? {
              upperTick: lowerTick,
              lowerTick: upperTick,
          }
        : {
              upperTick,
              lowerTick,
          };
}

export function ammPlaceCrossMarketOrderLimit(
    amm: RawAmm | Amm,
    maintenanceMarginRatio: number,
): {
    upperTick: number;
    lowerTick: number;
} {
    const _amm: any = amm;

    amm = toRawAmm(amm);

    const priceLower = amm.markPrice - wmul(amm.markPrice, r2w(BigInt(maintenanceMarginRatio)));
    const priceUpper = amm.markPrice + wmul(amm.markPrice, r2w(BigInt(maintenanceMarginRatio)));
    const upperTick = ORDER_SPACING * Math.floor(TickMath.getTickAtPWad(priceUpper) / ORDER_SPACING);
    const lowerTick = ORDER_SPACING * Math.ceil(TickMath.getTickAtPWad(priceLower) / ORDER_SPACING);

    return _amm.isInverse
        ? {
              upperTick: lowerTick,
              lowerTick: upperTick,
          }
        : {
              upperTick,
              lowerTick,
          };
}

export function ammWithinDeviationLimit(amm: RawAmm | Amm, initialMarginRatio: number): boolean {
    amm = toRawAmm(amm);

    return withinDeviationLimit(sqrtX96ToWad(amm.sqrtPX96), amm.markPrice, initialMarginRatio);
}

//////////////////////////////////////////
// Top Level Calculation Interface
//////////////////////////////////////////

export function getMinLiquidity(instrument: Instrument, expiry: number, px96?: bigint): bigint {
    instrument = instrument.isInverse ? reverseInstrument(instrument) : instrument;

    const amm = instrument.amms.get(expiry);
    if (!amm) {
        throw new SynfError('Pair not found,' + `instrument: ${instrument.instrumentAddr}, expiry: ${expiry}`);
    }

    const sqrtPX96 = px96 ? px96 : amm.sqrtPX96;

    return (instrument.minRangeValue * Q96) / (sqrtPX96 * 2n);
}

// calc pair funding rate: fairPrice / spotIndex - 1
export function getFundingRate(instrument: Instrument, expiry: number): bigint {
    const _instrument: any = instrument;

    instrument = instrument.isInverse ? reverseInstrument(instrument) : instrument;

    if (instrument.spotPrice === 0n) {
        throw new SynfError('Spot price can not be zero');
    }

    const amm = instrument.amms.get(expiry);
    if (!amm) {
        throw new SynfError('Pair not found');
    }

    const period = instrument.fundingHour * 3600;
    const result = ((wdiv(sqrtX96ToWad(amm.sqrtPX96), instrument.spotPrice) - WAD) * 86400n) / BigInt(period);

    return _instrument.isInverse ? -result : result;
}

export function getBenchmarkPrice(instrument: Instrument, expiry: number): bigint {
    instrument = instrument.isInverse ? reverseInstrument(instrument) : instrument;

    if (expiry === PERP_EXPIRY) {
        return instrument.spotPrice;
    } else {
        const rawSpotPrice = instrument.spotPrice;
        const daysLeft = Date.now() / 1000 >= expiry ? 0 : ~~(expiry * 1000 - Date.now()) / (86400 * 1000) + 1;
        const instrumentType = instrument.market.feeder.ftype;
        if (instrumentType === FeederType.BOTH_STABLE || instrumentType === FeederType.NONE_STABLE) {
            return instrument.spotPrice;
        } else if (instrumentType === FeederType.QUOTE_STABLE) {
            return wmulDown(rawSpotPrice, r2w(BigInt(instrument.market.config.dailyInterestRate)))
                * BigInt(daysLeft)
                + rawSpotPrice;
        } else {
            /* else if (this.rootInstrument.instrumentType === FeederType.BASE_STABLE)*/
            const priceChange = wmulDown(rawSpotPrice, r2w(BigInt(instrument.market.config.dailyInterestRate))) * BigInt(daysLeft);
            return rawSpotPrice > priceChange ? rawSpotPrice - priceChange : 0n;
        }
    }
}

export function estimateAPY(
    instrument: Instrument,
    expiry: number,
    poolFee24h: bigint,
    alphaWad: bigint,
): number {
    instrument = instrument.isInverse ? reverseInstrument(instrument) : instrument;

    const amm = instrument.amms.get(expiry);
    if (!amm || amm.liquidity === 0n) {
        return 0;
    }

    const assumeAddMargin = instrument.minRangeValue;
    const tickDelta = alphaWadToTickDelta(alphaWad);

    const upperTick = RANGE_SPACING * ~~((amm.tick + tickDelta) / RANGE_SPACING);
    const lowerTick = RANGE_SPACING * ~~((amm.tick - tickDelta) / RANGE_SPACING);
    const { liquidity: assumeAddLiquidity } = entryDelta(
        amm.sqrtPX96,
        lowerTick,
        upperTick,
        assumeAddMargin,
        instrument.setting.initialMarginRatio,
    );
    const assumed24HrFee: bigint = (poolFee24h * assumeAddLiquidity) / amm.liquidity;
    const apyWad: bigint = wdiv(assumed24HrFee * 365n, assumeAddMargin);

    return fromWad(apyWad);
}

export function estimateAdjustMarginLeverage(position: RawPosition | Position, amm: RawAmm | Amm, amount: bigint) {
    position = toRawPosition(position);
    amm = toRawAmm(amm);

    const equity = positionEquity(position, amm) - amount;
    const value = wmul(amm.markPrice, position.size < 0n ? -position.size : position.size) - amount;
    return wdiv(value, equity);
}

// @param transferAmount: decimal 18 units, always positive
// @param transferIn: true if in, false if out
// @return leverage: decimal 18 units
export function inquireLeverageFromTransferAmount(
    position: RawPosition | Position,
    amm: RawAmm | Amm,
    transferIn: boolean,
    transferAmount: bigint,
): bigint {
    position = toRawPosition(position);
    amm = toRawAmm(amm);

    const sign: bigint = transferIn ? 1n : -1n;
    const value = wmul(amm.markPrice, position.size < 0n ? -position.size : position.size);
    const oldEquity = positionEquity(position, amm);
    const Amount = transferAmount * sign;
    const newEquity = oldEquity + Amount;
    // leverage is 18 decimal
    return wdiv(value, newEquity);
}

// @param targetLeverage: decimal 18 units
// @return transferAmount: decimal 18 units, positive means transferIn, negative means transferOut
export function inquireTransferAmountFromTargetLeverage(
    position: RawPosition | Position,
    amm: RawAmm | Amm,
    targetLeverage: bigint,
): bigint {
    position = toRawPosition(position);
    amm = toRawAmm(amm);

    const value = wmul(amm.markPrice, position.size < 0n ? -position.size : position.size);
    const targetEquity = wdiv(value, targetLeverage);
    const currentEquity = positionEquity(position, amm);
    return targetEquity - currentEquity;
}

export function calcLimitOrderTickBoundary(amm: RawAmm | Amm, initialMarginRatio: number, side: Side) {
    const _amm: any = amm;

    if (_amm.isInverse) {
        side = reverseSide(side);
    }

    let currentTick = Math.floor(amm.tick / PEARL_SPACING) * PEARL_SPACING;

    if (side === Side.LONG) {
        if (currentTick === amm.tick) {
            currentTick = currentTick - PEARL_SPACING;
        }
    } else {
        currentTick = currentTick + PEARL_SPACING;
    }

    const { upperTick, lowerTick } = ammPlaceOrderLimit(amm, initialMarginRatio);

    if (_amm.isInverse) {
        if (side === Side.SHORT) {
            return {
                upperTick: lowerTick,
                lowerTick: currentTick,
            };
        } else {
            return {
                upperTick: currentTick,
                lowerTick: upperTick,
            };
        }
    } else {
        if (side === Side.LONG) {
            return {
                upperTick: currentTick,
                lowerTick: lowerTick,
            };
        } else {
            return {
                upperTick: upperTick,
                lowerTick: currentTick,
            };
        }
    }
}

export function calcCrossMarketOrderTickBoundary(
    amm: RawAmm | Amm,
    initialMarginRatio: number,
    maintenanceMarginRatio: number,
    side: Side,
) {
    const _amm: any = amm;

    if (_amm.isInverse) {
        side = reverseSide(side);
    }

    const { upperTick, lowerTick } = ammPlaceOrderLimit(amm, initialMarginRatio);
    const { upperTick: _upperTick, lowerTick: _lowerTick } = ammPlaceCrossMarketOrderLimit(amm, maintenanceMarginRatio);

    if (_amm.isInverse) {
        if (side === Side.SHORT) {
            return {
                upperTick: lowerTick,
                lowerTick: _upperTick,
            };
        } else {
            return {
                upperTick: _lowerTick,
                lowerTick: upperTick,
            };
        }
    } else {
        if (side === Side.LONG) {
            return {
                upperTick: _upperTick,
                lowerTick,
            };
        } else {
            return {
                upperTick,
                lowerTick: _lowerTick,
            };
        }
    }
}
