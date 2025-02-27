import { BigNumber } from 'ethers';
import { SECS_PER_DAY } from '@derivation-tech/context';
import { PERP_EXPIRY, RATIO_BASE, RANGE_SPACING } from '../constants';
import {
    ZERO,
    Q96,
    r2w,
    sqrtX96ToWad,
    TickMath,
    SqrtPriceMath,
    WAD,
    wadToTick,
    wdiv,
    wdivDown,
    wdivUp,
    wmul,
    wmulDown,
    wmulUp,
    wmulInt,
    frac,
    fracDown,
    oppositeSigns,
} from '../math';
import { RawOrder, RawPosition, ContractRecord, RawAmm } from '../types';
import { BatchOrderSizeDistribution, FeederType } from '../enum';
import { SynfError } from '../errors/synfError';

export function getLatestFundingIndex(
    amm: RawAmm,
    markPrice: BigNumber,
    timestamp: number,
): { longFundingIndex: BigNumber; shortFundingIndex: BigNumber } {
    return updateFundingIndex(amm, markPrice, timestamp);
}

export function updateFundingIndex(
    amm: RawAmm,
    mark: BigNumber,
    timestamp: number,
): { longFundingIndex: BigNumber; shortFundingIndex: BigNumber } {
    const timeElapsed = timestamp - amm.timestamp;
    if (timeElapsed == 0) return { longFundingIndex: amm.longFundingIndex, shortFundingIndex: amm.shortFundingIndex };
    const fair = sqrtX96ToWad(amm.sqrtPX96);

    const longPayShort = fair.gt(mark);
    const [payerSize, receiverSize] = longPayShort ? [amm.totalLong, amm.totalShort] : [amm.totalShort, amm.totalLong];
    const fundingFeeIndex = frac(fair.sub(mark).abs(), BigNumber.from(timeElapsed), BigNumber.from(SECS_PER_DAY));
    if (payerSize.gt(0)) {
        let [payerIndex, receiverIndex] = longPayShort
            ? [amm.longFundingIndex, amm.shortFundingIndex]
            : [amm.shortFundingIndex, amm.longFundingIndex];
        payerIndex = payerIndex.sub(fundingFeeIndex);
        const totalFundingFee = wmul(fundingFeeIndex, payerSize);
        if (receiverSize.gt(0)) {
            receiverIndex = receiverIndex.add(wdiv(totalFundingFee, receiverSize));
        }
        return longPayShort
            ? { longFundingIndex: payerIndex, shortFundingIndex: receiverIndex }
            : { longFundingIndex: receiverIndex, shortFundingIndex: payerIndex };
    }
    return { longFundingIndex: amm.longFundingIndex, shortFundingIndex: amm.shortFundingIndex };
}

export function withinOrderLimit(limitPrice: BigNumber, markPrice: BigNumber, imr: number): boolean {
    return wdiv(limitPrice.sub(markPrice).abs(), markPrice).lte(r2w(imr).mul(2));
}

export function withinDeviationLimit(fairPrice: BigNumber, markPrice: BigNumber, imr: number): boolean {
    return wdiv(fairPrice.sub(markPrice).abs(), markPrice).lte(r2w(imr));
}

export function calcBenchmarkPrice(
    expiry: number,
    rawSpotPrice: BigNumber,
    feederType: FeederType,
    dailyInterestRate: number,
): BigNumber {
    if (expiry == PERP_EXPIRY) {
        return rawSpotPrice;
    } else {
        const daysLeft =
            Date.now() / 1000 >= expiry ? 0 : Math.floor((expiry * 1000 - Date.now()) / (SECS_PER_DAY * 1000)) + 1;
        if (feederType === FeederType.BOTH_STABLE || feederType === FeederType.NONE_STABLE) {
            return rawSpotPrice;
        } else if (feederType === FeederType.QUOTE_STABLE) {
            return wmulDown(rawSpotPrice, r2w(dailyInterestRate)).mul(daysLeft).add(rawSpotPrice);
        } else {
            /* else if (this.rootInstrument.instrumentType === FeederType.BASE_STABLE)*/
            const priceChange = wmulDown(rawSpotPrice, r2w(dailyInterestRate)).mul(daysLeft);
            return rawSpotPrice.gt(priceChange) ? rawSpotPrice.sub(priceChange) : ZERO;
        }
    }
}

