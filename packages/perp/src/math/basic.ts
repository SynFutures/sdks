// basic math calculations
// Removed BigNumber import, using native bigint
import { solidityRequire } from '../utils';
import { TickMath } from './tickMath';
import { ONE_RATIO, PEARL_SPACING, RATIO_DECIMALS } from '../constants';
import { FundFlow, Pending } from '../types';
import {
    MAX_UINT_256,
    POWERS_OF_2,
    ONE,
    ZERO,
    TWO,
    MAX_SAFE_INTEGER,
    WAD,
    MAX_UINT_128,
    MAX_UINT_64,
    MAX_UINT_32,
    MAX_UINT_16,
    MAX_UINT_8,
    Q96,
} from './constants';
import { CalculationError } from '../errors/calculationError';

// Helper functions for bigint operations
export function bigIntAbs(x: bigint): bigint {
    return x < 0n ? -x : x;
}

export function bigIntNeg(x: bigint): bigint {
    return ZERO - x;
}

export function mulDivRoundingUp(a: bigint, b: bigint, denominator: bigint): bigint {
    const product = a * b;
    let result = product / denominator;
    if (product % denominator !== ZERO) result = result + ONE;
    return result;
}

export function mulShift(val: bigint, mulBy: string): bigint {
    return (val * BigInt(mulBy)) >> BigInt(128);
}

export function multiplyIn256(x: bigint, y: bigint): bigint {
    return (x * y) & MAX_UINT_256;
}

export function addIn256(x: bigint, y: bigint): bigint {
    return (x + y) & MAX_UINT_256;
}

export function oppositeSigns(x: bigint, y: bigint): boolean {
    return (x * y) < ZERO;
}

export function mostSignificantBit(x: bigint): number {
    solidityRequire(x > 0n, 'ZERO');
    solidityRequire(x <= MAX_UINT_256, 'MAX');

    let msb = 0;
    for (const [power, min] of POWERS_OF_2) {
        if (x >= min) {
            x = x >> BigInt(power);
            msb += power;
        }
    }
    return msb;
}

export function sqrt(value: bigint): bigint {
    solidityRequire(value >= 0n, 'NEGATIVE');

    // rely on built in sqrt if possible
    if (value < MAX_SAFE_INTEGER) {
        return BigInt(Math.floor(Math.sqrt(Number(value))));
    }
    let z: bigint;
    let x: bigint;
    z = value;
    x = (value / TWO) + ONE;
    while (x < z) {
        z = x;
        x = ((value / x) + x) / TWO;
    }
    return z;
}

export function roundHalfUp(x: bigint, y: bigint): bigint {
    const z = y / TWO;
    if (x > 0n) {
        return x + z;
    }
    return x - z;
}

export function neg(x: bigint): bigint {
    return ZERO - x;
}

// simulate the '/' operator for signed number in Solidity language.
// This function only consider that y is positive.
// (13, 5) => 2
// (15, 5) => 3
// (17, 5) => 3
// (-13, 5) => -2
// (-15, 5) => -3
// (-17, 5) => -3
// Note that the 'x.div(y)' method of BigNumber also behave like above.
export function signedDiv(x: number, y: number): number {
    return (x - (x % y)) / y;
}

// division for unsigned WAD number, rounding to nearest
export function wdiv(x: bigint, y: bigint): bigint {
    return frac(x, WAD, y);
}

// division for unsigned WAD number, rounding to nearest
export function safeWDiv(x: bigint, y: bigint): bigint {
    if (y === ZERO) return ZERO;
    return frac(x, WAD, y);
}

// division for unsigned WAD number, rounding up
export function wdivUp(x: bigint, y: bigint): bigint {
    return fracUp(x, WAD, y);
}

// division for unsigned WAD number, rounding down
export function wdivDown(x: bigint, y: bigint): bigint {
    return fracDown(x, WAD, y);
}

// multiplication for unsigned WAD number, rounding to nearest
export function wmul(x: bigint, y: bigint): bigint {
    return frac(x, y, WAD);
}

// multiplication for signed WAD number, rounding to nearest
// equivalent to LibMathSigned.wmul(int, int)
export function wmulInt(x: bigint, y: bigint): bigint {
    let product = x * y;
    if (product < 0n) {
        product = product - (WAD / TWO);
    } else {
        product = product + (WAD / TWO);
    }
    return product / WAD;
}

