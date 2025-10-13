import { SECS_PER_DAY } from '@derivation-tech/context';
import { PERP_EXPIRY, RATIO_BASE, RANGE_SPACING } from '../constants';
import {
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
    bigIntAbs,
} from '../math';
import { RawOrder, RawPosition, ContractRecord, RawAmm } from '../types';
import { BatchOrderSizeDistribution, FeederType } from '../enum';
import { SynfError } from '../errors/synfError';

export function getLatestFundingIndex(
    amm: RawAmm,
    markPrice: bigint,
    timestamp: number,
): { longFundingIndex: bigint; shortFundingIndex: bigint } {
    return updateFundingIndex(amm, markPrice, timestamp);
}

export function updateFundingIndex(
    amm: RawAmm,
    mark: bigint,
    timestamp: number,
): { longFundingIndex: bigint; shortFundingIndex: bigint } {
    const timeElapsed = timestamp - amm.timestamp;
    if (timeElapsed == 0) return { longFundingIndex: amm.longFundingIndex, shortFundingIndex: amm.shortFundingIndex };
    const fair = sqrtX96ToWad(amm.sqrtPX96);

    const longPayShort = fair > mark;
    const [payerSize, receiverSize] = longPayShort ? [amm.totalLong, amm.totalShort] : [amm.totalShort, amm.totalLong];
    const fundingFeeIndex = frac(bigIntAbs(fair - mark), BigInt(timeElapsed), BigInt(SECS_PER_DAY));
    if (payerSize > 0n) {
        let [payerIndex, receiverIndex] = longPayShort
            ? [amm.longFundingIndex, amm.shortFundingIndex]
            : [amm.shortFundingIndex, amm.longFundingIndex];
        payerIndex = payerIndex - fundingFeeIndex;
        const totalFundingFee = wmul(fundingFeeIndex, payerSize);
        if (receiverSize > 0n) {
            receiverIndex = receiverIndex + wdiv(totalFundingFee, receiverSize);
        }
        return longPayShort
            ? { longFundingIndex: payerIndex, shortFundingIndex: receiverIndex }
            : { longFundingIndex: receiverIndex, shortFundingIndex: payerIndex };
    }
    return { longFundingIndex: amm.longFundingIndex, shortFundingIndex: amm.shortFundingIndex };
}

export function withinOrderLimit(limitPrice: bigint, markPrice: bigint, imr: number): boolean {
    return wdiv(bigIntAbs(limitPrice - markPrice), markPrice) <= r2w(BigInt(imr)) * 2n;
}

export function withinDeviationLimit(fairPrice: bigint, markPrice: bigint, imr: number): boolean {
    return wdiv(bigIntAbs(fairPrice - markPrice), markPrice) <= r2w(BigInt(imr));
}

export function calcBenchmarkPrice(
    expiry: number,
    rawSpotPrice: bigint,
    feederType: FeederType,
    dailyInterestRate: number,
): bigint {
    if (expiry == PERP_EXPIRY) {
        return rawSpotPrice;
    } else {
        const daysLeft =
            Date.now() / 1000 >= expiry ? 0 : Math.floor((expiry * 1000 - Date.now()) / (SECS_PER_DAY * 1000)) + 1;
        if (feederType === FeederType.BOTH_STABLE || feederType === FeederType.NONE_STABLE) {
            return rawSpotPrice;
        } else if (feederType === FeederType.QUOTE_STABLE) {
            return wmulDown(rawSpotPrice, r2w(BigInt(dailyInterestRate))) * BigInt(daysLeft) + rawSpotPrice;
        } else {
            /* else if (this.rootInstrument.instrumentType === FeederType.BASE_STABLE)*/
            const priceChange = wmulDown(rawSpotPrice, r2w(BigInt(dailyInterestRate))) * BigInt(daysLeft);
            return rawSpotPrice > priceChange ? rawSpotPrice - priceChange : 0n;
        }
    }
}

