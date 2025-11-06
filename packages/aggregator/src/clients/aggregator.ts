import { createPublicClient, encodeAbiParameters, encodeFunctionData, http } from 'viem';
import type { Hex } from 'viem';
import ConfigABI from '../abis/Config.json';
import QuerySingleRouteABI from '../abis/QuerySingleRoute.json';
import QuerySplitRouteABI from '../abis/QuerySplitRoute.json';
import OysterAggregatorABI from '../abis/OysterAggregator.json';
import AdapterABI from '../abis/Adapter.json';
import { ChainKitRegistry } from '@derivation-tech/viem-kit';
import { ConfigClient } from './config';
import type { ConfigClientInterface } from './config';
import { PoolType, SwapType } from '../types/contract';
import type { Pair, TransactionRequest, MixSwapParam, MultiSwapParam } from '../types/contract';
import type {
    GetAmountsOutInput,
    GetAmountsOutOutput,
    GetMidPricesInput,
    GetMidPricesOutput,
    GetPoolLiquidityInput,
    GetPoolLiquidityOutput,
    MixSwapRawInput,
    MultiSwapRawInput,
    QueryOneDexRouteInput,
    QueryOneDexRouteOutput,
    QuerySingleRouteInput,
    QuerySingleRouteOutput,
    QuerySplitRouteInput,
    QuerySplitRouteOutput,
    QueryOnePoolRouteInput,
} from '../types/frontEnd';
import {
    CONFIG_ADDRESS,
    ETH_ADDRESS,
    OYSTER_AGGREGATOR_ADDRESS,
    QUERY_SINGLE_ROUTE_ADDRESS,
    QUERY_SPLIT_ROUTE_ADDRESS,
    BROKER_FEE_PARAMS,
    MULTISWAP_SEQUENCE_PARAMS,
    ONE_BI,
    RATIO_BASE_BI,
    WAD_BI,
    ZERO_BI,
    ZERO_ADDRESS,
    analyzePoolLiquidity,
    fitPoolCurves,
    getDexFlag,
    getDexFlagAndSplits,
    toWrappedETH,
    zeroToETHForSwap,
    adjustLiquidityResults,
    fromWei,
    normalizeBoolean,
    executeRouteCall,
    normalizeSingleRouteResult,
    buildSinglePoolRouteResult,
    normalizeSplitRouteResult,
} from '../utils';

export interface AggregatorModuleOptions {
    chainId: number;
    rpcUrl?: string;
}

export interface AggregatorInterface {
    get config(): ConfigClientInterface;

    getPoolList(
        token0Address: string,
        token1Address: string,
        excludePoolTypes?: PoolType[],
        blockTag?: number,
    ): Promise<Pair[]>;

    getPoolAdapter(poolType: PoolType): Promise<string>;

    getMidPrices(params: GetMidPricesInput): Promise<GetMidPricesOutput>;

    getAmountsOut(params: GetAmountsOutInput): Promise<GetAmountsOutOutput>;

    getPoolLiquidity(params: GetPoolLiquidityInput): Promise<GetPoolLiquidityOutput>;

    // specify dex, select best-price pool, one pool swap
    queryOneDexRoute(params: QueryOneDexRouteInput): Promise<QueryOneDexRouteOutput>;

    // specify pool, one pool swap
    queryOnePoolRoute(params: QueryOnePoolRouteInput): Promise<QuerySplitRouteOutput>;

    // multiSwap, split fromAmount
    querySplitRoute(params: QuerySplitRouteInput): Promise<QuerySplitRouteOutput>;

    // mixSwap, one pool each step, not split Amount
    querySingleRoute(params: QuerySingleRouteInput): Promise<QuerySingleRouteOutput>;

    encodeMixSwapData(params: MixSwapRawInput): Promise<TransactionRequest>;

    encodeMultiSwapData(params: MultiSwapRawInput): Promise<TransactionRequest>;
}

type PublicClientInstance = any;

