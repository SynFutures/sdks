/**
 * Basic math operations for bigint and numeric types
 */

import { CalculationError } from '../types/error';
import {
    MAX_INT_24,
    MAX_SAFE_INTEGER,
    MAX_UINT_128,
    MAX_UINT_16,
    MAX_UINT_256,
    MAX_UINT_32,
    MAX_UINT_64,
    MAX_UINT_8,
    ONE,
    POWERS_OF_2,
    TWO,
    WAD,
    ZERO,
} from './constants';

function assertMath(condition: boolean, message: string, details?: Record<string, unknown>): void {
    if (!condition) {
        throw new CalculationError(message, details);
    }
}

// ============================================================================
// Numeric Conversions
// ============================================================================

export function asUint16(x: number): number {
    return x < 0 ? x + (1 << 16) : x;
}

export function asInt24(x: number): number {
    const maxInt24 = (1 << 23) - 1;
    return x > maxInt24 ? x - (1 << 24) : x;
}

export function asUint24(x: number): number {
    return x < 0 ? x + (1 << 24) : x;
}

export function asUint48(x: number): number {
    return x < 0 ? x + (1 << 48) : x;
}

export function asUint128(x: bigint): bigint {
    return x < 0n ? x + (ONE << 128n) : x;
}

export function asUint256(x: bigint): bigint {
    return x < 0n ? x + (ONE << 256n) : x;
}

export function forceAsInt24(x: bigint): bigint {
    const mask = (ONE << 24n) - ONE;
    let value = x & mask;
    if (value > MAX_INT_24) {
        value -= ONE << 24n;
    }
    return value;
}

export function asInt256(x: bigint): bigint {
    const maxInt256 = (ONE << 255n) - ONE;
    return x > maxInt256 ? x - (ONE << 256n) : x;
}

export function asInt128(x: bigint): bigint {
    const maxInt128 = (ONE << 127n) - ONE;
    return x > maxInt128 ? x - (ONE << 128n) : x;
}

// ============================================================================
// Shift Operations
// ============================================================================

function checkShiftAmount(n: number) {
    if (n < 0) {
        throw new Error("Shift amount 'n' must be a non-negative number for shift operations.");
    }
    if (n > 53) {
        throw new Error("Shift amount 'n' must be less than 53 for shift operations to avoid precision loss.");
    }
    if (Math.pow(2, n) > Number.MAX_SAFE_INTEGER) {
        throw new Error("Shift amount 'n' is too large for shift operations.");
    }
}

export function shiftLeft(x: number, n: number): number {
    checkShiftAmount(n);
    return x * Math.pow(2, n);
}

export function shiftRight(x: number, n: number): number {
    checkShiftAmount(n);
    return Math.floor(x / Math.pow(2, n));
}

// ============================================================================
// BigInt Operations
// ============================================================================

export function mulDivRoundingUp(a: bigint, b: bigint, denominator: bigint): bigint {
    assertMath(denominator !== ZERO, 'DIVISION_BY_ZERO');
    const product = a * b;
    let result = product / denominator;
    if (product % denominator !== ZERO) {
        result += ONE;
    }
    return result;
}

export function mulShift(value: bigint, mulBy: string): bigint {
    return (value * BigInt(mulBy)) >> 128n;
}

export function multiplyIn256(x: bigint, y: bigint): bigint {
    return (x * y) & MAX_UINT_256;
}

export function addIn256(x: bigint, y: bigint): bigint {
    return (x + y) & MAX_UINT_256;
}

export function max(left: bigint, right: bigint): bigint {
    return left > right ? left : right;
}

export function min(left: bigint, right: bigint): bigint {
    return left > right ? right : left;
}

export function wmulInt(x: bigint, y: bigint): bigint {
    const HALF_WAD = WAD / 2n;
    let product = x * y;
    product += product < ZERO ? -HALF_WAD : HALF_WAD;
    return product / WAD;
}