export function calcMinTickDelta(initialMarginRatio: number): number {
    return wadToTick(r2w(initialMarginRatio).add(WAD));
}

// given size distribution, return the ratios for batch orders
export function getBatchOrderRatios(sizeDistribution: BatchOrderSizeDistribution, orderCount: number): number[] {
    let ratios: number[] = [];
    switch (sizeDistribution) {
        case BatchOrderSizeDistribution.FLAT: {
            ratios = Array(orderCount).fill(Math.floor(RATIO_BASE / orderCount));
            break;
        }
        case BatchOrderSizeDistribution.UPPER: {
            // first order is 1, second order is 2, ..., last order is orderCount pieces
            const sum = Array.from({ length: orderCount }, (_, i) => i + 1).reduce((acc, i) => acc + i, 0);
            ratios = Array.from({ length: orderCount }, (_, i) => Math.floor((i + 1) * (RATIO_BASE / sum)));
            break;
        }
        case BatchOrderSizeDistribution.LOWER: {
            // first order is orderCount, second order is orderCount - 1, ..., last order is 1 piece
            const sum = Array.from({ length: orderCount }, (_, i) => orderCount - i).reduce((acc, i) => acc + i, 0);
            ratios = Array.from({ length: orderCount }, (_, i) => Math.floor((orderCount - i) * (RATIO_BASE / sum)));
            break;
        }
        case BatchOrderSizeDistribution.RANDOM: {
            // Generate initial ratios within a target range
            let totalRatio = 0;
            const averageRatio = RATIO_BASE / orderCount;
            const minRatio = Math.ceil(averageRatio * 0.95);
            const maxRatio = Math.floor(averageRatio * 1.05);

            // Generate initial ratios
            for (let i = 0; i < orderCount; i++) {
                let ratio = Math.floor(averageRatio * (1 - 0.05 + Math.random() * 0.1));
                ratio = Math.max(minRatio, Math.min(maxRatio, ratio));
                ratios.push(ratio);
                totalRatio += ratio;
            }

            // Adjust the ratios to ensure the sum is RATIO_BASE
            let adjustment = RATIO_BASE - totalRatio;
            const increment = adjustment > 0 ? 1 : -1;

            // Randomly adjust each ratio slightly to balance to RATIO_BASE
            while (adjustment !== 0) {
                for (let i = 0; i < orderCount && adjustment !== 0; i++) {
                    const newRatio = ratios[i] + increment;
                    if (newRatio >= minRatio && newRatio <= maxRatio) {
                        ratios[i] = newRatio;
                        adjustment -= increment;
                    }
                }
            }
            break;
        }
        default:
            throw new SynfError('Invalid size distribution');
    }
    // make sure the sum of ratios is 10000
    ratios[ratios.length - 1] = RATIO_BASE - ratios.slice(0, ratios.length - 1).reduce((acc, ratio) => acc + ratio, 0);
    return ratios;
}

export function requiredMarginForOrder(limit: BigNumber, sizeWad: BigNumber, ratio: number): BigNumber {
    const marginValue: BigNumber = wmul(limit, sizeWad);
    const minAmount: BigNumber = wmulUp(marginValue, r2w(ratio));
    return minAmount;
}