export class AggregatorModule implements AggregatorInterface {
    private readonly chainId: number;
    private readonly rpcUrls: string[];
    private readonly rpcUrl?: string;
    private readonly wrappedNativeTokenAddress: string;
    private readonly viemChain: any;
    private configClient?: ConfigClient;
    private configAddressCache?: string;
    private poolAdapters: Map<number, string> = new Map();
    private publicClient?: PublicClientInstance;

    constructor({ chainId, rpcUrl }: AggregatorModuleOptions) {
        const resolvedChainKit = ChainKitRegistry.for(chainId);
        const wrappedNative = resolvedChainKit.wrappedNativeTokenInfo?.address ?? ZERO_ADDRESS;

        if (!wrappedNative || wrappedNative === ZERO_ADDRESS) {
            throw new Error('Wrapped native token address not configured for the current chain');
        }

        this.chainId = resolvedChainKit.chain.id;
        this.viemChain = resolvedChainKit.chain;

        const defaultRpcUrls = [
            ...(resolvedChainKit.chain.rpcUrls?.default?.http ?? []),
            ...(resolvedChainKit.chain.rpcUrls?.public?.http ?? []),
        ];

        this.rpcUrls = defaultRpcUrls;
        this.rpcUrl = rpcUrl ?? this.rpcUrls[0];

        this.wrappedNativeTokenAddress = wrappedNative;
    }

    async getPoolList(
        token0Address: string,
        token1Address: string,
        excludePoolTypes: PoolType[] = [],
        blockTag?: number,
    ): Promise<Pair[]> {
        const configAddress = this.getConfigAddress();
        if (configAddress === ZERO_ADDRESS) {
            return [];
        }

        const publicClient = this.getPublicClient();
        const readArgs: any = {
            address: configAddress as `0x${string}`,
            abi: ConfigABI as any,
            functionName: 'getPoolsWithFlag',
            args: [token0Address, token1Address, getDexFlag(excludePoolTypes)],
        };
        if (blockTag !== undefined) {
            readArgs.blockNumber = BigInt(blockTag);
        }

        const result = (await publicClient.readContract(readArgs as any)) as any[];

        return result.map((pair) => ({
            token0: pair.token0,
            token1: pair.token1,
            poolAddr: pair.poolAddr,
            poolType: Number(pair.poolType) as PoolType,
            fee: BigInt(pair.fee),
            swapType: Number(pair.swapType) as SwapType,
        }));
    }

    async getPoolAdapter(poolType: PoolType): Promise<string> {
        const res = this.poolAdapters.get(poolType);
        if (!res) {
            try {
                const client = this.getPublicClient();
                const poolAdapter = await client.readContract({
                    address: this.getConfigAddress() as `0x${string}`,
                    abi: ConfigABI as any,
                    functionName: 'getPoolAdapter',
                    args: [BigInt(poolType)],
                } as any);
                if (typeof poolAdapter !== 'string') {
                    throw new Error('Invalid adapter response');
                }
                this.poolAdapters.set(poolType, poolAdapter);
                return poolAdapter;
            } catch (e) {
                throw new Error(`Pool adapter not found for pool type ${poolType}, reason: ${e}`);
            }
        }
        return res;
    }

    public getWrappedNativeTokenAddress(): string {
        return this.wrappedNativeTokenAddress;
    }

    public getPublicClientInstance(): PublicClientInstance {
        return this.getPublicClient();
    }

    public getOysterAggregatorAddress(): string {
        const address = OYSTER_AGGREGATOR_ADDRESS[this.chainId] ?? ZERO_ADDRESS;
        if (address === ZERO_ADDRESS) {
            throw new Error(`Oyster aggregator address not configured for chain ${this.chainId}`);
        }
        return address;
    }

    private getConfigAddress(): string {
        return CONFIG_ADDRESS[this.chainId] ?? ZERO_ADDRESS;
    }

    private getQuerySingleRouteAddress(): string {
        return QUERY_SINGLE_ROUTE_ADDRESS[this.chainId] ?? ZERO_ADDRESS;
    }