export function calcMinTickDelta(initialMarginRatio: number): number {
    return wadToTick(r2w(BigInt(initialMarginRatio)) + WAD);
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

export function requiredMarginForOrder(limit: bigint, sizeWad: bigint, ratio: number): bigint {
    const marginValue: bigint = wmul(limit, sizeWad);
    const minAmount: bigint = wmulUp(marginValue, r2w(BigInt(ratio)));
    return minAmount;
}

export function fillOrderToPosition(
    pearlNonce: number,
    pearlTaken: bigint,
    pearlFee: bigint,
    pearlSocialLoss: bigint,
    pearlFundingIndex: bigint,
    order: RawOrder,
    tick: number,
    nonce: number,
    fillSize: bigint,
    record: ContractRecord,
): RawPosition {
    if (fillSize === 0n) {
        fillSize = order.size;
    }
    const usize = bigIntAbs(fillSize);
    let makerFee: bigint;
    let entrySocialLossIndex: bigint;
    let entryFundingIndex: bigint;
    if (nonce < pearlNonce) {
        const utaken0 = bigIntAbs(record.taken);
        makerFee = record.taken === fillSize ? record.fee : fracDown(record.fee, usize, utaken0);
        entrySocialLossIndex = record.entrySocialLossIndex;
        entryFundingIndex = record.entryFundingIndex;
    } else {
        const utaken1 = bigIntAbs(pearlTaken);
        makerFee = pearlTaken === fillSize ? pearlFee : fracDown(pearlFee, usize, utaken1);
        entrySocialLossIndex = pearlSocialLoss;
        entryFundingIndex = pearlFundingIndex;
    }
    const srtikePrice = TickMath.getWadAtTick(tick);

    return {
        balance: order.balance + makerFee,
        size: fillSize,
        entryNotional: wmul(srtikePrice, bigIntAbs(fillSize)),
        entrySocialLossIndex: entrySocialLossIndex,
        entryFundingIndex: entryFundingIndex,
    };
}

export function cancelOrderToPosition(
    pearlLeft: bigint,
    pearlNonce: number,
    pearlTaken: bigint,
    pearlFee: bigint,
    pearlSocialLoss: bigint,
    pearlFundingIndex: bigint,
    order: RawOrder,
    tick: number,
    nonce: number,
    record: ContractRecord,
): RawPosition {
    let pic: RawPosition = {
        balance: order.balance,
        size: 0n,
        entryNotional: 0n,
        entrySocialLossIndex: 0n,
        entryFundingIndex: 0n,
    };
    const uleft: bigint = bigIntAbs(pearlLeft);
    const usize: bigint = bigIntAbs(order.size);
    if (uleft < usize) {
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
            order.size - tLeft,
            record,
        );
    }
    // fully cancelled, no position generated
    return pic;
}

export function tally(
    amm: RawAmm,
    position: RawPosition,
    mark: bigint,
): { equity: bigint; pnl: bigint; socialLoss: bigint } {
    let fundingFee: bigint = 0n;
    const value: bigint = wmul(mark, bigIntAbs(position.size));
    const socialLoss: bigint = wmulUp(
        (position.size > 0n ? amm.longSocialLossIndex : amm.shortSocialLossIndex) -
            position.entrySocialLossIndex,
        bigIntAbs(position.size),
    );

    // perp should consider funding fee
    if (amm.expiry === PERP_EXPIRY) fundingFee = calcFundingFee(amm, position);

    const pnl = (position.size > 0n ? value - position.entryNotional : position.entryNotional - value)
        + fundingFee
        - socialLoss;

    const equity = pnl + position.balance;
    return { equity: equity, pnl: pnl, socialLoss: socialLoss };
}

export function calcLiquidationPrice(amm: RawAmm, position: RawPosition, maintenanceMarginRatio = 500): bigint {
    // if LONG:
    // price * size - entryNotional - socialLoss + balance + fundingFee = price * size * mmr
    // price = (entryNotional + socialLoss - balance - fundingFee) / (1 - mmr)*size
    // if SHORT:
    // entryNotional - price * size - socialLoss + balance + fundingFee = price * size * mmr
    // price = (entryNotional - socialLoss + balance + fundingFee) / (1 + mmr)*size
    const socialLoss: bigint = wmulUp(
        (position.size > 0n ? amm.longSocialLossIndex : amm.shortSocialLossIndex) -
            position.entrySocialLossIndex,
        bigIntAbs(position.size),
    );
    const fundingFee = calcFundingFee(amm, position);
    let price: bigint;

    if (position.size > 0n) {
        const numerator = position.entryNotional + socialLoss - position.balance - fundingFee;
        if (numerator <= 0n) return 0n;
        price = wdivDown(numerator, wmulUp(position.size < 0n ? -position.size : position.size, r2w(BigInt(10000 - maintenanceMarginRatio))));
    } else {
        const numerator = position.entryNotional - socialLoss + position.balance + fundingFee;
        if (numerator <= 0n) return 0n; // highly unlikely to happen
        price = wdivUp(numerator, wmulDown(position.size < 0n ? -position.size : position.size, r2w(BigInt(10000 + maintenanceMarginRatio))));
    }
    return price;
}

