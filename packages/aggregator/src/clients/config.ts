import ConfigABI from '../abis/Config.json';
import { ZERO_ADDRESS } from '../utils';
import type { PoolType } from '../types/contract';
import type { GetMidPricesOutput } from '../types/frontEnd';

export type ConfigClientInterface = {
    getMiddleTokens(): Promise<string[]>;
    getAmountsOut(
        pool: string,
        poolType: PoolType,
        isToken0: boolean,
        amountsIn: bigint[],
        blockTag?: number,
    ): Promise<bigint[]>;
};

type PublicClientInstance = any;

export class ConfigClient implements ConfigClientInterface {
    private readonly hasConfig: boolean;

    constructor(private readonly publicClient: PublicClientInstance, private readonly address: `0x${string}`) {
        this.hasConfig = this.address !== ZERO_ADDRESS;
    }

    async getMiddleTokens(): Promise<string[]> {
        if (!this.hasConfig) return [];
        return (await this.publicClient.readContract({
            address: this.address,
            abi: ConfigABI as any,
            functionName: 'getMiddleTokens',
        } as any)) as string[];
    }

    async getMidPrices(
        pools: string[],
        poolTypes: PoolType[],
        isBuy: boolean,
        blockTag?: number,
    ): Promise<GetMidPricesOutput> {
        if (!this.hasConfig) {
            return { midPrices: [], token0Balances: [], token1Balances: [] };
        }

        const res = await this.publicClient.readContract({
            address: this.address,
            abi: ConfigABI as any,
            functionName: 'getMidPrices',
            args: [pools, poolTypes.map((type) => BigInt(type)), isBuy],
            blockNumber: blockTag !== undefined ? BigInt(blockTag) : undefined,
        } as any);

        const tuple = res as any;
        const midPricesRaw = (tuple && tuple.prices) ?? tuple?.[0] ?? [];
        const token0Raw = (tuple && tuple.token0bals) ?? tuple?.[1] ?? [];
        const token1Raw = (tuple && tuple.token1bals) ?? tuple?.[2] ?? [];

        const toBigIntArray = (value: any): bigint[] => (Array.isArray(value) ? value.map((v) => BigInt(v)) : []);

        return {
            midPrices: toBigIntArray(midPricesRaw),
            token0Balances: toBigIntArray(token0Raw),
            token1Balances: toBigIntArray(token1Raw),
        };
    }

    async getAmountsOut(
        pool: string,
        poolType: PoolType,
        isToken0: boolean,
        amountsIn: bigint[],
        blockTag?: number,
    ): Promise<bigint[]> {
        if (!this.hasConfig || amountsIn.length === 0) {
            return [];
        }

        const { result } = await this.publicClient.simulateContract({
            address: this.address,
            abi: ConfigABI as any,
            functionName: 'getAmountsOut',
            args: [pool as `0x${string}`, BigInt(poolType), isToken0, amountsIn],
            account: ZERO_ADDRESS as `0x${string}`,
            blockNumber: blockTag !== undefined ? BigInt(blockTag) : undefined,
        } as any);

        return (result as bigint[]) ?? [];
    }
}