export function mostSignificantBit(value: bigint): number {
    assertMath(value > ZERO, 'ZERO');
    assertMath(value <= MAX_UINT_256, 'MAX');

    let msb = 0;
    let cursor = value;
    for (const [power, threshold] of POWERS_OF_2) {
        if (cursor >= threshold) {
            cursor >>= BigInt(power);
            msb += power;
        }
    }
    return msb;
}

export function sqrt(value: bigint): bigint {
    assertMath(value >= ZERO, 'NEGATIVE');
    if (value <= MAX_SAFE_INTEGER) {
        return BigInt(Math.floor(Math.sqrt(Number(value))));
    }

    let z = value;
    let x = value / TWO + ONE;
    while (x < z) {
        z = x;
        x = (value / x + x) / TWO;
    }
    return z;
}

export function signedDiv(x: number, y: number): number {
    return (x - (x % y)) / y;
}

export function frac(x: bigint, y: bigint, w: bigint): bigint {
    return (x * y + w / TWO) / w;
}

export function fracUp(x: bigint, y: bigint, w: bigint): bigint {
    return (x * y + (w - ONE)) / w;
}

export function fracDown(x: bigint, y: bigint, w: bigint): bigint {
    return (x * y) / w;
}

export function wdiv(x: bigint, y: bigint): bigint {
    return frac(x, WAD, y);
}

export function wdivUp(x: bigint, y: bigint): bigint {
    return fracUp(x, WAD, y);
}

export function wdivDown(x: bigint, y: bigint): bigint {
    return fracDown(x, WAD, y);
}

export function wmul(x: bigint, y: bigint): bigint {
    return frac(x, y, WAD);
}

export function wmulUp(x: bigint, y: bigint): bigint {
    return fracUp(x, y, WAD);
}

export function wmulDown(x: bigint, y: bigint): bigint {
    return fracDown(x, y, WAD);
}

export function mulDiv(x: bigint, y: bigint, d: bigint): bigint {
    return (x * y) / d;
}

export function leastSignificantBit(value: bigint): number {
    let r = 255;
    let cursor = value;
    if ((cursor & MAX_UINT_128) !== ZERO) {
        r -= 128;
    } else {
        cursor >>= 128n;
    }
    if ((cursor & MAX_UINT_64) !== ZERO) {
        r -= 64;
    } else {
        cursor >>= 64n;
    }
    if ((cursor & MAX_UINT_32) !== ZERO) {
        r -= 32;
    } else {
        cursor >>= 32n;
    }
    if ((cursor & MAX_UINT_16) !== ZERO) {
        r -= 16;
    } else {
        cursor >>= 16n;
    }
    if ((cursor & MAX_UINT_8) !== ZERO) {
        r -= 8;
    } else {
        cursor >>= 8n;
    }
    if ((cursor & 0xfn) !== ZERO) {
        r -= 4;
    } else {
        cursor >>= 4n;
    }
    if ((cursor & 0x3n) !== ZERO) {
        r -= 2;
    } else {
        cursor >>= 2n;
    }
    if ((cursor & ONE) !== ZERO) {
        r -= 1;
    }
    return r;
}

export function leastNonnegativeRemainder(x: number, modulus: number): number {
    return ((x % modulus) + modulus) % modulus;
}

export function leastNonnegativeComplement(x: number, modulus: number): number {
    return (modulus - (x % modulus)) % modulus;
}

export function abs(value: bigint): bigint {
    return value < ZERO ? -value : value;
}

export function mulDivNearest(x: bigint, y: bigint, denominator: bigint): bigint {
    if (denominator === ZERO) {
        throw new Error('Division by zero in mulDivNearest');
    }
    const product = x * y;
    const half = denominator >> 1n;
    return (product >= ZERO ? product + half : product - half) / denominator;
}

export function proportion(value: bigint, part: bigint, total: bigint): bigint {
    if (total === ZERO) return ZERO;
    return mulDivNearest(value, part, total);
}
