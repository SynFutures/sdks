import { Q96, Q32, WAD } from './constants';
import { mulDiv, sqrt, wmul, mostSignificantBit, mulShift, asInt256, asUint256, forceAsInt24 } from './basic';
import { CalculationError } from '../types/error';

// Constants moved from tick.ts
export const MIN_TICK = -322517;
export const MAX_TICK = 443636;
export const MIN_SQRT_RATIO = BigInt('7867958450021363558555');
export const MAX_SQRT_RATIO = BigInt('340275971719517849884101479065584693834');

function checkTick(tick: number): void {
    if (!Number.isInteger(tick) || tick < MIN_TICK || tick > MAX_TICK) {
        throw new CalculationError('TICK', { tick });
    }
}

function signedShr(number: bigint, bits: number): bigint {
    const negative = number < 0n;
    const tmp = negative ? asUint256(number) : number;
    return tmp >> BigInt(bits);
}

export function r2w(value: bigint | number | string): bigint {
    return BigInt(value) * 10n ** 14n;
}

export function s2w(value: bigint | number | string): bigint {
    return BigInt(value) * 10n ** 16n;
}

export function d2w(value: bigint, decimals: number): bigint {
    return value * 10n ** BigInt(18 - decimals);
}

export function w2d(value: bigint, decimals: number): bigint {
    return wmul(value, 10n ** BigInt(decimals));
}

export function sqrtX96ToWad(sqrtPX96: bigint): bigint {
    const px96 = mulDiv(sqrtPX96, sqrtPX96, Q96);
    return mulDiv(px96, WAD, Q96);
}

export function wadToSqrtX96(price: bigint): bigint {
    const x96 = (price * Q96) / WAD;
    return sqrt(x96 * Q96);
}

export function tickToSqrtX96(tick: number): bigint {
    checkTick(tick);
    const absTick = tick < 0 ? -tick : tick;

    const MAGIC = [
        '0xfffcb933bd6fad37aa2d162d1a594001',
        '0xfff97272373d413259a46990580e213a',
        '0xfff2e50f5f656932ef12357cf3c7fdcc',
        '0xffe5caca7e10e4e61c3624eaa0941cd0',
        '0xffcb9843d60f6159c9db58835c926644',
        '0xff973b41fa98c081472e6896dfb254c0',
        '0xff2ea16466c96a3843ec78b326b52861',
        '0xfe5dee046a99a2a811c461f1969c3053',
        '0xfcbe86c7900a88aedcffc83b479aa3a4',
        '0xf987a7253ac413176f2b074cf7815e54',
        '0xf3392b0822b70005940c7a398e4b70f3',
        '0xe7159475a2c29b7443b29c7fa6e889d9',
        '0xd097f3bdfd2022b8845ad8f792aa5825',
        '0xa9f746462d870fdf8a65dc1f90e061e5',
        '0x70d869a156d2a1b890bb3df62baf32f7',
        '0x31be135f97d08fd981231505542fcfa6',
        '0x9aa508b5b7a84e1c677de54f3e99bc9',
        '0x5d6af8dedb81196699c329225ee604',
        '0x2216e584f5fa1ea926041bedfe98',
        '0x48a170391f7dc42444e8fa2',
    ].map((value) => BigInt(value));

    let ratio = (absTick & 0x1) !== 0 ? MAGIC[0] : BigInt('0x100000000000000000000000000000000');
    for (let i = 1, bit = 0x2; i < MAGIC.length; i += 1, bit <<= 1) {
        if ((absTick & bit) !== 0) {
            ratio = mulShift(ratio, MAGIC[i].toString());
        }
    }

    if (tick > 0) {
        ratio = ((1n << 256n) - 1n) / ratio;
    }

    return ratio % Q32 > 0n ? ratio / Q32 + 1n : ratio / Q32;
}

export function sqrtX96ToTick(sqrtRatioX96: bigint): number {
    if (sqrtRatioX96 < MIN_SQRT_RATIO || sqrtRatioX96 >= MAX_SQRT_RATIO) {
        throw new CalculationError('SQRT_RATIO', { sqrtRatioX96 });
    }

    const sqrtRatioX128 = sqrtRatioX96 << 32n;
    const msb = mostSignificantBit(sqrtRatioX128);

    let r: bigint;
    if (msb >= 128) {
        r = sqrtRatioX128 >> BigInt(msb - 127);
    } else {
        r = sqrtRatioX128 << BigInt(127 - msb);
    }

    let log2 = BigInt(msb - 128) << 64n;
    let unsignedLog2 = asUint256(log2);

    for (let i = 0; i < 14; i++) {
        r = (r * r) >> 127n;
        const f = r >> 128n;
        unsignedLog2 |= f << BigInt(63 - i);
        r >>= f;
    }

    log2 = asInt256(unsignedLog2);
    const logSqrt10001 = log2 * BigInt('255738958999603826347141');

    const tickLow = Number(
        forceAsInt24(signedShr(logSqrt10001 - BigInt('3402992956809132418596140100660247210'), 128))
    );
    const tickHigh = Number(
        forceAsInt24(signedShr(logSqrt10001 + BigInt('291339464771989622907027621153398088495'), 128))
    );

    return tickLow === tickHigh ? tickLow : tickToSqrtX96(tickHigh) <= sqrtRatioX96 ? tickHigh : tickLow;
}

export function tickToWad(tick: number): bigint {
    return sqrtX96ToWad(tickToSqrtX96(tick));
}

export function wadToTick(priceWad: bigint): number {
    return sqrtX96ToTick(wadToSqrtX96(priceWad));
}