// multiplication for unsigned WAD number, rounding up
export function wmulUp(x: bigint, y: bigint): bigint {
    return fracUp(x, y, WAD);
}

// multiplication for unsigned WAD number, rounding down
export function wmulDown(x: bigint, y: bigint): bigint {
    return fracDown(x, y, WAD);
}

// multiplication & division
// z = x * y / w, rounding up
export function fracUp(x: bigint, y: bigint, w: bigint): bigint {
    const prod = (x * y) + (w - ONE); // (x * y + w - 1)
    return prod / w; // (x * y + w - 1) / w
}

// multiplication & division
// z = x * y / w, rounding up
export function fracDown(x: bigint, y: bigint, w: bigint): bigint {
    return (x * y) / w;
}

// multiplication & division
// z = x * y / w, rounding to nearest
export function frac(x: bigint, y: bigint, w: bigint): bigint {
    const prod = (x * y) + (w / TWO); // (x * y + w / 2)
    return prod / w; // (x * y + w / 2) / w
}

export function weightedAverage(w1: bigint, x1: bigint, w2: bigint, x2: bigint): bigint {
    return ((x1 * w1) + (x2 * w2)) / (w1 + w2);
}

// convert config ratio(r) to Wad(w)
// eg: 1000 => 1000 * 10 ** 18 / 10 ** 4
export function r2w(x: bigint): bigint {
    return x * BigInt(10) ** BigInt(14);
}

export function s2w(x: bigint): bigint {
    return x * BigInt(10) ** BigInt(16);
}

export function d2w(x: bigint, decimals: number): bigint {
    return x * BigInt(10) ** BigInt(18 - decimals);
}

export function w2d(x: bigint, decimals: number): bigint {
    return wmul(x, BigInt(10) ** BigInt(decimals));
}

export function mulMod(x: bigint, y: bigint, d: bigint): bigint {
    return ((x % d) * (y % d)) % d;
}

export function fullMul(x: bigint, y: bigint): { l: bigint; h: bigint } {
    const mm = mulMod(x, y, MAX_UINT_256);
    const l = x * y;
    let h = mm - l;
    if (mm < l) {
        h = h - ONE;
    }
    return { l, h };
}

export function fullDiv(l: bigint, h: bigint, d: bigint): bigint {
    const negd = MAX_UINT_256 - d + ONE;
    const pow2 = d & negd;
    d = d / pow2;
    l = l / pow2;
    const negPow2 = MAX_UINT_256 - pow2 + ONE;
    l = l + (h * (negPow2 / pow2 + ONE));
    let r = ONE;
    for (let i = 0; i < 8; i++) {
        r = r * (TWO - (d * r));
    }
    return l * r;
}

export function mulDiv(x: bigint, y: bigint, d: bigint): bigint {
    let { l: _l, h: _h } = fullMul(x, y);
    const mm = mulMod(x, y, d);
    if (mm > _l) {
        _h = _h - ONE;
    }
    _l = _l - mm;
    return fullDiv(_l, _h, d);
}

export function sqrtX96ToWad(sqrtPX96: bigint): bigint {
    const px96 = mulDiv(sqrtPX96, sqrtPX96, Q96);
    return mulDiv(px96, WAD, Q96);
}

export function wadToSqrtX96(price: bigint): bigint {
    const x96 = (price * Q96) / WAD;
    return sqrt(x96 * Q96);
}

export function wadToTick(price: bigint): number {
    const sqrtX96 = wadToSqrtX96(price);
    return TickMath.getTickAtSqrtRatio(sqrtX96);
}

