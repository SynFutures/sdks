import { Pair, PoolInput, PoolType, SplitPathInfo, TransactionRequest } from './contract';
import type { Erc20TokenInfo } from '@derivation-tech/viem-kit';


// todo 前端Input、output命名, done
// todo 合约贴近 param, done
// todo 重整理,done
export interface GetMidPricesInput {
    poolAddresses: string[];
    poolTypes: PoolType[];
    isBuy: boolean;
    blockTag?: number;
}

export interface GetMidPricesOutput {
    midPrices: bigint[];
    token0Balances: bigint[];
    token1Balances: bigint[];
}

export interface GetAmountsOutInput {
    pool: string;
    poolType: PoolType;
    zeroForOne: boolean;
    amountsIn: bigint[];
    blockTag?: number;
}

export interface GetAmountsOutOutput {
    amountsOut: bigint[];
}

export interface QueryOneDexRouteInput {
    fromToken: Erc20TokenInfo;
    toToken: Erc20TokenInfo;
    fromAmount: bigint;
    excludePoolTypes: PoolType[];
    blockTag?: number;
}

export interface QueryOneDexRouteOutput {
    bestAmount: bigint;
    midPrice: bigint;
    bestPath: string[];
    bestPoolPath: Pair[];
}

export interface QuerySingleRouteInput {
    fromToken: Erc20TokenInfo;
    toToken: Erc20TokenInfo;
    fromAmount: bigint;
    excludePoolTypes: PoolType[];
    blockTag?: number;
}

export interface QuerySingleRouteOutput {
    bestAmount: bigint;
    midPrice: bigint;
    bestPath: string[];
    bestPoolPath: Pair[];
}

export interface QuerySplitRouteInput {
    fromToken: Erc20TokenInfo;
    toToken: Erc20TokenInfo;
    fromAmount: bigint;
    excludePoolTypes: PoolType[];
    isDirect?: boolean | string | number;
    splitNumber?: number;
    specifiedMiddleToken?: string;
    blockTag?: number;
}


export interface QuerySplitRouteOutput {
    bestAmount: bigint;
    midPrice: bigint;
    bestPathInfo: SplitPathInfo;
}

export interface Route {
    poolType: PoolType;
    poolAddr: string;
    ratio: bigint;
    fee: bigint;
}
export interface GetPoolLiquidityInput {
    pools: PoolInput[];
    token0: Erc20TokenInfo;
    token1: Erc20TokenInfo;
    priceMultipliers: number[];
    blockTag?: number;
    ratio?: number;
    steps?: number;
    batchSize?: number;
    parallel?: number;
}

export interface GetPoolLiquidityOutput {
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

export interface UserParams {
    slippageInBps: number;
    deadline: number;
}

export interface MixSwapRawInput {
    fromToken: Erc20TokenInfo;
    fromTokenAmount: bigint;
    toToken: Erc20TokenInfo;
    bestPath: string[];
    bestPoolPath: Pair[];
    bestAmount: bigint;
    broker: string;
    brokerFeeRate: bigint;
    userParams: UserParams;
}

export interface MultiSwapRawInput {
    fromToken: Erc20TokenInfo;
    fromTokenAmount: bigint;
    toToken: Erc20TokenInfo;
    bestPathInfo: SplitPathInfo;
    bestAmount: bigint;
    broker: string;
    brokerFeeRate: bigint;
    userParams: UserParams;
}

export interface QueryOnePoolRouteInput {
    fromToken: Erc20TokenInfo;
    toToken: Erc20TokenInfo;
    fromAmount: bigint;
    poolAddress: string;
    adapterAddress?: string;
    blockTag?: number;
}

export interface TradeToPriceInput {
    poolAddress: string;
    targetPrice?: bigint; // if not provided, execute default buy-sell operation
    userAddress: string;
}

export interface TradeToPriceOutput {
    transactions: TransactionRequest[];
}
