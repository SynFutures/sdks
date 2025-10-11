export const NEGATIVE_ONE = BigInt(-1);
export const ZERO = BigInt(0);
export const ONE = BigInt(1);
export const TWO = BigInt(2);

export const Q24 = TWO ** BigInt(24);
export const Q32 = TWO ** BigInt(32);
export const Q96 = TWO ** BigInt(96);
export const Q192 = TWO ** BigInt(192);
export const WAD = BigInt(10) ** BigInt(18);

export const ADDRESS_ZERO = '0x0000000000000000000000000000000000000000';

export const MAX_UINT_256 = BigInt('0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff');
export const MAX_UINT_128 = TWO ** BigInt(128) - ONE;
export const MAX_UINT_64 = TWO ** BigInt(64) - ONE;
export const MAX_UINT_32 = TWO ** BigInt(32) - ONE;
export const MAX_UINT_24 = TWO ** BigInt(24) - ONE;
export const MAX_UINT_16 = TWO ** BigInt(16) - ONE;
export const MAX_UINT_8 = TWO ** BigInt(8) - ONE;
export const MAX_UINT_160 = TWO ** BigInt(160) - ONE;
export const MAX_INT_24 = TWO ** BigInt(23) - ONE;

export const POWERS_OF_2 = [128, 64, 32, 16, 8, 4, 2, 1].map((pow: number): [number, bigint] => [pow, TWO ** BigInt(pow)]);

export const MAX_SAFE_INTEGER = BigInt(String(Number.MAX_SAFE_INTEGER));

export const TICK_DELTA_MAX = 16096; // 1.0001 ** 16096 = 5.0004080813

// uint48(uint24(type(int24).min)) << 24 | uint48(uint24(type(int24).max))
// which is (2 ** 24 + type(int24).min) * (2 ** 24) + type(int24).max
export const ANY_PRICE_TICK = BigInt(140737496743935);

export const EMPTY_TICK = TWO ** BigInt(23) - ONE; // type(int24).max