export function fillOrderToPosition(
    pearlNonce: number,
    pearlTaken: BigNumber,
    pearlFee: BigNumber,
    pearlSocialLoss: BigNumber,
    pearlFundingIndex: BigNumber,
    order: RawOrder,
    tick: number,
    nonce: number,
    fillSize: BigNumber,
    record: ContractRecord,
): RawPosition {
    if (fillSize.eq(ZERO)) {
        fillSize = order.size;
    }
    const usize = fillSize.abs();
    let makerFee: BigNumber;
    let entrySocialLossIndex: BigNumber;
    let entryFundingIndex: BigNumber;
    if (nonce < pearlNonce) {
        const utaken0 = record.taken.abs();
        makerFee = record.taken.eq(fillSize) ? record.fee : fracDown(record.fee, usize, utaken0);
        entrySocialLossIndex = record.entrySocialLossIndex;
        entryFundingIndex = record.entryFundingIndex;
    } else {
        const utaken1 = pearlTaken.abs();
        makerFee = pearlTaken.eq(fillSize) ? pearlFee : fracDown(pearlFee, usize, utaken1);
        entrySocialLossIndex = pearlSocialLoss;
        entryFundingIndex = pearlFundingIndex;
    }
    const srtikePrice = TickMath.getWadAtTick(tick);

    return {
        balance: order.balance.add(makerFee),
        size: fillSize,
        entryNotional: wmul(srtikePrice, fillSize.abs()),
        entrySocialLossIndex: entrySocialLossIndex,
        entryFundingIndex: entryFundingIndex,
    };
}

export function cancelOrderToPosition(
    pearlLeft: BigNumber,
    pearlNonce: number,
    pearlTaken: BigNumber,
    pearlFee: BigNumber,
    pearlSocialLoss: BigNumber,
    pearlFundingIndex: BigNumber,
    order: RawOrder,
    tick: number,
    nonce: number,
    record: ContractRecord,
): RawPosition {
    let pic: RawPosition = {
        balance: order.balance,
        size: ZERO,
        entryNotional: ZERO,
        entrySocialLossIndex: ZERO,
        entryFundingIndex: ZERO,
    };
    const uleft: BigNumber = pearlLeft.abs();
    const usize: BigNumber = order.size.abs();
    if (uleft.lt(usize)) {
        // partially cancelled
        const tLeft = pearlLeft;
        pic = fillOrderToPosition(
            pearlNonce,
            pearlTaken,
            pearlFee,
            pearlSocialLoss,
            pearlFundingIndex,
            order,
            tick,
            nonce,
            order.size.sub(tLeft),
            record,
        );
    }
    // fully cancelled, no position generated
    return pic;
}

export function tally(
    amm: RawAmm,
    position: RawPosition,
    mark: BigNumber,
): { equity: BigNumber; pnl: BigNumber; socialLoss: BigNumber } {
    let fundingFee: BigNumber = ZERO;
    const value: BigNumber = wmul(mark, position.size.abs());
    const socialLoss: BigNumber = wmulUp(
        (position.size.gt(ZERO) ? amm.longSocialLossIndex : amm.shortSocialLossIndex).sub(
            position.entrySocialLossIndex,
        ),
        position.size.abs(),
    );

    // perp should consider funding fee
    if (amm.expiry === PERP_EXPIRY) fundingFee = calcFundingFee(amm, position);

    const pnl = (position.size.gt(ZERO) ? value.sub(position.entryNotional) : position.entryNotional.sub(value))
        .add(fundingFee)
        .sub(socialLoss);

    const equity = pnl.add(position.balance);
    return { equity: equity, pnl: pnl, socialLoss: socialLoss };
}