    private getQuerySplitRouteAddress(): string {
        return QUERY_SPLIT_ROUTE_ADDRESS[this.chainId] ?? ZERO_ADDRESS;
    }

    private getRpcUrl(): string {
        if (this.rpcUrl) {
            return this.rpcUrl;
        }
        if (this.rpcUrls.length) {
            return this.rpcUrls[0];
        }
        throw new Error('RPC url not available for viem client');
    }

    private getConfigClient(): ConfigClient {
        const configAddress = this.getConfigAddress();
        if (!this.configClient || this.configAddressCache !== configAddress) {
            this.configClient = new ConfigClient(this.getPublicClient(), configAddress as `0x${string}`);
            this.configAddressCache = configAddress;
        }
        return this.configClient;
    }

    get config(): ConfigClientInterface {
        return this.getConfigClient();
    }

    private getPublicClient(): PublicClientInstance {
        if (!this.publicClient) {
            this.publicClient = createPublicClient({
                chain: this.viemChain,
                transport: http(this.getRpcUrl()),
            });
        }
        return this.publicClient;
    }

    async init(): Promise<void> {
        const configAddress = this.getConfigAddress();
        if (configAddress === ZERO_ADDRESS) {
            return;
        }

        const poolTypes = Object.values(PoolType).filter((value) => !isNaN(Number(value))) as number[];
        if (poolTypes.length === 0) {
            return;
        }

        const publicClient = this.getPublicClient();
        const response = await (publicClient as any).multicall({
            allowFailure: true,
            contracts: poolTypes.map((poolType) => ({
                address: configAddress as `0x${string}`,
                abi: ConfigABI as any,
                functionName: 'getPoolAdapter',
                args: [BigInt(poolType)],
            })),
        });

        response.forEach((result, index) => {
            if (result.status === 'success' && typeof result.result === 'string') {
                this.poolAdapters.set(poolTypes[index], result.result);
            }
        });
    }

    async getMidPrices(params: GetMidPricesInput): Promise<GetMidPricesOutput> {
        return this.getConfigClient().getMidPrices(
            params.poolAddresses,
            params.poolTypes,
            params.isBuy,
            params.blockTag,
        );
    }

    async getAmountsOut(params: GetAmountsOutInput): Promise<GetAmountsOutOutput> {
        const amountsOut = await this.getConfigClient().getAmountsOut(
            params.pool,
            params.poolType,
            params.zeroForOne,
            params.amountsIn.map((amount) => BigInt(amount)),
            params.blockTag,
        );

        return {
            amountsOut: amountsOut.map((item) => BigInt(item)),
        };
    }

    async queryOneDexRoute(params: QueryOneDexRouteInput): Promise<QueryOneDexRouteOutput> {
        const fromTokenAddress = toWrappedETH(this.wrappedNativeTokenAddress, params.fromToken.address);
        const toTokenAddress = toWrappedETH(this.wrappedNativeTokenAddress, params.toToken.address);

        const querySingleRouteAddress = this.getQuerySingleRouteAddress();
        if (querySingleRouteAddress === ZERO_ADDRESS) {
            return {
                bestAmount: ZERO_BI,
                midPrice: ZERO_BI,
                bestPath: [],
                bestPoolPath: [],
            };
        }

        const publicClient = this.getPublicClient();

        const decoded = await executeRouteCall<any, [string, string, bigint, bigint]>({
            client: publicClient,
            abi: QuerySingleRouteABI as any,
            address: querySingleRouteAddress as `0x${string}`,
            functionName: 'queryDirectRoute',
            args: [
                fromTokenAddress,
                toTokenAddress,
                BigInt(params.fromAmount),
                getDexFlag(params.excludePoolTypes),
            ],
            blockTag: params.blockTag,
            emptyErrorMessage: 'Empty response from queryOneDexRoute',
        });

        const { bestAmount, midPrice, bestPath, bestPoolPath } = normalizeSingleRouteResult(decoded);

        return {
            bestAmount,
            midPrice,
            bestPath,
            bestPoolPath,
        };
    }

