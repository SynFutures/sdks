import { BigNumber } from 'ethers';
import { fromWad } from '@derivation-tech/context';
import { PERP_EXPIRY, ONE_RATIO, ORDER_SPACING, EMPTY_AMM } from '../constants';
import { ONE, ZERO, Q96, r2w, sqrtX96ToWad, TickMath, SqrtPriceMath, WAD, wdiv, wmul, wmulDown, wmulUp } from '../math';
import { RawOrder, RawPosition, RawRange, RawAmm, Instrument, Position, Amm, Range, Order } from '../types';
import { FeederType } from '../enum';
import { RANGE_SPACING } from '../constants';
import { reverseAmm, reverseInstrument, reverseOrder, reversePosition, reversePrice, reverseRange } from './reverse';
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
} from './lowLevel';
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
): BigNumber {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const _position: any = position;

    position = toRawPosition(position);
    amm = toRawAmm(amm);

    if (position.size.isZero() || position.balance.isZero()) {
        return ZERO;
    }

    const price = calcLiquidationPrice(amm, position, maintenanceMarginRatio);

    return _position.isInverse ? reversePrice(price) : price;
}

export function positionUnrealizedSocialLoss(position: RawPosition | Position, amm: RawAmm | Amm): BigNumber {
    position = toRawPosition(position);
    amm = toRawAmm(amm);

    const { socialLoss } = tally(amm, position, amm.markPrice);

    return socialLoss;
}

export function positionUnrealizedPnl(position: RawPosition | Position, amm: RawAmm | Amm): BigNumber {
    position = toRawPosition(position);
    amm = toRawAmm(amm);

    return calcPnl(amm, position, amm.markPrice);
}

export function positionUnrealizedPnlByFairPrice(position: RawPosition | Position, amm: RawAmm | Amm): BigNumber {
    position = toRawPosition(position);
    amm = toRawAmm(amm);

    return calcPnl(amm, position, sqrtX96ToWad(amm.sqrtPX96));
}

export function positionUnrealizedFundingFee(position: RawPosition | Position, amm: RawAmm | Amm): BigNumber {
    if (amm.expiry !== PERP_EXPIRY) {
        return ZERO;
    }

    position = toRawPosition(position);
    amm = toRawAmm(amm);

    return calcFundingFee(amm, position);
}

export function positionEquity(position: RawPosition | Position, amm: RawAmm | Amm): BigNumber {
    position = toRawPosition(position);
    amm = toRawAmm(amm);

    return position.balance.add(positionUnrealizedPnl(position, amm));
}

export function positionLeverage(position: RawPosition | Position, amm: RawAmm | Amm): BigNumber {
    position = toRawPosition(position);
    amm = toRawAmm(amm);

    const value = wmul(amm.markPrice, position.size.abs());
    const equity = positionEquity(position, amm);
    if (equity.isZero()) {
        return ZERO;
    }

    return wdiv(value, equity);
}

export function positionMaxWithdrawableMargin(
    position: RawPosition | Position,
    amm: RawAmm | Amm,
    initialMarginRatio: number,
): BigNumber {
    position = toRawPosition(position);
    amm = toRawAmm(amm);

    const { pnl, socialLoss } = tally(amm, position, amm.markPrice);
    const funding = calcFundingFee(amm, position);

    const purePnl = pnl.add(socialLoss).sub(funding);
    const unrealizedLoss = (purePnl.gt(ZERO) ? ZERO : purePnl).sub(socialLoss);

    const value = wmulUp(amm.markPrice, position.size.abs());
    const imRequirement = wmulUp(value, r2w(initialMarginRatio));
    const maxWithdrawableMargin = position.balance.add(unrealizedLoss).sub(imRequirement);
    return maxWithdrawableMargin.gt(ZERO) ? maxWithdrawableMargin : ZERO;
}

export function positionAdditionMarginToIMRSafe(
    position: RawPosition | Position,
    amm: RawAmm | Amm,
    initialMarginRatio: number,
    increase: boolean,
    slippage?: number,
): BigNumber {
    position = toRawPosition(position);
    amm = toRawAmm(amm);

    const positionValue = wmul(amm.markPrice, position.size.abs());
    let imrValue = wmulUp(positionValue, r2w(initialMarginRatio));
    if (slippage) {
        imrValue = imrValue.mul(ONE_RATIO + slippage).div(ONE_RATIO);
    }
    let equity;
    if (increase) {
        const unrealizedPnl = positionUnrealizedPnl(position, amm);
        const unrealizedLoss = unrealizedPnl.lt(ZERO) ? unrealizedPnl : ZERO;
        equity = position.balance.add(unrealizedLoss);
    } else {
        equity = positionEquity(position, amm);
    }
    const additionMargin = imrValue.sub(equity);
    return additionMargin.gt(ZERO) ? additionMargin : ZERO;
}