export function calcLiquidationPrice(amm: RawAmm, position: RawPosition, maintenanceMarginRatio = 500): BigNumber {
    // if LONG:
    // price * size - entryNotional - socialLoss + balance + fundingFee = price * size * mmr
    // price = (entryNotional + socialLoss - balance - fundingFee) / (1 - mmr)*size
    // if SHORT:
    // entryNotional - price * size - socialLoss + balance + fundingFee = price * size * mmr
    // price = (entryNotional - socialLoss + balance + fundingFee) / (1 + mmr)*size
    const socialLoss: BigNumber = wmulUp(
        (position.size.gt(ZERO) ? amm.longSocialLossIndex : amm.shortSocialLossIndex).sub(
            position.entrySocialLossIndex,
        ),
        position.size.abs(),
    );
    const fundingFee = calcFundingFee(amm, position);
    let price: BigNumber;

    if (position.size.gt(ZERO)) {
        const numerator = position.entryNotional.add(socialLoss).sub(position.balance).sub(fundingFee);
        if (numerator.lte(ZERO)) return ZERO;
        price = wdivDown(numerator, wmulUp(position.size.abs(), r2w(10000 - maintenanceMarginRatio)));
    } else {
        const numerator = position.entryNotional.sub(socialLoss).add(position.balance).add(fundingFee);
        if (numerator.lte(ZERO)) return ZERO; // highly unlikely to happen
        price = wdivUp(numerator, wmulDown(position.size.abs(), r2w(10000 + maintenanceMarginRatio)));
    }
    return price;
}

export function calculatePriceFromPnl(amm: RawAmm, position: RawPosition, pnl: BigNumber): BigNumber {
    // if LONG:
    // price = (pnl - fundingFee + socialLoss + entryNotional) / size
    // if SHORT:
    // price = (entryNotional + fundingFee - socialLoss - pnl) / size
    const socialLoss: BigNumber = wmulUp(
        (position.size.gt(ZERO) ? amm.longSocialLossIndex : amm.shortSocialLossIndex).sub(
            position.entrySocialLossIndex,
        ),
        position.size.abs(),
    );
    const fundingFee = calcFundingFee(amm, position);
    const value = position.size.gt(ZERO)
        ? pnl.add(socialLoss).add(position.entryNotional).sub(fundingFee)
        : position.entryNotional.sub(socialLoss).sub(pnl).add(fundingFee);

    return position.size.gt(ZERO) ? wdivUp(value, position.size.abs()) : wdivDown(value, position.size.abs());
}

export function calcFundingFee(amm: RawAmm, position: RawPosition): BigNumber {
    return wmulInt(
        (position.size.gte(ZERO) ? amm.longFundingIndex : amm.shortFundingIndex).sub(position.entryFundingIndex),
        position.size.abs(),
    );
}

export function calcPnl(amm: RawAmm, position: RawPosition, mark: BigNumber): BigNumber {
    return tally(amm, position, mark).pnl;
}

export function realizeFundingWithPnl(amm: RawAmm, pos: RawPosition): { position: RawPosition; pnl: BigNumber } {
    if (pos.size.eq(0)) return { position: pos, pnl: ZERO };
    const position: RawPosition = Object.assign({}, pos);

    const currentFundingIndex = position.size.gt(ZERO) ? amm.longFundingIndex : amm.shortFundingIndex;
    let pnl = ZERO;
    if (!currentFundingIndex.eq(position.entryFundingIndex)) {
        const funding = wmulInt(currentFundingIndex.sub(position.entryFundingIndex), position.size.abs());
        pnl = funding;

        position.entryFundingIndex = currentFundingIndex;
        position.balance = position.balance.add(funding);
    }
    return { position, pnl };
}

export function realizeFundingIncome(amm: RawAmm, pos: RawPosition): RawPosition {
    return realizeFundingWithPnl(amm, pos).position;
}

export function realizeSocialLoss(amm: RawAmm, pos: RawPosition): { position: RawPosition; socialLoss: BigNumber } {
    pos = { ...pos };
    const long = pos.size.gt(ZERO);
    const usize = pos.size.abs();
    const socialLossIndex = long ? amm.longSocialLossIndex : amm.shortSocialLossIndex;
    const socialLoss = wmulUp(socialLossIndex.sub(pos.entrySocialLossIndex), usize);
    pos.balance = pos.balance.sub(socialLoss);
    pos.entrySocialLossIndex = socialLossIndex;
    return { position: pos, socialLoss };
}

