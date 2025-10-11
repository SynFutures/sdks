import { ethers } from 'ethers';
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

export function asUint96(x: bigint): bigint {
    if (x < 0n) {
        x = x + (ONE << BigInt(96));
    }
    return x;
}

export function asUint128(x: bigint): bigint {
    if (x < 0n) {
        x = x + (ONE << BigInt(128));
    }
    return x;
}

export function asUint256(x: bigint): bigint {
    if (x < 0n) {
        x = x + (ONE << BigInt(256));
    }
    return x;
}

///@dev force x to be int24
/// x must be positive
export function forceAsInt24(x: bigint): bigint {
    x = x & ((ONE << BigInt(24)) - ONE);
    if (x > MAX_INT_24) {
        x = x - (ONE << BigInt(24));
    }
    return x;
}

export function asInt256(x: bigint): bigint {
    if (x > ethers.constants.MaxInt256.toBigInt()) {
        x = x - (ONE << BigInt(256));
    }
    return x;
}

export function asInt128(x: bigint): bigint {
    const MAX_INT_128 = (ONE << BigInt(127)) - ONE;
    if (x > MAX_INT_128) {
        x = x - (ONE << BigInt(128));
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
    static scaleQuoteAmount(amount: bigint, quoteDecimals: number): bigint {
        const quoteAmountScaler = BigInt(10) ** BigInt(18 - quoteDecimals);
        return amount * quoteAmountScaler;
    }

    static toContractQuoteAmount(amount: bigint, quoteDecimals: number): bigint {
        const quoteAmountScaler = BigInt(10) ** BigInt(18 - quoteDecimals);
        return amount / quoteAmountScaler;
    }

    static toContractRatio(ratioWad: bigint): number {
        return Number(ratioWad / (BigInt(10) ** BigInt(14)));
    }
}