    async querySingleRoute(params: QuerySingleRouteInput): Promise<QuerySingleRouteOutput> {
        const fromTokenAddress = toWrappedETH(this.wrappedNativeTokenAddress, params.fromToken.address);
        const toTokenAddress = toWrappedETH(this.wrappedNativeTokenAddress, params.toToken.address);

        const querySingleRouteAddress = this.getQuerySingleRouteAddress();
        if (querySingleRouteAddress === ZERO_ADDRESS) {
            return {
                bestAmount: ZERO_BI,
                midPrice: ZERO_BI,
                bestPath: [],
                bestPoolPath: [],
            };
        }

        const publicClient = this.getPublicClient();

        const decoded = await executeRouteCall<any, [string, string, bigint, bigint]>({
            client: publicClient,
            abi: QuerySingleRouteABI as any,
            address: querySingleRouteAddress as `0x${string}`,
            functionName: 'querySingleRoute',
            args: [
                fromTokenAddress,
                toTokenAddress,
                BigInt(params.fromAmount),
                getDexFlag(params.excludePoolTypes),
            ],
            blockTag: params.blockTag,
            emptyErrorMessage: 'Empty response from querySingleRoute',
        });

        const { bestAmount, midPrice, bestPath, bestPoolPath } = normalizeSingleRouteResult(decoded);

        return {
            bestAmount,
            midPrice,
            bestPath,
            bestPoolPath,
        };
    }

    async querySplitRoute(params: QuerySplitRouteInput): Promise<QuerySplitRouteOutput> {
        const fromTokenAddress = toWrappedETH(this.wrappedNativeTokenAddress, params.fromToken.address);
        const toTokenAddress = toWrappedETH(this.wrappedNativeTokenAddress, params.toToken.address);
        const isDirect = normalizeBoolean((params as { isDirect?: unknown }).isDirect);

        const querySplitRouteAddress = this.getQuerySplitRouteAddress();
        if (querySplitRouteAddress === ZERO_ADDRESS) {
            return {
                bestAmount: ZERO_BI,
                midPrice: ZERO_BI,
                bestPathInfo: {
                    tokens: [],
                    oneHops: [],
                    finalAmountOut: ZERO_BI,
                    isValid: false,
                },
            };
        }

        const publicClient = this.getPublicClient();
        const decoded = await executeRouteCall<any, [string, string, bigint, boolean, bigint, string]>({
            client: publicClient,
            abi: QuerySplitRouteABI as any,
            address: querySplitRouteAddress as `0x${string}`,
            functionName: 'querySplitRoute',
            args: [
                fromTokenAddress,
                toTokenAddress,
                BigInt(params.fromAmount),
                isDirect,
                getDexFlagAndSplits(params.excludePoolTypes, params.splitNumber ?? 0),
                params.specifiedMiddleToken ?? ZERO_ADDRESS,
            ],
            blockTag: params.blockTag,
            emptyErrorMessage: 'Empty response from querySplitRoute',
        });

        const { bestAmount, midPrice, bestPathInfo } = normalizeSplitRouteResult(decoded);

        return {
            bestAmount,
            midPrice,
            bestPathInfo,
        };
    }

