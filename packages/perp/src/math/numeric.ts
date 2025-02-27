import { BigNumber, ethers } from 'ethers';
import { MAX_INT_24, ONE } from './constants';

export function asUint16(x: number): number {
    if (x < 0) {
        x += 1 << 16;
    }
    return x;
}

export function asInt24(x: number): number {
    const MAX_INT_24 = (1 << 23) - 1;
    if (x > MAX_INT_24) {
        x -= 1 << 24;
    }
    return x;
}

export function asUint24(x: number): number {
    if (x < 0) {
        x += 1 << 24;
    }
    return x;
}

export function asUint48(x: number): number {
    if (x < 0) {
        x += 1 << 48;
    }
    return x;
}

export function asUint96(x: BigNumber): BigNumber {
    if (x.isNegative()) {
        x = x.add(ONE.shl(96));
    }
    return x;
}

export function asUint128(x: BigNumber): BigNumber {
    if (x.isNegative()) {
        x = x.add(ONE.shl(128));
    }
    return x;
}

export function asUint256(x: BigNumber): BigNumber {
    if (x.isNegative()) {
        x = x.add(ONE.shl(256));
    }
    return x;
}

///@dev force x to be int24
/// x must be positive
export function forceAsInt24(x: BigNumber): BigNumber {
    x = x.and(ONE.shl(24).sub(ONE));
    if (x.gt(MAX_INT_24)) {
        x = x.sub(ONE.shl(24));
    }
    return x;
}

export function asInt256(x: BigNumber): BigNumber {
    if (x.gt(ethers.constants.MaxInt256)) {
        x = x.sub(ONE.shl(256));
    }
    return x;
}

export function asInt128(x: BigNumber): BigNumber {
    const MAX_INT_128 = ONE.shl(127).sub(ONE);
    if (x.gt(MAX_INT_128)) {
        x = x.sub(ONE.shl(128));
    }
    return x;
}

export function decompose(tick: number): { wordPos: number; bitPos: number } {
    const wordPos = tick >> 8;
    // Note that in JavaScript, -258 % 256 is -2, while we want 254.
    let bitPos = tick % 256;
    if (bitPos < 0) bitPos += 256;
    return { wordPos, bitPos };
}

export abstract class NumericConverter {
    static scaleQuoteAmount(amount: BigNumber, quoteDecimals: number): BigNumber {
        const quoteAmountScaler = BigNumber.from(10).pow(18 - quoteDecimals);
        return amount.mul(quoteAmountScaler);
    }

    static toContractQuoteAmount(amount: BigNumber, quoteDecimals: number): BigNumber {
        const quoteAmountScaler = BigNumber.from(10).pow(18 - quoteDecimals);
        return amount.div(quoteAmountScaler);
    }

    static toContractRatio(ratioWad: BigNumber): number {
        return ratioWad.div(BigNumber.from(10).pow(14)).toNumber();
    }
}