export function combine(
    amm: RawAmm,
    position_1: RawPosition,
    position_2: RawPosition,
): { position: RawPosition; closedSize: BigNumber; realized: BigNumber } {
    let position1 = Object.assign({}, position_1);
    let position2 = Object.assign({}, position_2);
    let realized = ZERO;

    if (amm.expiry === PERP_EXPIRY) {
        const { position: realizedPosition1, pnl: realizedPnl1 } = realizeFundingWithPnl(amm, position1);
        const { position: realizedPosition2, pnl: realizedPnl2 } = realizeFundingWithPnl(amm, position2);
        position1 = realizedPosition1;
        position2 = realizedPosition2;
        realized = realized.add(realizedPnl1);
        realized = realized.add(realizedPnl2);
    }

    const { position: realizedPosition1, socialLoss: socialLoss1 } = realizeSocialLoss(amm, position1);
    const { position: realizedPosition2, socialLoss: socialLoss2 } = realizeSocialLoss(amm, position2);
    position1 = realizedPosition1;
    position2 = realizedPosition2;
    realized = realized.sub(socialLoss1);
    realized = realized.sub(socialLoss2);

    let pic: RawPosition = {
        balance: ZERO,
        size: ZERO,
        entryNotional: ZERO,
        entrySocialLossIndex: ZERO,
        entryFundingIndex: ZERO,
    };
    let closedSize = ZERO;
    if (position1.size.eq(ZERO) || position2.size.eq(ZERO)) {
        pic = position1.size.eq(ZERO) ? position2 : position1;
        pic.balance = position1.balance.add(position2.balance);
        return { position: pic, closedSize: closedSize, realized: realized };
    }

    pic.size = position1.size.add(position2.size);
    if (oppositeSigns(position1.size, position2.size)) {
        closedSize = position1.size.abs().lt(position2.size.abs()) ? position1.size.abs() : position2.size.abs();

        const longPic: RawPosition = position1.size.gt(ZERO) ? position1 : position2;
        const shortPic: RawPosition = position1.size.gt(ZERO) ? position2 : position1;
        let closedLongNotional: BigNumber = ZERO;
        let closedShortNotional: BigNumber = ZERO;

        if (pic.size.gt(ZERO)) {
            closedLongNotional = frac(longPic.entryNotional, closedSize, longPic.size.abs());
            closedShortNotional = shortPic.entryNotional;
            pic.entryNotional = longPic.entryNotional.sub(closedLongNotional);
            pic.entrySocialLossIndex = longPic.entrySocialLossIndex;
            pic.entryFundingIndex = longPic.entryFundingIndex;
        } else if (pic.size.lt(ZERO)) {
            closedLongNotional = longPic.entryNotional;
            closedShortNotional = frac(shortPic.entryNotional, closedSize, shortPic.size.abs());
            pic.entryNotional = shortPic.entryNotional.sub(closedShortNotional);
            pic.entrySocialLossIndex = shortPic.entrySocialLossIndex;
            pic.entryFundingIndex = shortPic.entryFundingIndex;
        } else {
            closedLongNotional = longPic.entryNotional;
            closedShortNotional = shortPic.entryNotional;
        }
        const realizedPnl = closedShortNotional.sub(closedLongNotional);
        pic.balance = pic.balance.add(longPic.balance).add(shortPic.balance).add(realizedPnl);
        realized = realized.add(realizedPnl);
    } else {
        pic.entryNotional = position1.entryNotional.add(position2.entryNotional);
        pic.entrySocialLossIndex = pic.size.gt(ZERO) ? amm.longSocialLossIndex : amm.shortSocialLossIndex;
        pic.entryFundingIndex = position1.size.gt(ZERO) ? amm.longFundingIndex : amm.shortFundingIndex;
        pic.balance = position1.balance.add(position2.balance);
    }

    return { position: pic, closedSize: closedSize, realized: realized };
}