    async queryOnePoolRoute(params: QueryOnePoolRouteInput): Promise<QuerySplitRouteOutput> {
        // Convert ETH addresses to WETH
        const fromTokenAddress = toWrappedETH(this.wrappedNativeTokenAddress, params.fromToken.address);
        const toTokenAddress = toWrappedETH(this.wrappedNativeTokenAddress, params.toToken.address);

        // Use provided adapter address or get default adapter for OYSTER pool type
        const adapterAddress = params.adapterAddress || (await this.getPoolAdapter(PoolType.OYSTER_NEW));

        // Create adapter contract interface
        const isBuy = fromTokenAddress.toLowerCase() < toTokenAddress.toLowerCase();

        const publicClient = this.getPublicClient();
        const blockNumber = params.blockTag !== undefined ? BigInt(params.blockTag) : undefined;
        const querySellArgs: any = {
            address: adapterAddress as `0x${string}`,
            abi: AdapterABI as any,
            functionName: 'querySell',
            args: [fromTokenAddress, BigInt(params.fromAmount), params.poolAddress],
        };
        const midPriceArgs: any = {
            address: adapterAddress as `0x${string}`,
            abi: AdapterABI as any,
            functionName: 'getMidPriceAndBalances',
            args: [params.poolAddress, isBuy],
        };
        if (blockNumber !== undefined) {
            querySellArgs.blockNumber = blockNumber;
            midPriceArgs.blockNumber = blockNumber;
        }

        const [querySellResult, midPriceResult] = await Promise.all([
            publicClient.readContract(querySellArgs),
            publicClient.readContract(midPriceArgs),
        ]);

        const querySellArray = Array.isArray(querySellResult)
            ? querySellResult
            : [undefined, (querySellResult as any)?.toAmount];
        const midPriceArray = Array.isArray(midPriceResult)
            ? midPriceResult
            : [(midPriceResult as any)?.price];

        const toAmount = BigInt(querySellArray?.[1] ?? 0n);
        const midPriceRaw = BigInt(midPriceArray?.[0] ?? 0n);
        const correctMidPrice = isBuy
            ? midPriceRaw
            : midPriceRaw === 0n
                ? ZERO_BI
                : (WAD_BI * WAD_BI) / midPriceRaw;

        // Create pool info with token addresses in correct order (token0 < token1)
        const { bestAmount, midPrice, bestPathInfo } = buildSinglePoolRouteResult({
            fromToken: fromTokenAddress,
            toToken: toTokenAddress,
            poolAddress: params.poolAddress,
            poolType: PoolType.OYSTER_NEW,
            isBuy,
            amountOut: toAmount,
            midPrice: correctMidPrice,
        });

        return {
            bestAmount,
            midPrice,
            bestPathInfo,
        };
    }

