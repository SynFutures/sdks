import { PoolType, SwapType, Pair, OneHop, SplitPathInfo } from '../types/contract';
import { WAD_BI, ZERO_BI } from './constants';
import { encodeFunctionData, decodeFunctionResult } from 'viem';

type RouteCallOptions<TArgs extends unknown[]> = {
    client: any;
    abi: any;
    address: `0x${string}`;
    functionName: string;
    args: TArgs;
    blockTag?: number;
    emptyErrorMessage?: string;
};

export async function executeRouteCall<TResult, TArgs extends unknown[] = unknown[]>(
    options: RouteCallOptions<TArgs>,
): Promise<TResult> {
    const { client, abi, address, functionName, args, blockTag, emptyErrorMessage } = options;

    const data = encodeFunctionData({
        abi,
        functionName,
        args,
    });

    const callArgs: any = {
        to: address,
        data,
    };

    if (blockTag !== undefined) {
        callArgs.blockNumber = BigInt(blockTag);
    }

    const callResult = await client.call(callArgs);
    const returnData = (callResult as any)?.data ?? callResult;

    if (!returnData || returnData === '0x') {
        throw new Error(emptyErrorMessage ?? `Empty response from ${functionName}`);
    }

    return decodeFunctionResult({
        abi,
        functionName,
        data: returnData,
    }) as TResult;
}

export function normalizeSingleRouteResult(decoded: any): {
    bestAmount: bigint;
    midPrice: bigint;
    bestPath: string[];
    bestPoolPath: {
        token0: string;
        token1: string;
        poolAddr: string;
        poolType: PoolType;
        fee: bigint;
        swapType: SwapType;
    }[];
} {
    const resAmount = decoded?.resAmount ?? decoded?.[0] ?? { bestAmount: 0n, midPrice: 0n };
    const bestPathRaw = decoded?.bestPath ?? decoded?.[1] ?? [];
    const bestPoolPathRaw = decoded?.bestPoolPath ?? decoded?.[2] ?? [];

    const bestAmount = BigInt(resAmount?.bestAmount ?? resAmount?.[0] ?? 0n);
    const midPrice = BigInt(resAmount?.midPrice ?? resAmount?.[1] ?? 0n);

    const bestPath = Array.isArray(bestPathRaw) ? (bestPathRaw as string[]) : [];
    const bestPoolPath = Array.isArray(bestPoolPathRaw)
        ? (bestPoolPathRaw as any[]).map((pool) => ({
              token0: pool.token0,
              token1: pool.token1,
              poolAddr: pool.poolAddr,
              poolType: Number(pool.poolType) as PoolType,
              fee: BigInt(pool.fee ?? 0),
              swapType: Number(pool.swapType) as SwapType,
          }))
        : [];

    return {
        bestAmount,
        midPrice,
        bestPath,
        bestPoolPath,
    };
}

export type SinglePoolRouteParams = {
    fromToken: string;
    toToken: string;
    poolAddress: string;
    poolType: PoolType;
    isBuy: boolean;
    amountOut: bigint;
    midPrice: bigint;
    fee?: bigint;
    swapType?: SwapType;
};

export function buildSinglePoolRouteResult(params: SinglePoolRouteParams): {
    bestAmount: bigint;
    midPrice: bigint;
    bestPathInfo: SplitPathInfo;
} {
    const {
        fromToken,
        toToken,
        poolAddress,
        poolType,
        isBuy,
        amountOut,
        midPrice,
        fee = ZERO_BI,
        swapType = SwapType.ADAPTER,
    } = params;

    const [token0, token1] = isBuy ? [fromToken, toToken] : [toToken, fromToken];

    const poolInfo: Pair = {
        token0,
        token1,
        poolAddr: poolAddress,
        poolType,
        fee,
        swapType,
    };

    const oneHop: OneHop = {
        pools: [poolInfo],
        weights: [WAD_BI],
    };

    return {
        bestAmount: amountOut,
        midPrice,
        bestPathInfo: {
            tokens: [fromToken, toToken],
            oneHops: [oneHop],
            finalAmountOut: amountOut,
            isValid: true,
        },
    };
}

export function normalizeSplitRouteResult(decoded: any): {
    bestAmount: bigint;
    midPrice: bigint;
    bestPathInfo: SplitPathInfo;
} {
    const resAmount = decoded?.resAmount ?? decoded?.[0] ?? { bestAmount: 0n, midPrice: 0n };
    const bestPathInfoRaw = decoded?.bestPathInfo ?? decoded?.[1] ?? decoded?.[2] ?? {};

    const tokensRaw = bestPathInfoRaw?.tokens ?? [];
    const oneHopsRaw = bestPathInfoRaw?.oneHops ?? [];

    const tokens = Array.isArray(tokensRaw) ? (tokensRaw as string[]) : [];
    const oneHops = Array.isArray(oneHopsRaw)
        ? (oneHopsRaw as any[]).map((hop) => normalizeHop(hop))
        : [];

    const bestAmount = BigInt(resAmount?.bestAmount ?? resAmount?.[0] ?? 0n);
    const midPrice = BigInt(resAmount?.midPrice ?? resAmount?.[1] ?? 0n);
    const finalAmountOut = BigInt(bestPathInfoRaw?.finalAmountOut ?? 0n);
    const isValid = Boolean(bestPathInfoRaw?.isValid);

    return {
        bestAmount,
        midPrice,
        bestPathInfo: {
            tokens,
            oneHops,
            finalAmountOut,
            isValid,
        },
    };
}

function normalizeHop(hop: any): OneHop {
    const poolsRaw = hop?.pools ?? [];
    const weightsRaw = hop?.weights ?? [];

    const pools = Array.isArray(poolsRaw)
        ? (poolsRaw as any[]).map((pool) => ({
              token0: pool.token0,
              token1: pool.token1,
              poolAddr: pool.poolAddr,
              poolType: Number(pool.poolType) as PoolType,
              fee: BigInt(pool.fee ?? 0),
              swapType: Number(pool.swapType) as SwapType,
          }))
        : [];

    const weights = Array.isArray(weightsRaw) ? (weightsRaw as any[]).map((weight) => BigInt(weight)) : [];

    const filtered: OneHop = {
        pools: [],
        weights: [],
    };

    pools.forEach((pool, idx) => {
        const weight = weights[idx] ?? ZERO_BI;
        if (weight > ZERO_BI) {
            filtered.pools.push(pool);
            filtered.weights.push(weight);
        }
    });

    return filtered;
}
