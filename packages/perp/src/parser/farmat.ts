import { ethers, BigNumber, BigNumberish } from 'ethers';
import { formatWad } from '@derivation-tech/context';
import { EmaParamStruct } from '../typechain/CexMarket';
import { s2w, MAX_UINT_24, MAX_UINT_16, sqrtX96ToWad, TickMath } from '../math';
import { MIN_TICK, MAX_TICK } from '../constants';

export function formatRatio(value: BigNumberish): string {
    return ethers.utils.formatUnits(BigNumber.from(value), 2) + '%';
}

export function formatCompactEmaParam(data: BigNumberish): string {
    return formatEmaParam(decodeEmaParam(BigNumber.from(data)));
}

export function formatEmaParam(ema: EmaParamStruct): string {
    return Object.entries(ema)
        .map(([k, v]) => {
            if (k === 'maxChangeRatioPerSecond') {
                return ` ${k}: ${formatRatio(BigNumber.from(v))}`;
            } else {
                return ` ${k}: ${v.toString()}`;
            }
        })
        .toString();
}

export function decodeEmaParam(encoded: BigNumber): EmaParamStruct {
    return {
        emaHalfTime: encoded.shr(48).and(0xffff),
        maxTimeDelta: encoded.shr(32).and(0xffff),
        maxRawTimeDelta: encoded.shr(16).and(0xffff),
        maxChangeRatioPerSecond: encoded.and(0xffff),
    };
}

export function formatTimestamp(value: BigNumberish): string {
    return new Date(BigNumber.from(value).mul(1000).toNumber()).toISOString();
}

export function extractFeeRatioParams(stabilityFeeRatioParam: BigNumber): BigNumber[] {
    const ret: BigNumber[] = [];
    ret.push(s2w(stabilityFeeRatioParam.and(MAX_UINT_24)));
    ret.push(s2w(stabilityFeeRatioParam.shr(24).and(MAX_UINT_16)));
    ret.push(s2w(stabilityFeeRatioParam.shr(40).and(MAX_UINT_16)));
    ret.push(s2w(stabilityFeeRatioParam.shr(56)));
    return ret;
}

export function formatSqrtPX96(sqrtPX96: BigNumberish, fixedDecimals = 6): string {
    return formatWad(sqrtX96ToWad(sqrtPX96), fixedDecimals);
}

export function formatTick(tick: number): string {
    if (tick < MIN_TICK) {
        return 'MIN_TICK';
    } else if (tick > MAX_TICK) {
        return 'MAX_TICK';
    } else {
        return `${tick}(${formatSqrtPX96(TickMath.getSqrtRatioAtTick(tick))})`;
    }
}