    async getPoolLiquidity(params: GetPoolLiquidityInput): Promise<GetPoolLiquidityOutput> {
        if (params.blockTag === undefined) {
            const latestBlock = await this.getPublicClient().getBlockNumber();
            params.blockTag = Number(latestBlock);
        }

        const config = this.getConfigClient();
        const [sellSide, buySide] = await Promise.all([
            config.getMidPrices(
                params.pools.map((pool) => pool.poolAddr),
                params.pools.map((pool) => pool.poolType),
                false,
                params.blockTag,
            ),
            config.getMidPrices(
                params.pools.map((pool) => pool.poolAddr),
                params.pools.map((pool) => pool.poolType),
                true,
                params.blockTag,
            ),
        ]);

        const sellPrices = sellSide.midPrices;
        const token0bals = sellSide.token0Balances;
        const token1bals = sellSide.token1Balances;
        const buyPrices = buySide.midPrices;

        if (sellPrices.length === 0 || buyPrices.length === 0) {
            return {
                midPrice: 0,
                buyLiquidityResults: [],
                sellLiquidityResults: [],
            };
        }

        const avgSellPrice = sellPrices.reduce((sum, price) => sum + fromWei(price), 0) / sellPrices.length;
        const avgBuyPrice = buyPrices.reduce((sum, price) => sum + fromWei(price), 0) / buyPrices.length;
        const avgMidPrice = (avgSellPrice + avgBuyPrice) / 2;

        const allPoolCurves = await Promise.all(
            params.pools.map((pool, idx) =>
                fitPoolCurves(
                    config,
                    pool.poolAddr,
                    pool.poolType,
                    token0bals[idx] ?? 0n,
                    token1bals[idx] ?? 0n,
                    params.token0.decimals,
                    params.token1.decimals,
                    params.ratio,
                    params.steps,
                    params.batchSize,
                    params.blockTag,
                ),
            ),
        );

        // calculate all pool min buy prices
        const allPoolMinBuyPrices = allPoolCurves.map((curves) => {
            const buyCurves = curves.buyCurves;
            if (!buyCurves || buyCurves.length === 0) return Infinity;

            return buyCurves.reduce((minPrice, curve) => {
                // available curve
                if (curve && curve.range && typeof curve.range.min === 'number') {
                    return Math.min(minPrice, curve.range.min);
                }
                return minPrice;
            }, Infinity);
        });

        // get min price
        const minPoolBuyPrice = Math.min(...allPoolMinBuyPrices);

        // calculate buyQueryPrices
        const buyQueryPrices = params.priceMultipliers
            .map((priceMultiplier) => avgBuyPrice * priceMultiplier)
            .filter((price) => price > avgBuyPrice);

        // adjust price
        if (Math.min(...buyQueryPrices) < minPoolBuyPrice) {
            const adjustmentRatio = minPoolBuyPrice / avgBuyPrice;
            const adjustedPrices = buyQueryPrices.map((price) => price * adjustmentRatio);
            buyQueryPrices.splice(0, buyQueryPrices.length, ...adjustedPrices);
        }

        const buyResults = adjustLiquidityResults(
            analyzePoolLiquidity(
                params.pools.map((pool) => pool.poolAddr),
                allPoolCurves,
                buyQueryPrices,
                true,
            ),
            true,
        );

        // calculate max sell price
        const allPoolMaxSellPrices = allPoolCurves.map((curves) => {
            const sellCurves = curves.sellCurves;
            if (!sellCurves || sellCurves.length === 0) return -Infinity;

            return sellCurves.reduce((maxPrice, curve) => {
                // only available
                if (curve && curve.range && typeof curve.range.max === 'number') {
                    return Math.max(maxPrice, curve.range.max);
                }
                return maxPrice;
            }, -Infinity);
        });

        // get max price of all pools
        const maxPoolSellPrice = Math.max(...allPoolMaxSellPrices);

        // calculate sellQueryPrices and adjust
        const sellQueryPrices = params.priceMultipliers
            .map((priceMultiplier) => avgSellPrice * priceMultiplier)
            .filter((price) => price < avgSellPrice);

        if (Math.max(...sellQueryPrices) < maxPoolSellPrice) {
            const adjustmentRatio = maxPoolSellPrice / avgSellPrice;
            const adjustedPrices = sellQueryPrices.map((price) => price * adjustmentRatio);
            sellQueryPrices.splice(0, sellQueryPrices.length, ...adjustedPrices);
        }
        const sellResults = adjustLiquidityResults(
            analyzePoolLiquidity(
                params.pools.map((pool) => pool.poolAddr),
                allPoolCurves,
                sellQueryPrices,
                false,
            ),
            false,
        );

        return {
            midPrice: avgMidPrice,
            buyLiquidityResults: buyResults,
            sellLiquidityResults: sellResults,
        };
    }

