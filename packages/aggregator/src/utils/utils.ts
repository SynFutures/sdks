
import { ZERO_ADDRESS, ETH_ADDRESS, RATIO_BASE_BI, WAD_BI, ZERO_BI } from './constants';
import { PoolType } from '../types/contract';
import { formatUnits, parseUnits } from 'viem';

export function toWrappedETH(wrappedNativeTokenAddress: string, tokenAddress: string): string {
    return tokenAddress.toLowerCase() === ZERO_ADDRESS.toLowerCase()
        ? wrappedNativeTokenAddress
        : tokenAddress;
}

export function zeroToETHForSwap(tokenAddress: string): string {
    return tokenAddress.toLowerCase() == ZERO_ADDRESS.toLowerCase() ? ETH_ADDRESS : tokenAddress;
}

export function fromWei(amount: bigint, decimals = 18): number {
    return Number(formatUnits(amount, decimals));
}

export function toWei(amount: number, decimals = 18): bigint {
    return parseUnits(amount.toFixed(decimals), decimals);
}

export function normalizeBoolean(value: unknown, defaultValue = false): boolean {
    if (value === undefined || value === null) {
        return defaultValue;
    }
    if (typeof value === 'boolean') {
        return value;
    }
    if (typeof value === 'number') {
        if (value === 1) return true;
        if (value === 0) return false;
        return defaultValue;
    }
    if (typeof value === 'string') {
        const normalized = value.trim().toLowerCase();
        if (normalized === 'true' || normalized === '1') return true;
        if (normalized === 'false' || normalized === '0') return false;
        return defaultValue;
    }
    return defaultValue;
}

export interface SwapSlippageParams {
    inputAmount: bigint;
    actualAmountOut: bigint;
    fromTokenDecimals: number;
    toTokenDecimals: number;
    midPrice: bigint;
    slippageInBps: number;
}

export function calculateSwapSlippage(params: SwapSlippageParams): {
    priceImpact: number;
    minReceivedAmount: bigint;
} {
    const minReceivedAmount =
        (params.actualAmountOut * (RATIO_BASE_BI - BigInt(params.slippageInBps))) / RATIO_BASE_BI;

    const fromTokenDecimalCorrect = 10n ** BigInt(params.fromTokenDecimals);
    const toTokenDecimalCorrect = 10n ** BigInt(params.toTokenDecimals);
    const denominatorRaw = params.inputAmount * toTokenDecimalCorrect * params.midPrice;
    const denominator = denominatorRaw === 0n ? 0n : denominatorRaw / WAD_BI;
    const priceImpactBN =
        denominator === 0n
            ? ZERO_BI
            : (params.actualAmountOut * fromTokenDecimalCorrect * WAD_BI) / denominator;

    const priceImpact = Number(formatUnits(priceImpactBN, 18)) - 1;

    return {
        priceImpact,
        minReceivedAmount,
    };
}

export function getDexFlag(poolTypes: PoolType[]): bigint {
    return poolTypes.reduce((acc, poolType) => acc | (1n << BigInt(poolType)), 0n);
}

export function getDexFlagAndSplits(poolTypes: PoolType[], splitNumber = 0): bigint {
    const maxSplitNumber = 127;
    if (poolTypes.length > maxSplitNumber) {
        throw new Error(`poolTypes length must be less than ${maxSplitNumber}`);
    }
    return getDexFlag(poolTypes) | (BigInt(splitNumber) << BigInt(maxSplitNumber));
}
