// Native bigint equivalents of the legacy math constants.

export const NEGATIVE_ONE = -1n;
export const ZERO = 0n;
export const ONE = 1n;
export const TWO = 2n;

export const Q24 = ONE << 24n;
export const Q32 = ONE << 32n;
export const Q96 = ONE << 96n;
export const Q192 = ONE << 192n;
export const WAD = 10n ** 18n;

export const ADDRESS_ZERO = '0x0000000000000000000000000000000000000000';

export const MAX_UINT_256 = (ONE << 256n) - ONE;
export const MAX_UINT_160 = (ONE << 160n) - ONE;
export const MAX_UINT_128 = (ONE << 128n) - ONE;
export const MAX_UINT_64 = (ONE << 64n) - ONE;
export const MAX_UINT_48 = (ONE << 48n) - ONE;
export const MAX_UINT_32 = (ONE << 32n) - ONE;
export const MAX_UINT_24 = (ONE << 24n) - ONE;
export const MAX_UINT_16 = (ONE << 16n) - ONE;
export const MAX_UINT_8 = (ONE << 8n) - ONE;

export const MAX_INT_24 = (ONE << 23n) - ONE;
export const MIN_INT_24 = -(ONE << 23n);

export const POWERS_OF_2: Array<[number, bigint]> = [128, 64, 32, 16, 8, 4, 2, 1].map((pow) => [
    pow,
    ONE << BigInt(pow),
]);

export const MAX_SAFE_INTEGER = BigInt(Number.MAX_SAFE_INTEGER);

export const TICK_DELTA_MAX = 16096;
export const ANY_PRICE_TICK = 140737496743935n;
export const EMPTY_TICK = (ONE << 23n) - ONE;

// Ratio helpers mirrored from the legacy implementation.
export const RATIO_DECIMALS = 4;
export const ONE_RATIO = 10n ** BigInt(RATIO_DECIMALS);
export const RATIO_BASE = 10_000;
export const PEARL_SPACING = 1;
export const ORDER_SPACING = PEARL_SPACING;
export const RANGE_SPACING = PEARL_SPACING * 50;

// Additional math constants from range operations
export const ONE_HUNDRED = 100n;
export const ONE_THOUSAND = 1000n;
export const TEN_THOUSAND = 10000n;

export const RATIO_SCALER = WAD / ONE_RATIO;