    private async _getMixSwapDataFromRawParams(params: MixSwapRawInput): Promise<MixSwapParam> {
        const {
            fromToken,
            fromTokenAmount,
            toToken,
            bestPath,
            bestPoolPath,
            bestAmount,
            broker,
            brokerFeeRate,
            userParams,
        } = params;
        const { slippageInBps, deadline } = userParams;

        const fromTokenAddress = fromToken.address;
        const toTokenAddress = toToken.address;
        const fromTokenAddressNonZero = zeroToETHForSwap(fromTokenAddress);
        const toTokenAddressNonZero = zeroToETHForSwap(toTokenAddress);

        // construct mixSwap params
        const minReturnAmount = (bestAmount * (RATIO_BASE_BI - BigInt(slippageInBps))) / RATIO_BASE_BI;
        const aggregatorAddress = this.getOysterAggregatorAddress();
        const mixAdapters = (await Promise.all(bestPoolPath.map((pair) => this.getPoolAdapter(pair.poolType))))
            .map((addr) => addr as `0x${string}`);
        const mixPairs = bestPoolPath.map((pair) => pair.poolAddr as `0x${string}`);
        const assetTo = (await Promise.all(
            bestPoolPath.map((pair) => {
                if (pair.swapType === SwapType.DIRECT) {
                    return pair.poolAddr;
                } else if (pair.swapType === SwapType.ADAPTER) {
                    return this.getPoolAdapter(pair.poolType);
                } else {
                    throw new Error(`Invalid swap type: ${pair.swapType}`);
                }
            }),
        )).map((addr) => addr as `0x${string}`);
        assetTo.push(aggregatorAddress as `0x${string}`);
        // default to empty string for now, may be used in new pool adapters
        const moreInfos = new Array(bestPoolPath.length).fill('0x' as Hex);
        const feeData = encodeAbiParameters(BROKER_FEE_PARAMS, [broker as `0x${string}`, brokerFeeRate]);
        let directions = ZERO_BI;
        for (let i = 0; i < bestPoolPath.length; i++) {
            const token0 = bestPoolPath[i].token0;
            const sellToken = bestPath[i];
            if (sellToken !== token0) {
                directions = directions | (ONE_BI << BigInt(i));
            }
        }

        // sanity check
        if (mixPairs.length === 0) throw new Error('RouteProxy: PAIRS_EMPTY');
        if (mixPairs.length !== mixAdapters.length) throw new Error('RouteProxy: PAIR_ADAPTER_NOT_MATCH');
        if (mixPairs.length !== assetTo.length - 1) throw new Error('RouteProxy: PAIR_ASSETTO_NOT_MATCH');
        if (minReturnAmount === ZERO_BI) throw new Error('RouteProxy: RETURN_AMOUNT_ZERO');

        return {
            fromTokenAddress: fromTokenAddressNonZero as `0x${string}`,
            toTokenAddress: toTokenAddressNonZero as `0x${string}`,
            fromTokenAmount,
            minReturnAmount,
            mixAdapters,
            mixPairs,
            assetTo,
            directions,
            moreInfos,
            feeData: feeData as Hex,
            deadline,
        };
    }
    async encodeMixSwapData(params: MixSwapRawInput): Promise<TransactionRequest> {
        const paramForContract = await this._getMixSwapDataFromRawParams(params);
        const aggregatorAddress = this.getOysterAggregatorAddress();

        const data = encodeFunctionData({
            abi: OysterAggregatorABI,
            functionName: 'mixSwap',
            args: [
                paramForContract.fromTokenAddress as `0x${string}`,
                paramForContract.toTokenAddress as `0x${string}`,
                paramForContract.fromTokenAmount,
                paramForContract.minReturnAmount,
                paramForContract.mixAdapters,
                paramForContract.mixPairs,
                paramForContract.assetTo,
                paramForContract.directions,
                paramForContract.moreInfos,
                paramForContract.feeData,
                BigInt(paramForContract.deadline),
            ],
        });

        return {
            to: aggregatorAddress as `0x${string}`,
            data,
            value: paramForContract.fromTokenAddress === ETH_ADDRESS ? paramForContract.fromTokenAmount : 0n,
        };
    }