export function calculatePriceFromPnl(amm: RawAmm, position: RawPosition, pnl: bigint): bigint {
    // if LONG:
    // price = (pnl - fundingFee + socialLoss + entryNotional) / size
    // if SHORT:
    // price = (entryNotional + fundingFee - socialLoss - pnl) / size
    const socialLoss: bigint = wmulUp(
        (position.size > 0n ? amm.longSocialLossIndex : amm.shortSocialLossIndex) -
            position.entrySocialLossIndex,
        bigIntAbs(position.size),
    );
    const fundingFee = calcFundingFee(amm, position);
    const value = position.size > 0n
        ? pnl + socialLoss + position.entryNotional - fundingFee
        : position.entryNotional - socialLoss - pnl + fundingFee;

    return position.size > 0n ? wdivUp(value, bigIntAbs(position.size)) : wdivDown(value, bigIntAbs(position.size));
}

export function calcFundingFee(amm: RawAmm, position: RawPosition): bigint {
    return wmulInt(
        (position.size >= 0n ? amm.longFundingIndex : amm.shortFundingIndex) - position.entryFundingIndex,
        bigIntAbs(position.size),
    );
}

export function calcPnl(amm: RawAmm, position: RawPosition, mark: bigint): bigint {
    return tally(amm, position, mark).pnl;
}

export function realizeFundingWithPnl(amm: RawAmm, pos: RawPosition): { position: RawPosition; pnl: bigint } {
    if (pos.size === 0n) return { position: pos, pnl: 0n };
    const position: RawPosition = Object.assign({}, pos);

    const currentFundingIndex = position.size > 0n ? amm.longFundingIndex : amm.shortFundingIndex;
    let pnl = 0n;
    if (currentFundingIndex !== position.entryFundingIndex) {
        const funding = wmulInt(currentFundingIndex - position.entryFundingIndex, bigIntAbs(position.size));
        pnl = funding;

        position.entryFundingIndex = currentFundingIndex;
        position.balance = position.balance + funding;
    }
    return { position, pnl };
}

export function realizeFundingIncome(amm: RawAmm, pos: RawPosition): RawPosition {
    return realizeFundingWithPnl(amm, pos).position;
}

export function realizeSocialLoss(amm: RawAmm, pos: RawPosition): { position: RawPosition; socialLoss: bigint } {
    pos = { ...pos };
    const long = pos.size > 0n;
    const usize = bigIntAbs(pos.size);
    const socialLossIndex = long ? amm.longSocialLossIndex : amm.shortSocialLossIndex;
    const socialLoss = wmulUp(socialLossIndex - pos.entrySocialLossIndex, usize);
    pos.balance = pos.balance - socialLoss;
    pos.entrySocialLossIndex = socialLossIndex;
    return { position: pos, socialLoss };
}

export function combine(
    amm: RawAmm,
    position_1: RawPosition,
    position_2: RawPosition,
): { position: RawPosition; closedSize: bigint; realized: bigint } {
    let position1 = Object.assign({}, position_1);
    let position2 = Object.assign({}, position_2);
    let realized = 0n;

    if (amm.expiry === PERP_EXPIRY) {
        const { position: realizedPosition1, pnl: realizedPnl1 } = realizeFundingWithPnl(amm, position1);
        const { position: realizedPosition2, pnl: realizedPnl2 } = realizeFundingWithPnl(amm, position2);
        position1 = realizedPosition1;
        position2 = realizedPosition2;
        realized = realized + realizedPnl1;
        realized = realized + realizedPnl2;
    }

    const { position: realizedPosition1, socialLoss: socialLoss1 } = realizeSocialLoss(amm, position1);
    const { position: realizedPosition2, socialLoss: socialLoss2 } = realizeSocialLoss(amm, position2);
    position1 = realizedPosition1;
    position2 = realizedPosition2;
    realized = realized - socialLoss1;
    realized = realized - socialLoss2;

    let pic: RawPosition = {
        balance: 0n,
        size: 0n,
        entryNotional: 0n,
        entrySocialLossIndex: 0n,
        entryFundingIndex: 0n,
    };
    let closedSize = 0n;
    if (position1.size === 0n || position2.size === 0n) {
        pic = position1.size === 0n ? position2 : position1;
        pic.balance = position1.balance + position2.balance;
        return { position: pic, closedSize: closedSize, realized: realized };
    }

    pic.size = position1.size + position2.size;
    if (oppositeSigns(position1.size, position2.size)) {
        closedSize = (position1.size < 0n ? -position1.size : position1.size) < (position2.size < 0n ? -position2.size : position2.size) ? (position1.size < 0n ? -position1.size : position1.size) : (position2.size < 0n ? -position2.size : position2.size);

        const longPic: RawPosition = position1.size > 0n ? position1 : position2;
        const shortPic: RawPosition = position1.size > 0n ? position2 : position1;
        let closedLongNotional: bigint = 0n;
        let closedShortNotional: bigint = 0n;

        if (pic.size > 0n) {
            closedLongNotional = frac(longPic.entryNotional, closedSize, longPic.size < 0n ? -longPic.size : longPic.size);
            closedShortNotional = shortPic.entryNotional;
            pic.entryNotional = longPic.entryNotional - closedLongNotional;
            pic.entrySocialLossIndex = longPic.entrySocialLossIndex;
            pic.entryFundingIndex = longPic.entryFundingIndex;
        } else if (pic.size < 0n) {
            closedLongNotional = longPic.entryNotional;
            closedShortNotional = frac(shortPic.entryNotional, closedSize, shortPic.size < 0n ? -shortPic.size : shortPic.size);
            pic.entryNotional = shortPic.entryNotional - closedShortNotional;
            pic.entrySocialLossIndex = shortPic.entrySocialLossIndex;
            pic.entryFundingIndex = shortPic.entryFundingIndex;
        } else {
            closedLongNotional = longPic.entryNotional;
            closedShortNotional = shortPic.entryNotional;
        }
        const realizedPnl = closedShortNotional - closedLongNotional;
        pic.balance = pic.balance + longPic.balance + shortPic.balance + realizedPnl;
        realized = realized + realizedPnl;
    } else {
        pic.entryNotional = position1.entryNotional + position2.entryNotional;
        pic.entrySocialLossIndex = pic.size > 0n ? amm.longSocialLossIndex : amm.shortSocialLossIndex;
        pic.entryFundingIndex = position1.size > 0n ? amm.longFundingIndex : amm.shortFundingIndex;
        pic.balance = position1.balance + position2.balance;
    }

    return { position: pic, closedSize: closedSize, realized: realized };
}

