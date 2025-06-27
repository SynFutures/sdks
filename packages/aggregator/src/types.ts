import { BigNumber } from 'ethers';

export enum QueryType {
    SINGLE_ROUTE = 0,
    SPLIT_ROUTE = 1,
}

export type PoolInput = {
    poolAddr: string;
    poolType: number;
};

export enum SwapType {
    INVALID = 0,
    ADAPTER = 1,
    DIRECT = 2,
}

export type Pair = {
    token0: string;
    token1: string;
    poolAddr: string;
    poolType: PoolType;
    fee: BigNumber;
    swapType: SwapType;
};

export type OneHop = {
    pools: Pair[];
    weights: BigNumber[];
};

export type SplitPathInfo = {
    tokens: string[];
    oneHops: OneHop[];
    finalAmountOut: BigNumber;
    isValid: boolean;
};

export enum PoolType {
    PANCAKE_V3 = 1,
    UNISWAP_V3 = 2,
    UNISWAP_V2 = 3,
    AERODROME_V3 = 4,
    AERODROME_V2 = 5,
    SUSHISWAP_V3 = 6,
    ALB_V3 = 7,
    OYSTER = 8,
    OYSTER_NEW = 9,
}

export interface PoolCurve {
    range: { min: number; max: number };
    coefficients: [number, number, number, number];
}