export function splitPosition(pos: RawPosition, partSize: BigNumber): { partPos: RawPosition; finalPos: RawPosition } {
    const uFullSize = pos.size.abs();
    const uPartSize = partSize.abs();

    const partPos = {} as RawPosition;
    const finalPos = pos;

    partPos.size = partSize;
    finalPos.size = pos.size.sub(partSize);

    partPos.balance = frac(pos.balance, uPartSize, uFullSize);
    finalPos.balance = pos.balance.sub(partPos.balance);

    partPos.entryNotional = frac(pos.entryNotional, uPartSize, uFullSize);
    finalPos.entryNotional = pos.entryNotional.sub(partPos.entryNotional);

    partPos.entrySocialLossIndex = pos.entrySocialLossIndex;
    partPos.entryFundingIndex = pos.entryFundingIndex;

    return { partPos, finalPos };
}

export function entryDelta(
    sqrtEntryPX96: BigNumber,
    tickLower: number,
    tickUpper: number,
    entryMargin: BigNumber,
    initialMarginRatio: number,
): { deltaBase: BigNumber; deltaQuote: BigNumber; liquidity: BigNumber } {
    const upperPX96 = TickMath.getSqrtRatioAtTick(tickUpper);
    const lowerPX96 = TickMath.getSqrtRatioAtTick(tickLower);
    const liquidityByUpper = getLiquidityFromMarginByUpper(sqrtEntryPX96, upperPX96, entryMargin, initialMarginRatio);
    const liquidityByLower = getLiquidityFromMarginByLower(sqrtEntryPX96, lowerPX96, entryMargin, initialMarginRatio);
    const liquidity = liquidityByUpper.lt(liquidityByLower) ? liquidityByUpper : liquidityByLower;
    const deltaBase = SqrtPriceMath.getDeltaBaseAutoRoundUp(sqrtEntryPX96, upperPX96, liquidity);
    const deltaQuote = SqrtPriceMath.getDeltaQuoteAutoRoundUp(lowerPX96, sqrtEntryPX96, liquidity);

    return { deltaBase: deltaBase, deltaQuote: deltaQuote, liquidity: liquidity };
}

export function alignRangeTick(tick: number, lower: boolean): number {
    if ((tick > 0 && lower) || (tick < 0 && !lower)) {
        return RANGE_SPACING * ~~(tick / RANGE_SPACING);
    } else {
        return RANGE_SPACING * ~~((tick + (tick > 0 ? 1 : -1) * (RANGE_SPACING - 1)) / RANGE_SPACING);
    }
}

export function getLiquidityFromMarginByUpper(
    sqrtEntryPX96: BigNumber,
    sqrtUpperPX96: BigNumber,
    entryMargin: BigNumber,
    initialMarginRatio: number,
): BigNumber {
    const numerator = entryMargin.mul(sqrtEntryPX96).div(sqrtUpperPX96.sub(sqrtEntryPX96));
    const denominator = sqrtUpperPX96.sub(sqrtEntryPX96).add(wmulUp(sqrtUpperPX96, r2w(initialMarginRatio)));
    return numerator.mul(Q96).div(denominator);
}

export function getLiquidityFromMarginByLower(
    sqrtEntryPX96: BigNumber,
    sqrtLowerPX96: BigNumber,
    entryMargin: BigNumber,
    initialMarginRatio: number,
): BigNumber {
    const numerator = entryMargin.mul(sqrtEntryPX96).div(sqrtEntryPX96.sub(sqrtLowerPX96));
    const denominator = sqrtEntryPX96.sub(sqrtLowerPX96).add(wmulUp(sqrtLowerPX96, r2w(initialMarginRatio)));
    return numerator.mul(Q96).div(denominator);
}

export function getMarginFromLiquidity(
    sqrtEntryPX96: BigNumber,
    tickUpper: number,
    liquidity: BigNumber,
    initialMarginRatio: number,
): BigNumber {
    const sqrtUpperPX96 = TickMath.getSqrtRatioAtTick(tickUpper);
    const denominator = wmulUp(sqrtUpperPX96, r2w(10000 + initialMarginRatio)).sub(sqrtEntryPX96);
    const temp = liquidity.mul(denominator).div(Q96);
    return temp.mul(sqrtUpperPX96.sub(sqrtEntryPX96)).div(sqrtEntryPX96);
}