export function isPositionIMSafe(
    position: RawPosition | Position,
    amm: RawAmm | Amm,
    initialMarginRatio: number,
    increase: boolean,
): boolean {
    position = toRawPosition(position);
    amm = toRawAmm(amm);

    let equity: BigNumber;
    if (increase) {
        const unrealizedPnl = positionUnrealizedPnl(position, amm);
        const unrealizedLoss = unrealizedPnl.lt(ZERO) ? unrealizedPnl : ZERO;
        equity = position.balance.add(unrealizedLoss);
    } else {
        equity = positionEquity(position, amm);
    }

    if (equity.isNegative()) {
        return false;
    }

    const positionValue = wmulUp(amm.markPrice, position.size.abs());
    return equity.gte(wmulUp(positionValue, r2w(initialMarginRatio)));
}

export function isPositionMMSafe(position: RawPosition | Position, amm: RawAmm | Amm, maintenanceMarginRatio: number) {
    position = toRawPosition(position);
    amm = toRawAmm(amm);

    const equity = positionEquity(position, amm);

    if (equity.isNegative()) {
        return false;
    }

    const positionValue = wmulUp(amm.markPrice, position.size.abs());
    return equity.gte(wmulUp(positionValue, r2w(maintenanceMarginRatio)));
}

//////////////////////////////////////////
// RawRange Calculation Interface
//////////////////////////////////////////

export function rangeEntryDeltaBase(range: RawRange | Range): BigNumber {
    range = toRawRange(range);

    const sqrtUpperPX96 = TickMath.getSqrtRatioAtTick(range.tickUpper);
    return SqrtPriceMath.getDeltaBaseAutoRoundUp(range.sqrtEntryPX96, sqrtUpperPX96, range.liquidity);
}