export function splitPosition(pos: RawPosition, partSize: bigint): { partPos: RawPosition; finalPos: RawPosition } {
    const uFullSize = bigIntAbs(pos.size);
    const uPartSize = bigIntAbs(partSize);

    const partPos = {} as RawPosition;
    const finalPos = pos;

    partPos.size = partSize;
    finalPos.size = pos.size - partSize;

    partPos.balance = frac(pos.balance, uPartSize, uFullSize);
    finalPos.balance = pos.balance - partPos.balance;

    partPos.entryNotional = frac(pos.entryNotional, uPartSize, uFullSize);
    finalPos.entryNotional = pos.entryNotional - partPos.entryNotional;

    partPos.entrySocialLossIndex = pos.entrySocialLossIndex;
    partPos.entryFundingIndex = pos.entryFundingIndex;

    return { partPos, finalPos };
}

export function entryDelta(
    sqrtEntryPX96: bigint,
    tickLower: number,
    tickUpper: number,
    entryMargin: bigint,
    initialMarginRatio: number,
): { deltaBase: bigint; deltaQuote: bigint; liquidity: bigint } {
    const upperPX96 = TickMath.getSqrtRatioAtTick(tickUpper);
    const lowerPX96 = TickMath.getSqrtRatioAtTick(tickLower);
    const liquidityByUpper = getLiquidityFromMarginByUpper(sqrtEntryPX96, upperPX96, entryMargin, initialMarginRatio);
    const liquidityByLower = getLiquidityFromMarginByLower(sqrtEntryPX96, lowerPX96, entryMargin, initialMarginRatio);
    const liquidity = liquidityByUpper < liquidityByLower ? liquidityByUpper : liquidityByLower;
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
    sqrtEntryPX96: bigint,
    sqrtUpperPX96: bigint,
    entryMargin: bigint,
    initialMarginRatio: number,
): bigint {
    const numerator = (entryMargin * sqrtEntryPX96) / (sqrtUpperPX96 - sqrtEntryPX96);
    const denominator = (sqrtUpperPX96 - sqrtEntryPX96) + wmulUp(sqrtUpperPX96, r2w(BigInt(initialMarginRatio)));
    return (numerator * Q96) / denominator;
}

export function getLiquidityFromMarginByLower(
    sqrtEntryPX96: bigint,
    sqrtLowerPX96: bigint,
    entryMargin: bigint,
    initialMarginRatio: number,
): bigint {
    const numerator = (entryMargin * sqrtEntryPX96) / (sqrtEntryPX96 - sqrtLowerPX96);
    const denominator = (sqrtEntryPX96 - sqrtLowerPX96) + wmulUp(sqrtLowerPX96, r2w(BigInt(initialMarginRatio)));
    return (numerator * Q96) / denominator;
}

export function getMarginFromLiquidity(
    sqrtEntryPX96: bigint,
    tickUpper: number,
    liquidity: bigint,
    initialMarginRatio: number,
): bigint {
    const sqrtUpperPX96 = TickMath.getSqrtRatioAtTick(tickUpper);
    const denominator = wmulUp(sqrtUpperPX96, r2w(BigInt(10000 + initialMarginRatio))) - sqrtEntryPX96;
    const temp = (liquidity * denominator) / Q96;
    return (temp * (sqrtUpperPX96 - sqrtEntryPX96)) / sqrtEntryPX96;
}