export function leastSignificantBit(x: bigint): number {
    let r = 255;
    if ((x & MAX_UINT_128) > ZERO) {
        r -= 128;
    } else {
        x = x >> BigInt(128);
    }
    if ((x & MAX_UINT_64) > ZERO) {
        r -= 64;
    } else {
        x = x >> BigInt(64);
    }
    if ((x & MAX_UINT_32) > ZERO) {
        r -= 32;
    } else {
        x = x >> BigInt(32);
    }
    if ((x & MAX_UINT_16) > ZERO) {
        r -= 16;
    } else {
        x = x >> BigInt(16);
    }
    if ((x & MAX_UINT_8) > ZERO) {
        r -= 8;
    } else {
        x = x >> BigInt(8);
    }
    if ((x & BigInt('0xf')) > ZERO) {
        r -= 4;
    } else {
        x = x >> BigInt(4);
    }
    if ((x & BigInt('0x3')) > ZERO) {
        r -= 2;
    } else {
        x = x >> BigInt(2);
    }
    if ((x & BigInt('0x1')) > ZERO) r -= 1;
    return r;
}

export function leastNonnegativeRemainder(x: number, modulus: number): number {
    return ((x % modulus) + modulus) % modulus;
}

export function leastNonnegativeComplement(x: number, modulus: number): number {
    return (modulus - (x % modulus)) % modulus;
}

export function maxAmongThree(a: bigint, b: bigint, c: bigint): bigint {
    return (a > b ? a : b) > c ? (a > b ? a : b) : c;
}

export function max(left: bigint, right: bigint): bigint {
    return left > right ? left : right;
}

export function min(left: bigint, right: bigint): bigint {
    return left > right ? right : left;
}

export function relativeDiffRatioWadAbs(wadA: bigint, wadB: bigint): bigint {
    return wdivUp(bigIntAbs(wadA - wadB), wadA < wadB ? wadA : wadB);
}

export function getOrderLeverageByMargin(targetTick: number, baseSize: bigint, margin: bigint): bigint {
    return wdiv(wmul(TickMath.getWadAtTick(targetTick), bigIntAbs(baseSize)), margin);
}

export function getMaxLeverage(imr: number): number {
    return 1 / (imr / 10 ** RATIO_DECIMALS);
}

export function getMinOrderMargin(
    targetPrice: bigint,
    markPrice: bigint,
    baseSize: bigint,
    imr: number,
    slippage = 50,
) {
    const minMargin = wmulUp(
        r2w(BigInt(imr)),
        wmulUp(
            max(
                (markPrice * BigInt(ONE_RATIO + slippage)) / BigInt(ONE_RATIO), // add slippage
                targetPrice,
            ),
            baseSize,
        ),
    );

    return minMargin;
}

export function calcMaxWithdrawable(
    threshold: bigint,
    pending: Pending,
    fundFlow: FundFlow,
    reserve: bigint,
): bigint {
    // exceed threshold condition
    // totalOut - totalIn + amount + quantity > threshold + exemption
    // quantity = threshold + exemption - totalOut + totalIn - amount
    const maxWithdrawable = threshold
        + pending.exemption
        - fundFlow.totalOut
        + fundFlow.totalIn
        - pending.amount;
    // should be capped by 0 and reserve
    if (maxWithdrawable <= 0n) return ZERO;
    if (maxWithdrawable > reserve) return reserve;
    return maxWithdrawable;
}

export function alignPriceToTick(price: bigint): { tick: number; price: bigint } {
    let tick = wadToTick(price);
    tick = Math.round(tick / PEARL_SPACING) * PEARL_SPACING;

    const alignedprice = TickMath.getWadAtTick(tick);
    return { tick: tick, price: alignedprice };
}

export function calcBoost(alpha: number, imr: number): number {
    if (alpha === 1) {
        throw new CalculationError('Invalid alpha', { alpha });
    }
    imr = imr / 10 ** RATIO_DECIMALS;
    return -2 / (alpha * (imr + 1) - Math.sqrt(alpha)) / (1 / Math.sqrt(alpha) - 1);
}

export function calcAsymmetricBoost(alphaLower: number, alphaUpper: number, imr: number): number {
    if (alphaLower === 1 && alphaUpper === 1) {
        throw new CalculationError('Invalid alpha and beta', { alphaLower, alphaUpper, imr });
    }
    imr = imr / 10 ** RATIO_DECIMALS;
    const boostLower = 2 / (1 / Math.sqrt(alphaLower) - 1) / ((1 / Math.sqrt(alphaLower)) * (1 - imr) - 1);
    const boostUpper = calcBoost(alphaUpper, imr);
    return Math.min(boostLower, boostUpper);
}