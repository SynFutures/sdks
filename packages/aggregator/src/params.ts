import { Pair, PoolInput, PoolType, SplitPathInfo } from './types';
import { BigNumber } from 'ethers';

export interface GetMidPricesParam {
    poolAddresses: string[];
    poolTypes: PoolType[];
    isBuy: boolean;
}

export interface GetMidPricesResult {
    midPrices: BigNumber[];
    token0Balances: BigNumber[];
    token1Balances: BigNumber[];
}

export interface GetAmountsOutParam {
    pool: string;
    poolType: PoolType;
    zeroForOne: boolean;
    amountsIn: BigNumber[];
}

export interface GetAmountsOutResult {
    amountsOut: BigNumber[];
}

export interface QueryDirectRouteParam {
    fromTokenAddress: string;
    toTokenAddress: string;
    fromAmount: BigNumber;
    excludePoolTypes: PoolType[];
}

export interface QueryDirectRouteResult {
    bestAmount: BigNumber;
    midPrice: BigNumber;
    bestPath: string[];
    bestPoolPath: Pair[];
}

export interface QuerySingleRouteParam {
    fromTokenAddress: string;
    toTokenAddress: string;
    fromAmount: BigNumber;
    excludePoolTypes: PoolType[];
}

export interface QuerySingleRouteResult {
    bestAmount: BigNumber;
    midPrice: BigNumber;
    bestPath: string[];
    bestPoolPath: Pair[];
}

export interface QuerySplitRouteParam {
    fromTokenAddress: string;
    toTokenAddress: string;
    fromAmount: BigNumber;
    excludePoolTypes: PoolType[];
    isDirect: boolean;
    splitNumber?: number;
    specifiedMiddleToken?: string;
}

export interface QuerySplitRouteResult {
    bestAmount: BigNumber;
    midPrice: BigNumber;
    bestPathInfo: SplitPathInfo;
}

export interface SimulateMixSwapParam {
    fromTokenAddress: string;
    toTokenAddress: string;
    fromTokenDecimals: number;
    toTokenDecimals: number;
    fromAmount: BigNumber;
    excludePoolTypes: PoolType[];
    slippageInBps: number;
}

export interface SimulateMixSwapResult {
    priceImpact: number;
    minReceivedAmount: BigNumber;
    route: PoolType[];
}

export interface SimulateMultiSwapParam {
    fromTokenAddress: string;
    toTokenAddress: string;
    fromTokenDecimals: number;
    toTokenDecimals: number;
    fromAmount: BigNumber;
    excludePoolTypes: PoolType[];
    isDirect: boolean;
    slippageInBps: number;
}

export interface Route {
    poolType: PoolType;
    poolAddr: string;
    ratio: BigNumber;
    fee: BigNumber;
}
export interface SimulateMultiSwapResult {
    priceImpact: number;
    minReceivedAmount: BigNumber;
    route: Route[][];
    tokens: string[];
}

export interface GetPoolLiquidityParam {
    pools: PoolInput[];
    token0Decimal: number;
    token1Decimal: number;
    priceMultipliers: number[];
    blockTag?: number;
    ratio?: number;
    steps?: number;
    batchSize?: number;
    parallel?: number;
}

export interface GetPoolLiquidityResult {
    midPrice: number;
    buyLiquidityResults: {
        price: number;
        poolAmounts: {
            pool: string;
            amount0: number;
            amount1: number;
        }[];
    }[];
    sellLiquidityResults: {
        price: number;
        poolAmounts: {
            pool: string;
            amount0: number;
            amount1: number;
        }[];
    }[];
}

export interface MixSwapParam {
    fromTokenAddress: string;
    fromTokenAmount: BigNumber;
    toTokenAddress: string;
    bestPath: string[];
    bestPoolPath: Pair[];
    bestAmount: BigNumber;
    slippageInBps: number;
    broker: string;
    brokerFeeRate: BigNumber;
    deadline: number;
}

export interface MultiSwapParam {
    fromTokenAddress: string;
    fromTokenAmount: BigNumber;
    toTokenAddress: string;
    bestPathInfo: SplitPathInfo;
    bestAmount: BigNumber;
    slippageInBps: number;
    broker: string;
    brokerFeeRate: BigNumber;
    deadline: number;
}

export interface QuerySinglePoolRouteParam {
    fromTokenAddress: string;
    toTokenAddress: string;
    fromAmount: BigNumber;
    poolAddress: string;
    adapterAddress?: string;
}

export interface SimulateMTSinglePoolParam {
    fromTokenAddress: string;
    toTokenAddress: string;
    fromTokenDecimals: number;
    toTokenDecimals: number;
    fromAmount: BigNumber;
    poolAddress: string;
    adapterAddress?: string;
    slippageInBps: number;
}

export interface SimulateMTSinglePoolResult {
    priceImpact: number;
    minReceivedAmount: BigNumber;
    route: Route[][];
    tokens: string[];
}