    private async _getMultiSwapDataFromRawParams(params: MultiSwapRawInput): Promise<MultiSwapParam> {
        const {
            fromToken,
            fromTokenAmount,
            toToken,
            bestPathInfo,
            bestAmount,
            broker,
            brokerFeeRate,
            userParams,
        } = params;
        const { slippageInBps, deadline } = userParams;

        const fromTokenAddress = fromToken.address;
        const toTokenAddress = toToken.address;
        const fromTokenAddressNonZero = zeroToETHForSwap(fromTokenAddress);
        const toTokenAddressNonZero = zeroToETHForSwap(toTokenAddress);
        const aggregatorAddress = this.getOysterAggregatorAddress();

        const minReturnAmount = (bestAmount * (RATIO_BASE_BI - BigInt(slippageInBps))) / RATIO_BASE_BI;
        const splitNumber = [0];
        const assetTo: `0x${string}`[] = [];
        const sequence: Hex[] = [];
        for (let i = 0; i < bestPathInfo.oneHops.length; i++) {
            const token0 = bestPathInfo.tokens[i];

            const pools = bestPathInfo.oneHops[i].pools;
            const weights = bestPathInfo.oneHops[i].weights;
            splitNumber.push(splitNumber[i] + pools.length);
            if (pools.length > 1) {
                assetTo.push(aggregatorAddress as `0x${string}`);
            } else {
                const poolInfo = bestPathInfo.oneHops[i].pools[0];
                if (poolInfo.swapType === SwapType.DIRECT) {
                    assetTo.push(poolInfo.poolAddr as `0x${string}`);
                } else if (poolInfo.swapType === SwapType.ADAPTER) {
                    assetTo.push((await this.getPoolAdapter(poolInfo.poolType)) as `0x${string}`);
                } else {
                    throw new Error(`Invalid swap type: ${poolInfo.swapType}`);
                }
            }
            for (let j = 0; j < pools.length; j++) {
                const poolInfo = pools[j];
                const sequencePool = poolInfo.poolAddr as `0x${string}`;
                const sequenceMixAdapter = (await this.getPoolAdapter(poolInfo.poolType)) as `0x${string}`;
                const direction = token0 === poolInfo.token0 ? ZERO_BI : ONE_BI;
                const poolEdition = BigInt(poolInfo.swapType) & 0b111n;
                const weight = weights[j] ?? ZERO_BI;
                const mixPara = direction + (poolEdition << 1n) + (weight << 3n);
                const sequenceMixPara = mixPara;
                const sequenceMoreInfo = '0x';
                sequence.push(
                    encodeAbiParameters(MULTISWAP_SEQUENCE_PARAMS, [
                        sequencePool,
                        sequenceMixAdapter,
                        sequenceMixPara,
                        sequenceMoreInfo as `0x${string}`,
                    ]) as Hex,
                );
            }
        }
        assetTo.push(aggregatorAddress as `0x${string}`);
        const midToken: string[] = [...bestPathInfo.tokens];
        midToken[0] = fromTokenAddressNonZero;
        midToken[midToken.length - 1] = toTokenAddressNonZero;
        const feeData = encodeAbiParameters(BROKER_FEE_PARAMS, [broker as `0x${string}`, brokerFeeRate]);

        if (assetTo.length !== splitNumber.length) throw new Error('RouteProxy: PAIR_ASSETTO_NOT_MATCH');
        if (minReturnAmount === ZERO_BI) throw new Error('RouteProxy: RETURN_AMOUNT_ZERO');

        return {
            fromTokenAddress: fromTokenAddressNonZero as `0x${string}`,
            fromTokenAmount,
            minReturnAmount,
            splitNumber,
            midToken: midToken.map((addr) => addr as `0x${string}`),
            assetTo,
            sequence,
            feeData: feeData as Hex,
            deadline,
        };
    }

    async encodeMultiSwapData(params: MultiSwapRawInput): Promise<TransactionRequest> {
        const paramForContract = await this._getMultiSwapDataFromRawParams(params);
        const aggregatorAddress = this.getOysterAggregatorAddress();

        const data = encodeFunctionData({
            abi: OysterAggregatorABI,
            functionName: 'multiSwap',
            args: [
                paramForContract.fromTokenAmount,
                paramForContract.minReturnAmount,
                paramForContract.splitNumber.map((num) => BigInt(num)),
                paramForContract.midToken,
                paramForContract.assetTo,
                paramForContract.sequence, 
                paramForContract.feeData,
                BigInt(paramForContract.deadline),
            ],
        });

        return {
            to: aggregatorAddress as `0x${string}`,
            data,
            value: paramForContract.fromTokenAddress === ETH_ADDRESS ? paramForContract.fromTokenAmount : 0n,
        };
    }
}