export function rangeEntryDeltaQuote(range: RawRange | Range): BigNumber {
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
    const earnedByBase = wmul(removeDeltaBase.sub(entryDeltaBase), fair);
    const earnedByQuote = removeDeltaQuote.sub(entryDeltaQuote);
    const pnl = earnedByBase.add(earnedByQuote);
    const fee = wmulDown(amm.feeIndex.sub(range.entryFeeIndex), range.liquidity);
    const size = removeDeltaBase.sub(entryDeltaBase);
    const rawPosition = {
        balance: range.balance.add(fee).add(pnl).sub(ONE),
        size: size,
        entryNotional: wmul(fair, size.abs()),
        entrySocialLossIndex: size.gt(ZERO) ? amm.longSocialLossIndex : amm.shortSocialLossIndex,
        entryFundingIndex: size.gt(ZERO) ? amm.longFundingIndex : amm.shortFundingIndex,
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

export function rangeValueLocked(range: RawRange | Range, amm: RawAmm | Amm): BigNumber {
    range = toRawRange(range);
    amm = toRawAmm(amm);

    const position = rangeToPosition(range, amm);
    const total = tally(amm, position, amm.markPrice);
    return total.equity;
}

export function rangeFeeEarned(range: RawRange | Range, amm: RawAmm | Amm): BigNumber {
    range = toRawRange(range);
    amm = toRawAmm(amm);

    return wmulDown(amm.feeIndex.sub(range.entryFeeIndex), range.liquidity);
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
        entryNotional: wmul(TickMath.getWadAtTick(order.tick), order.size.abs()),
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

export function orderLeverage(order: RawOrder | Order, amm: RawAmm | Amm): BigNumber {
    order = toRawOrder(order);
    amm = toRawAmm(amm);

    const limitPrice = TickMath.getWadAtTick(order.tick);
    const px = order.taken.eq(ZERO) ? limitPrice : amm.markPrice;
    const value = wmul(px, order.size.abs());
    return wdiv(value, order.balance);
}

export function orderEquity(order: RawOrder | Order, amm: RawAmm | Amm): BigNumber {
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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const _amm: any = amm;

    amm = toRawAmm(amm);

    const maxDiff = wmul(amm.markPrice, r2w(initialMarginRatio)).mul(2);
    const rawUpperTick = TickMath.getTickAtPWad(amm.markPrice.add(maxDiff));
    const rawLowerTick = TickMath.getTickAtPWad(amm.markPrice.sub(maxDiff));
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

export function ammWithinDeviationLimit(amm: RawAmm | Amm, initialMarginRatio: number): boolean {
    amm = toRawAmm(amm);

    return withinDeviationLimit(sqrtX96ToWad(amm.sqrtPX96), amm.markPrice, initialMarginRatio);
}

//////////////////////////////////////////
// Top Level Calculation Interface
//////////////////////////////////////////

export function getMinLiquidity(instrument: Instrument, expiry: number, px96?: BigNumber): BigNumber {
    instrument = instrument.isInverse ? reverseInstrument(instrument) : instrument;

    const amm = instrument.amms.get(expiry);
    if (!amm) {
        throw new SynfError('Pair not found,' + `instrument: ${instrument.instrumentAddr}, expiry: ${expiry}`);
    }

    const sqrtPX96 = px96 ? px96 : amm.sqrtPX96;

    return instrument.minRangeValue.mul(Q96).div(sqrtPX96.mul(2));
}

// calc pair funding rate: fairPrice / spotIndex - 1
export function getFundingRate(instrument: Instrument, expiry: number): BigNumber {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const _instrument: any = instrument;

    instrument = instrument.isInverse ? reverseInstrument(instrument) : instrument;

    if (instrument.spotPrice.eq(0)) {
        throw new SynfError('Spot price can not be zero');
    }

    const amm = instrument.amms.get(expiry);
    if (!amm) {
        throw new SynfError('Pair not found');
    }

    const period = instrument.fundingHour * 3600;
    const result = wdiv(sqrtX96ToWad(amm.sqrtPX96), instrument.spotPrice).sub(WAD).mul(86400).div(period);

    return _instrument.isInverse ? result.mul(-1) : result;
}

export function getBenchmarkPrice(instrument: Instrument, expiry: number): BigNumber {
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
            return wmulDown(rawSpotPrice, r2w(instrument.market.config.dailyInterestRate))
                .mul(daysLeft)
                .add(rawSpotPrice);
        } else {
            /* else if (this.rootInstrument.instrumentType === FeederType.BASE_STABLE)*/
            const priceChange = wmulDown(rawSpotPrice, r2w(instrument.market.config.dailyInterestRate)).mul(daysLeft);
            return rawSpotPrice.gt(priceChange) ? rawSpotPrice.sub(priceChange) : ZERO;
        }
    }
}

export function estimateAPY(
    instrument: Instrument,
    expiry: number,
    poolFee24h: BigNumber,
    alphaWad: BigNumber,
): number {
    instrument = instrument.isInverse ? reverseInstrument(instrument) : instrument;

    const amm = instrument.amms.get(expiry);
    if (!amm || amm.liquidity.eq(ZERO)) {
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
    const assumed24HrFee: BigNumber = poolFee24h.mul(assumeAddLiquidity).div(amm.liquidity);
    const apyWad: BigNumber = wdiv(assumed24HrFee.mul(365), assumeAddMargin);

    return fromWad(apyWad);
}

export function estimateAdjustMarginLeverage(position: RawPosition | Position, amm: RawAmm | Amm, amount: BigNumber) {
    position = toRawPosition(position);
    amm = toRawAmm(amm);

    const equity = positionEquity(position, amm).sub(amount);
    const value = wmul(amm.markPrice, position.size.abs()).sub(amount);
    return wdiv(value, equity);
}

// @param transferAmount: decimal 18 units, always positive
// @param transferIn: true if in, false if out
// @return leverage: decimal 18 units
export function inquireLeverageFromTransferAmount(
    position: RawPosition | Position,
    amm: RawAmm | Amm,
    transferIn: boolean,
    transferAmount: BigNumber,
): BigNumber {
    position = toRawPosition(position);
    amm = toRawAmm(amm);

    const sign: number = transferIn ? 1 : -1;
    const value = wmul(amm.markPrice, position.size.abs());
    const oldEquity = positionEquity(position, amm);
    const Amount = transferAmount.mul(sign);
    const newEquity = oldEquity.add(Amount);
    // leverage is 18 decimal
    return wdiv(value, newEquity);
}

// @param targetLeverage: decimal 18 units
// @return transferAmount: decimal 18 units, positive means transferIn, negative means transferOut
export function inquireTransferAmountFromTargetLeverage(
    position: RawPosition | Position,
    amm: RawAmm | Amm,
    targetLeverage: BigNumber,
): BigNumber {
    position = toRawPosition(position);
    amm = toRawAmm(amm);

    const value = wmul(amm.markPrice, position.size.abs());
    const targetEquity = wdiv(value, targetLeverage);
    const currentEquity = positionEquity(position, amm);
    return targetEquity.sub(currentEquity);
}
