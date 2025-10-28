import type { TransactionRequest as ViemTransactionRequest, Address, Hex } from 'viem';

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
    fee: bigint;
    swapType: SwapType;
};

export type OneHop = {
    pools: Pair[];
    weights: bigint[];
};

export type SplitPathInfo = {
    tokens: string[];
    oneHops: OneHop[];
    finalAmountOut: bigint;
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

export type TransactionRequest = ViemTransactionRequest;

export interface MixSwapParam {
    fromTokenAddress: Address;
    toTokenAddress: Address;
    fromTokenAmount: bigint;
    minReturnAmount: bigint;
    mixAdapters: Address[];
    mixPairs: Address[];
    assetTo: Address[];
    directions: bigint;
    moreInfos: Hex[];
    feeData: Hex;
    deadline: number;
}

export interface MultiSwapParam {
    fromTokenAddress: Address;
    fromTokenAmount: bigint;
    minReturnAmount: bigint;
    splitNumber: number[];
    midToken: Address[];
    assetTo: Address[];
    sequence: Hex[];
    feeData: Hex;
    deadline: number;
}
