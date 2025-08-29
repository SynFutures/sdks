import { TransactionReceipt } from '@ethersproject/abstract-provider';
import { BigNumber, ethers, PopulatedTransaction } from 'ethers';
import { AbiCoder, parseUnits } from 'ethers/lib/utils';
import { TxOptionsWithSigner, TxOptions, utils, RATIO_BASE, TickMath } from '@synfutures/sdks-perp';
import {
    Config,
    Config__factory,
    OysterAggregator,
    OysterAggregator__factory,
    QuerySingleRoute,
    QuerySingleRoute__factory,
    QuerySplitRoute,
    QuerySplitRoute__factory,
    IWETH__factory,
} from './typechain';
import QuoterV2ABI from './abis/QuoterV2.json';
import { Context, formatUnits, fromWad, ONE, ZERO, ZERO_ADDRESS } from '@derivation-tech/context';
import { AggregatorInterface } from './aggregator.interface';
import {
    CONFIG_ADDRESS,
    ETH_ADDRESS,
    OYSTER_AGGREGATOR_ADDRESS,
    QUERY_SINGLE_ROUTE_ADDRESS,
    QUERY_SPLIT_ROUTE_ADDRESS,
} from './constants';
import { OneHop, Pair, PoolType, SplitPathInfo, SwapType } from './types';
import {
    GetAmountsOutParam,
    GetAmountsOutResult,
    GetMidPricesParam,
    GetMidPricesResult,
    GetPoolLiquidityParam,
    GetPoolLiquidityResult,
    MixSwapParam,
    MultiSwapParam,
    QueryDirectRouteParam,
    QueryDirectRouteResult,
    QuerySingleRouteParam,
    QuerySingleRouteResult,
    QuerySplitRouteParam,
    QuerySplitRouteResult,
    SimulateMixSwapParam,
    SimulateMultiSwapParam,
    SimulateMixSwapResult,
    SimulateMultiSwapResult,
    QuerySinglePoolRouteParam,
    SimulateMTSinglePoolParam,
    SimulateMTSinglePoolResult,
    TradeToPriceParam,
} from './params';
import {
    analyzePoolLiquidity,
    fitPoolCurves,
    getDexFlag,
    getDexFlagAndSplits,
    toWrappedETH,
    zeroToETHForSwap,
    adjustLiquidityResults,
} from './utils';

export class AggregatorModule implements AggregatorInterface {
    context: Context;

    private poolAdapters: Map<number, string> = new Map();
    private DEFAULT_GAS_LIMIT_MULTIPLE = 1.5;

    get querySingleRouteContract(): QuerySingleRoute {
        return QuerySingleRoute__factory.connect(
            QUERY_SINGLE_ROUTE_ADDRESS[this.context.chainId] ?? ZERO_ADDRESS,
            this.context.provider,
        );
    }

    get querySplitRouteContract(): QuerySplitRoute {
        return QuerySplitRoute__factory.connect(
            QUERY_SPLIT_ROUTE_ADDRESS[this.context.chainId] ?? ZERO_ADDRESS,
            this.context.provider,
        );
    }

    get oysterAggregator(): OysterAggregator {
        return OysterAggregator__factory.connect(
            OYSTER_AGGREGATOR_ADDRESS[this.context.chainId] ?? ZERO_ADDRESS,
            this.context.provider,
        );
    }

    get config(): Config {
        return Config__factory.connect(CONFIG_ADDRESS[this.context.chainId] ?? ZERO_ADDRESS, this.context.provider);
    }

    async getPoolList(
        token0Address: string,
        token1Address: string,
        excludePoolTypes: PoolType[] = [],
    ): Promise<Pair[]> {
        const res = await this.config.callStatic.getPoolsWithFlag(
            token0Address,
            token1Address,
            getDexFlag(excludePoolTypes),
        );
        return res;
    }

    async getPoolAdapter(poolType: PoolType): Promise<string> {
        const res = this.poolAdapters.get(poolType);
        if (!res) {
            try {
                const poolAdapter = await this.config.getPoolAdapter(poolType);
                this.poolAdapters.set(poolType, poolAdapter);
                return poolAdapter;
            } catch (e) {
                throw new Error(`Pool adapter not found for pool type ${poolType}, reason: ${e}`);
            }
        }
        return res;
    }

    constructor(context: Context) {
        this.context = context;
    }

    async init(): Promise<void> {
        if (this.config.address === ZERO_ADDRESS) {
            // ignore unsupport chain
            return;
        }

        // Get only the numeric values from PoolType
        const poolTypes = Object.values(PoolType).filter((value) => !isNaN(Number(value)));

        const multicallCalls = poolTypes.map((poolType) => ({
            target: this.config.address,
            callData: this.config.interface.encodeFunctionData('getPoolAdapter', [poolType]),
        }));

        const multicallResults = (await this.context.multiCall3.callStatic.aggregate(multicallCalls)).returnData;

        for (let i = 0; i < poolTypes.length; i++) {
            const decoded = this.config.interface.decodeFunctionResult('getPoolAdapter', multicallResults[i]);
            this.poolAdapters.set(Number(poolTypes[i]), decoded[0]);
        }
    }

    async getMidPrices(params: GetMidPricesParam): Promise<GetMidPricesResult> {
        const res = await this.config.callStatic.getMidPrices(params.poolAddresses, params.poolTypes, params.isBuy);
        return {
            midPrices: res.prices,
            token0Balances: res.token0bals,
            token1Balances: res.token1bals,
        };
    }

    async getAmountsOut(params: GetAmountsOutParam): Promise<GetAmountsOutResult> {
        const res = await this.config.callStatic.getAmountsOut(
            params.pool,
            params.poolType,
            params.zeroForOne,
            params.amountsIn,
        );
        return {
            amountsOut: res,
        };
    }

    async queryDirectRoute(params: QueryDirectRouteParam): Promise<QueryDirectRouteResult> {
        params.fromTokenAddress = toWrappedETH(this.context, params.fromTokenAddress);
        params.toTokenAddress = toWrappedETH(this.context, params.toTokenAddress);

        const res = await this.querySingleRouteContract.callStatic.querySingleRoute(
            params.fromTokenAddress,
            params.toTokenAddress,
            params.fromAmount,
            getDexFlag(params.excludePoolTypes),
        );

        return {
            bestAmount: res.resAmount.bestAmount,
            midPrice: res.resAmount.midPrice,
            bestPath: res.bestPath,
            bestPoolPath: res.bestPoolPath,
        };
    }

    async querySingleRoute(params: QuerySingleRouteParam): Promise<QuerySingleRouteResult> {
        params.fromTokenAddress = toWrappedETH(this.context, params.fromTokenAddress);
        params.toTokenAddress = toWrappedETH(this.context, params.toTokenAddress);
        const res = await this.querySingleRouteContract.callStatic.querySingleRoute(
            params.fromTokenAddress,
            params.toTokenAddress,
            params.fromAmount,
            getDexFlag(params.excludePoolTypes),
        );
        return {
            bestAmount: res.resAmount.bestAmount,
            midPrice: res.resAmount.midPrice,
            bestPath: res.bestPath,
            bestPoolPath: res.bestPoolPath,
        };
    }

    async querySplitRoute(params: QuerySplitRouteParam): Promise<QuerySplitRouteResult> {
        params.fromTokenAddress = toWrappedETH(this.context, params.fromTokenAddress);
        params.toTokenAddress = toWrappedETH(this.context, params.toTokenAddress);
        const res = await this.querySplitRouteContract.callStatic.querySplitRoute(
            params.fromTokenAddress,
            params.toTokenAddress,
            params.fromAmount,
            params.isDirect,
            getDexFlagAndSplits(params.excludePoolTypes, params.splitNumber ?? 0),
            params.specifiedMiddleToken ?? ZERO_ADDRESS,
        );
        const filteredOneHops = res.bestPathInfo.oneHops.map((hop) => ({
            ...hop,
            pools: hop.pools.filter((pool) => hop.weights[hop.pools.indexOf(pool)].gt(ZERO)),
            weights: hop.weights.filter((weight) => weight.gt(ZERO)),
        }));
        return {
            bestAmount: res.resAmount.bestAmount,
            midPrice: res.resAmount.midPrice,
            bestPathInfo: {
                ...res.bestPathInfo,
                oneHops: filteredOneHops,
            },
        };
    }

    async simulateMixSwap(params: SimulateMixSwapParam): Promise<SimulateMixSwapResult> {
        const querySingleRouteResult = await this.querySingleRoute({
            fromTokenAddress: params.fromTokenAddress,
            toTokenAddress: params.toTokenAddress,
            fromAmount: params.fromAmount,
            excludePoolTypes: params.excludePoolTypes,
        });

        const minReturnAmount = querySingleRouteResult.bestAmount
            .mul(RATIO_BASE - params.slippageInBps)
            .div(RATIO_BASE);
        const bestAmount = Number(formatUnits(querySingleRouteResult.bestAmount, params.toTokenDecimals));
        const midPrice = Number(formatUnits(querySingleRouteResult.midPrice, 18));
        const numberFromTokenAmount = Number(formatUnits(params.fromAmount, params.fromTokenDecimals));
        return {
            priceImpact: Math.max(bestAmount / (numberFromTokenAmount * midPrice) - 1, 0),
            minReceivedAmount: minReturnAmount,
            route: querySingleRouteResult.bestPoolPath.map((pool) => pool.poolType),
        };
    }

    async simulateMultiSwap(params: SimulateMultiSwapParam): Promise<SimulateMultiSwapResult> {
        const querySplitRouteResult = await this.querySplitRoute({
            fromTokenAddress: params.fromTokenAddress,
            toTokenAddress: params.toTokenAddress,
            fromAmount: params.fromAmount,
            excludePoolTypes: params.excludePoolTypes,
            isDirect: params.isDirect,
        });

        const minReturnAmount = querySplitRouteResult.bestAmount.mul(RATIO_BASE - params.slippageInBps).div(RATIO_BASE);

        const WAD = BigNumber.from(10).pow(18); // 1e18
        const fromTokenDecimalCorrect = BigNumber.from(10).pow(params.fromTokenDecimals);
        const toTokenDecimalCorrect = BigNumber.from(10).pow(params.toTokenDecimals);

        // priceImpact: (bestAmount / (fromAmount * midPrice)) - 1
        const priceImpactBN = querySplitRouteResult.bestAmount
            .mul(fromTokenDecimalCorrect)
            .mul(WAD)
            .div(params.fromAmount.mul(toTokenDecimalCorrect).mul(querySplitRouteResult.midPrice).div(WAD));

        return {
            priceImpact: Math.min(Number(formatUnits(priceImpactBN, 18)) - 1, 0),
            minReceivedAmount: minReturnAmount,
            route: querySplitRouteResult.bestPathInfo.oneHops.map((hop) =>
                hop.pools.map((pool) => ({
                    poolAddr: pool.poolAddr,
                    poolType: pool.poolType,
                    ratio: hop.weights[hop.pools.indexOf(pool)],
                    fee: pool.fee,
                })),
            ),
            tokens: querySplitRouteResult.bestPathInfo.tokens,
        };
    }

    async getPoolLiquidity(params: GetPoolLiquidityParam): Promise<GetPoolLiquidityResult> {
        params.blockTag = params.blockTag ?? (await this.context.provider.getBlockNumber());

        const [{ prices: sellPrices, token0bals, token1bals }, { prices: buyPrices }] = await Promise.all([
            this.config.getMidPrices(
                params.pools.map((pool) => pool.poolAddr),
                params.pools.map((pool) => pool.poolType),
                false,
                {
                    blockTag: params.blockTag,
                },
            ),
            this.config.getMidPrices(
                params.pools.map((pool) => pool.poolAddr),
                params.pools.map((pool) => pool.poolType),
                true,
                {
                    blockTag: params.blockTag,
                },
            ),
        ]);

        const avgSellPrice = sellPrices.reduce((sum, price) => sum + fromWad(price), 0) / sellPrices.length;
        const avgBuyPrice = buyPrices.reduce((sum, price) => sum + fromWad(price), 0) / buyPrices.length;
        const avgMidPrice = (avgSellPrice + avgBuyPrice) / 2;

        const allPoolCurves = await utils.limitedMap(
            params.pools,
            (pool) =>
                fitPoolCurves(
                    this.config,
                    pool.poolAddr,
                    pool.poolType,
                    token0bals[params.pools.indexOf(pool)],
                    token1bals[params.pools.indexOf(pool)],
                    params.token0Decimal,
                    params.token1Decimal,
                    params.ratio,
                    params.steps,
                    params.batchSize,
                    params.blockTag,
                ),
            params.parallel ?? 3,
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

    private async _mixSwap(params: MixSwapParam) {
        const {
            fromTokenAddress,
            fromTokenAmount,
            toTokenAddress,
            bestPath,
            bestPoolPath,
            bestAmount,
            slippageInBps,
            broker,
            brokerFeeRate,
            deadline,
        } = params;

        const fromTokenAddressNonZero = zeroToETHForSwap(fromTokenAddress);
        const toTokenAddressNonZero = zeroToETHForSwap(toTokenAddress);

        // construct mixSwap params
        const minReturnAmount = bestAmount.mul(RATIO_BASE - slippageInBps).div(RATIO_BASE);
        const mixAdapters = await Promise.all(bestPoolPath.map((pair) => this.getPoolAdapter(pair.poolType)));
        const mixPairs = bestPoolPath.map((pair) => pair.poolAddr);
        const assetTo = await Promise.all(
            bestPoolPath.map((pair) => {
                if (pair.swapType === SwapType.DIRECT) {
                    return pair.poolAddr;
                } else if (pair.swapType === SwapType.ADAPTER) {
                    return this.getPoolAdapter(pair.poolType);
                } else {
                    throw new Error(`Invalid swap type: ${pair.swapType}`);
                }
            }),
        );
        assetTo.push(this.oysterAggregator.address);
        // default to empty string for now, may be used in new pool adapters
        const moreInfos = new Array(bestPoolPath.length).fill('0x');
        const feeData = new ethers.utils.AbiCoder().encode(['address', 'uint256'], [broker, brokerFeeRate]);
        let directions = ZERO;
        for (let i = 0; i < bestPoolPath.length; i++) {
            const token0 = bestPoolPath[i].token0;
            const sellToken = bestPath[i];
            if (sellToken !== token0) {
                directions = directions.add(ONE.shl(i));
            }
        }

        // sanity check
        if (mixPairs.length === 0) throw new Error('RouteProxy: PAIRS_EMPTY');
        if (mixPairs.length !== mixAdapters.length) throw new Error('RouteProxy: PAIR_ADAPTER_NOT_MATCH');
        if (mixPairs.length !== assetTo.length - 1) throw new Error('RouteProxy: PAIR_ASSETTO_NOT_MATCH');
        if (minReturnAmount.eq(ZERO)) throw new Error('RouteProxy: RETURN_AMOUNT_ZERO');

        return {
            fromTokenAddress: fromTokenAddressNonZero,
            toTokenAddress: toTokenAddressNonZero,
            fromTokenAmount,
            minReturnAmount,
            mixAdapters,
            mixPairs,
            assetTo,
            directions,
            moreInfos,
            feeData,
            deadline,
        };
    }

    mixSwap(params: MixSwapParam, txOptions: TxOptionsWithSigner): Promise<TransactionReceipt>;
    mixSwap(params: MixSwapParam, txOptions?: TxOptions): Promise<PopulatedTransaction>;
    async mixSwap(params: MixSwapParam, txOptions?: TxOptions): Promise<TransactionReceipt | PopulatedTransaction> {
        const {
            fromTokenAddress,
            toTokenAddress,
            fromTokenAmount,
            minReturnAmount,
            mixAdapters,
            mixPairs,
            assetTo,
            directions,
            moreInfos,
            feeData,
            deadline,
        } = await this._mixSwap(params);

        txOptions = {
            ...txOptions,
            value: fromTokenAddress === ETH_ADDRESS ? fromTokenAmount : ZERO,
            gasLimitMultiple: txOptions?.gasLimitMultiple ?? this.DEFAULT_GAS_LIMIT_MULTIPLE,
        };

        const tx = await this.oysterAggregator.populateTransaction.mixSwap(
            fromTokenAddress,
            toTokenAddress,
            fromTokenAmount,
            minReturnAmount,
            mixAdapters,
            mixPairs,
            assetTo,
            directions,
            moreInfos,
            feeData,
            deadline,
            { ...utils.toPopulatedTxOverrides(txOptions), from: await txOptions?.from },
        );
        return await this.context.tx.sendTx(tx, txOptions);
    }

    private async _multiSwap(params: MultiSwapParam) {
        const {
            fromTokenAddress,
            fromTokenAmount,
            toTokenAddress,
            bestPathInfo,
            bestAmount,
            slippageInBps,
            broker,
            brokerFeeRate,
            deadline,
        } = params;

        const fromTokenAddressNonZero = zeroToETHForSwap(fromTokenAddress);
        const toTokenAddressNonZero = zeroToETHForSwap(toTokenAddress);

        const minReturnAmount = bestAmount.mul(RATIO_BASE - slippageInBps).div(RATIO_BASE);
        const splitNumber = [0];
        const assetTo = [];
        const sequence = [];
        for (let i = 0; i < bestPathInfo.oneHops.length; i++) {
            const token0 = bestPathInfo.tokens[i];

            const pools = bestPathInfo.oneHops[i].pools;
            const weights = bestPathInfo.oneHops[i].weights;
            splitNumber.push(splitNumber[i] + pools.length);
            if (pools.length > 1) {
                assetTo.push(this.oysterAggregator.address);
            } else {
                const poolInfo = bestPathInfo.oneHops[i].pools[0];
                if (poolInfo.swapType === SwapType.DIRECT) {
                    assetTo.push(poolInfo.poolAddr);
                } else if (poolInfo.swapType === SwapType.ADAPTER) {
                    assetTo.push(await this.getPoolAdapter(poolInfo.poolType));
                } else {
                    throw new Error(`Invalid swap type: ${poolInfo.swapType}`);
                }
            }
            for (let j = 0; j < pools.length; j++) {
                const poolInfo = pools[j];
                const sequencePool = poolInfo.poolAddr;
                const sequenceMixAdapter = await this.getPoolAdapter(poolInfo.poolType);
                const direction = token0 === poolInfo.token0 ? ZERO : ONE;
                const poolEdition = BigNumber.from(poolInfo.swapType).mask(3);
                const weight = weights[j]; //BigNumber.from(weights[j]).mask((1 << 64) - 1);
                const mixPara = direction.add(poolEdition.shl(1)).add(weight.shl(3));
                const sequenceMixPara = mixPara;
                const sequenceMoreInfo = '0x';
                const abiCoder = new AbiCoder();
                sequence.push(
                    abiCoder.encode(
                        ['address', 'address', 'uint256', 'bytes'],
                        [sequencePool, sequenceMixAdapter, sequenceMixPara, sequenceMoreInfo],
                    ),
                );
            }
        }
        assetTo.push(this.oysterAggregator.address);
        const midToken: string[] = [...bestPathInfo.tokens];
        midToken[0] = fromTokenAddressNonZero;
        midToken[midToken.length - 1] = toTokenAddressNonZero;
        const feeData = new ethers.utils.AbiCoder().encode(['address', 'uint256'], [broker, brokerFeeRate]);

        if (assetTo.length !== splitNumber.length) throw new Error('RouteProxy: PAIR_ASSETTO_NOT_MATCH');
        if (minReturnAmount.eq(ZERO)) throw new Error('RouteProxy: RETURN_AMOUNT_ZERO');

        return {
            fromTokenAddress: fromTokenAddressNonZero,
            fromTokenAmount,
            minReturnAmount,
            splitNumber,
            midToken,
            assetTo,
            sequence,
            feeData,
            deadline,
        };
    }

    async multiSwap(params: MultiSwapParam, txOptions: TxOptionsWithSigner): Promise<TransactionReceipt>;
    async multiSwap(params: MultiSwapParam, txOptions?: TxOptions): Promise<PopulatedTransaction>;
    async multiSwap(params: MultiSwapParam, txOptions?: TxOptions): Promise<TransactionReceipt | PopulatedTransaction> {
        const {
            fromTokenAddress,
            fromTokenAmount,
            minReturnAmount,
            splitNumber,
            midToken,
            assetTo,
            sequence,
            feeData,
            deadline,
        } = await this._multiSwap(params);

        txOptions = {
            ...txOptions,
            value: fromTokenAddress === ETH_ADDRESS ? fromTokenAmount : ZERO,
            gasLimitMultiple: txOptions?.gasLimitMultiple ?? this.DEFAULT_GAS_LIMIT_MULTIPLE,
        };

        const tx = await this.oysterAggregator.populateTransaction.multiSwap(
            fromTokenAmount,
            minReturnAmount,
            splitNumber,
            midToken,
            assetTo,
            sequence,
            feeData,
            deadline,
            { ...utils.toPopulatedTxOverrides(txOptions), from: await txOptions?.from },
        );
        return await this.context.tx.sendTx(tx, txOptions);
    }

    private async _wethConvert(params: { fromTokenAddress: string; toTokenAddress: string; amount: BigNumber }) {
        const isFromETH = params.fromTokenAddress.toLowerCase() === ZERO_ADDRESS.toLowerCase();
        const isToETH = params.toTokenAddress.toLowerCase() === ZERO_ADDRESS.toLowerCase();

        if ((!isFromETH && !isToETH) || isFromETH == isToETH) {
            throw new Error('At least one token must be ETH for WETH conversion');
        }

        return {
            fromTokenAddress: params.fromTokenAddress,
            amount: params.amount,
        };
    }

    wethConvert(
        params: {
            fromTokenAddress: string;
            toTokenAddress: string;
            amount: BigNumber;
        },
        txOptions: TxOptionsWithSigner,
    ): Promise<TransactionReceipt>;
    wethConvert(
        params: {
            fromTokenAddress: string;
            toTokenAddress: string;
            amount: BigNumber;
        },
        txOptions?: TxOptions,
    ): Promise<PopulatedTransaction>;
    async wethConvert(
        params: {
            fromTokenAddress: string;
            toTokenAddress: string;
            amount: BigNumber;
        },
        txOptions?: TxOptions,
    ): Promise<TransactionReceipt | PopulatedTransaction> {
        const { fromTokenAddress, amount } = await this._wethConvert(params);
        const isFromETH = fromTokenAddress.toLowerCase() === ZERO_ADDRESS.toLowerCase();
        const weth = IWETH__factory.connect(this.context.wrappedNativeToken.address, this.context.provider);

        txOptions = {
            ...txOptions,
            value: isFromETH ? amount : ZERO,
            gasLimitMultiple: txOptions?.gasLimitMultiple ?? this.DEFAULT_GAS_LIMIT_MULTIPLE,
        };

        const tx = isFromETH
            ? await weth.populateTransaction.deposit({
                  ...utils.toPopulatedTxOverrides(txOptions),
                  value: amount,
                  from: await txOptions?.from,
              })
            : await weth.populateTransaction.withdraw(amount, {
                  ...utils.toPopulatedTxOverrides(txOptions),
                  from: await txOptions?.from,
              });

        return await this.context.tx.sendTx(tx, txOptions);
    }

    async querySinglePoolRoute(params: QuerySinglePoolRouteParam): Promise<QuerySplitRouteResult> {
        // Convert ETH addresses to WETH
        params.fromTokenAddress = toWrappedETH(this.context, params.fromTokenAddress);
        params.toTokenAddress = toWrappedETH(this.context, params.toTokenAddress);

        // Use provided adapter address or get default adapter for OYSTER pool type
        const adapterAddress = params.adapterAddress || (await this.getPoolAdapter(PoolType.OYSTER_NEW));

        // Create adapter contract interface
        const adapterInterface = new ethers.utils.Interface([
            'function querySell(address fromToken, uint256 fromAmount, address pool) external returns (address toToken, uint256 toAmount)',
            'function getMidPriceAndBalances(address pool, bool isBuy) external view returns (uint256 price, uint256 token0bal, uint256 token1bal)',
        ]);

        // Determine if this is a buy operation based on token addresses lexicographical order
        // Since token0 < token1 strictly holds, we can determine isBuy by comparing fromToken and toToken
        const isBuy = params.fromTokenAddress.toLowerCase() < params.toTokenAddress.toLowerCase();

        // Prepare multicall data
        const multicallCalls = [
            {
                target: adapterAddress,
                callData: adapterInterface.encodeFunctionData('querySell', [
                    params.fromTokenAddress,
                    params.fromAmount,
                    params.poolAddress,
                ]),
            },
            {
                target: adapterAddress,
                callData: adapterInterface.encodeFunctionData('getMidPriceAndBalances', [params.poolAddress, isBuy]),
            },
        ];

        // Execute multicall
        const multicallResults = (await this.context.multiCall3.callStatic.aggregate(multicallCalls)).returnData;

        // Decode results
        const [, toAmount] = adapterInterface.decodeFunctionResult('querySell', multicallResults[0]);
        const [midPrice, ,] = adapterInterface.decodeFunctionResult('getMidPriceAndBalances', multicallResults[1]);
        const correctMidPrice = isBuy ? midPrice : BigNumber.from(10).pow(36).div(midPrice);

        // Create pool info with token addresses in correct order (token0 < token1)
        const [token0, token1] = isBuy
            ? [params.fromTokenAddress, params.toTokenAddress]
            : [params.toTokenAddress, params.fromTokenAddress];

        const poolInfo: Pair = {
            token0,
            token1,
            poolAddr: params.poolAddress,
            poolType: PoolType.OYSTER_NEW,
            fee: ZERO, // Default fee, can be updated if needed
            swapType: SwapType.ADAPTER,
        };

        // Create one hop with single pool
        const oneHop: OneHop = {
            pools: [poolInfo],
            weights: [ONE], // Single pool gets 100% weight
        };

        // Create best path info
        const bestPathInfo: SplitPathInfo = {
            tokens: [params.fromTokenAddress, params.toTokenAddress],
            oneHops: [oneHop],
            finalAmountOut: toAmount,
            isValid: true,
        };

        return {
            bestAmount: toAmount,
            midPrice: correctMidPrice,
            bestPathInfo: bestPathInfo,
        };
    }

    async simulateMTSinglePool(params: SimulateMTSinglePoolParam): Promise<SimulateMTSinglePoolResult> {
        const querySinglePoolRouteResult = await this.querySinglePoolRoute({
            fromTokenAddress: params.fromTokenAddress,
            toTokenAddress: params.toTokenAddress,
            fromAmount: params.fromAmount,
            poolAddress: params.poolAddress,
            adapterAddress: params.adapterAddress,
        });

        const minReturnAmount = querySinglePoolRouteResult.bestAmount
            .mul(RATIO_BASE - params.slippageInBps)
            .div(RATIO_BASE);

        const WAD = BigNumber.from(10).pow(18); // 1e18
        const fromTokenDecimalCorrect = BigNumber.from(10).pow(params.fromTokenDecimals);
        const toTokenDecimalCorrect = BigNumber.from(10).pow(params.toTokenDecimals);

        // priceImpact: (bestAmount / (fromAmount * midPrice)) - 1
        const priceImpactBN = querySinglePoolRouteResult.midPrice.gt(ZERO)
            ? querySinglePoolRouteResult.bestAmount
                  .mul(fromTokenDecimalCorrect)
                  .mul(WAD)
                  .div(params.fromAmount.mul(toTokenDecimalCorrect).mul(querySinglePoolRouteResult.midPrice).div(WAD))
            : ZERO;

        return {
            priceImpact: Math.min(Number(formatUnits(priceImpactBN, 18)) - 1, 0),
            minReceivedAmount: minReturnAmount,
            route: querySinglePoolRouteResult.bestPathInfo.oneHops.map((hop) =>
                hop.pools.map((pool) => ({
                    poolAddr: pool.poolAddr,
                    poolType: pool.poolType,
                    ratio: hop.weights[hop.pools.indexOf(pool)],
                    fee: pool.fee,
                })),
            ),
            tokens: querySinglePoolRouteResult.bestPathInfo.tokens,
        };
    }

    tradeToPrice(params: TradeToPriceParam, txOptions: TxOptionsWithSigner): Promise<TransactionReceipt[]>;
    tradeToPrice(params: TradeToPriceParam, txOptions?: TxOptions): Promise<PopulatedTransaction[]>;
    async tradeToPrice(
        params: TradeToPriceParam,
        txOptions?: TxOptions,
    ): Promise<TransactionReceipt[] | PopulatedTransaction[]> {
        const { poolAddress, targetPrice, userAddress } = params;

        // Set default values
        const slippageInBps = 200; // 2%
        const broker = ZERO_ADDRESS;
        const brokerFeeRate = ZERO;
        const deadline = Math.floor(Date.now() / 1000) + 300; // Current time + 300 seconds

        // Get token addresses and decimals from pool contract
        const poolInterface = new ethers.utils.Interface([
            'function token0() view returns (address)',
            'function token1() view returns (address)',
            'function fee() view returns (uint24)',
            'function slot0() view returns (uint160 sqrtPriceX96, int24 tick, uint16 observationIndex, uint16 observationCardinality, uint16 observationCardinalityNext, uint8 feeProtocol, bool unlocked)',
        ]);

        const erc20Interface = new ethers.utils.Interface(['function decimals() view returns (uint8)']);

        // Prepare multicall to get pool info
        const multicallCalls = [
            {
                target: poolAddress,
                callData: poolInterface.encodeFunctionData('token0', []),
            },
            {
                target: poolAddress,
                callData: poolInterface.encodeFunctionData('token1', []),
            },
            {
                target: poolAddress,
                callData: poolInterface.encodeFunctionData('fee', []),
            },
            {
                target: poolAddress,
                callData: poolInterface.encodeFunctionData('slot0', []),
            },
        ];

        const multicallResults = (await this.context.multiCall3.callStatic.aggregate(multicallCalls)).returnData;

        const poolToken0Address = poolInterface.decodeFunctionResult('token0', multicallResults[0])[0];
        const poolToken1Address = poolInterface.decodeFunctionResult('token1', multicallResults[1])[0];
        const poolFee = poolInterface.decodeFunctionResult('fee', multicallResults[2])[0];
        const slot0Result = poolInterface.decodeFunctionResult('slot0', multicallResults[3]);
        const currentTick = slot0Result.tick;

        // Check if pool contains wrapped native token and support native token swaps
        let token0Address: string = poolToken0Address;
        let token1Address: string = poolToken1Address;

        // If token0 is wrapped native token, support native token (ZERO_ADDRESS) for token0
        if (poolToken0Address.toLowerCase() === this.context.wrappedNativeToken.address.toLowerCase()) {
            token0Address = ZERO_ADDRESS;
        }

        // If token1 is wrapped native token, support native token (ZERO_ADDRESS) for token1
        if (poolToken1Address.toLowerCase() === this.context.wrappedNativeToken.address.toLowerCase()) {
            token1Address = ZERO_ADDRESS;
        }

        // Get token decimals (use pool addresses for decimals query)
        const decimalsCalls = [
            {
                target: poolToken0Address,
                callData: erc20Interface.encodeFunctionData('decimals', []),
            },
            {
                target: poolToken1Address,
                callData: erc20Interface.encodeFunctionData('decimals', []),
            },
        ];

        const decimalsResults = (await this.context.multiCall3.callStatic.aggregate(decimalsCalls)).returnData;
        const token0Decimals = erc20Interface.decodeFunctionResult('decimals', decimalsResults[0])[0];
        const token1Decimals = erc20Interface.decodeFunctionResult('decimals', decimalsResults[1])[0];

        // Get oyster adapter address (all pools are OYSTER_NEW)
        const adapterAddress = await this.getPoolAdapter(PoolType.OYSTER_NEW);

        // Create adapter interface to get quoterV2 address
        const adapterInterface = new ethers.utils.Interface(['function quoterV2() view returns (address)']);

        // Get quoterV2 address from adapter
        const quoterV2Address = await this.context.provider.call({
            to: adapterAddress,
            data: adapterInterface.encodeFunctionData('quoterV2', []),
        });
        const decodedQuoterV2Address = adapterInterface.decodeFunctionResult('quoterV2', quoterV2Address)[0];

        // Validate quoterV2 address
        if (!decodedQuoterV2Address || decodedQuoterV2Address === ZERO_ADDRESS) {
            throw new Error('Invalid quoterV2 address from adapter');
        }

        // Create QuoterV2 interface using the imported ABI
        const quoterV2 = new ethers.Contract(decodedQuoterV2Address, QuoterV2ABI, this.context.provider);

        const transactions: TransactionReceipt[] | PopulatedTransaction[] = [];

        if (targetPrice) {
            // calculate pool format target price
            const poolFormatTargetPrice = targetPrice
                .mul(BigNumber.from(10).pow(token1Decimals))
                .div(BigNumber.from(10).pow(token0Decimals));
            // Validate target price
            if (poolFormatTargetPrice.lte(ZERO)) {
                throw new Error('Target price must be greater than zero');
            }

            const currentPrice = TickMath.getWadAtTick(currentTick);

            // Determine direction: if target > current, buy token1 (sell token0)
            const isBuyingToken1 = poolFormatTargetPrice.gt(currentPrice);

            // Use wrapped addresses for routing queries
            const wrappedToken0 = toWrappedETH(this.context, token0Address);
            const wrappedToken1 = toWrappedETH(this.context, token1Address);

            const fromToken = isBuyingToken1 ? wrappedToken1 : wrappedToken0;
            const toToken = isBuyingToken1 ? wrappedToken0 : wrappedToken1;

            // Calculate sqrtPriceLimitX96 from target price
            const targetTick = TickMath.getTickAtPWad(poolFormatTargetPrice);
            const sqrtPriceLimitX96 = TickMath.getSqrtRatioAtTick(targetTick);

            // Create params struct for quoterV2
            const quoterParams = {
                tokenIn: fromToken,
                tokenOut: toToken,
                amount: parseUnits('1000000', 18),
                fee: poolFee,
                sqrtPriceLimitX96: sqrtPriceLimitX96,
            };

            // Query quoterV2 for required input amount
            let quoteResult;
            try {
                quoteResult = await quoterV2.callStatic.quoteExactOutputSingle(quoterParams);
            } catch (error) {
                throw new Error(`Failed to query quoterV2: ${error.message}`);
            }

            const requiredAmountIn = quoteResult.amountIn;

            // Validate required amount
            if (requiredAmountIn.lte(ZERO)) {
                throw new Error('Invalid required amount from quoterV2');
            }

            // Determine original token addresses for transaction
            const originalFromToken = isBuyingToken1 ? token1Address : token0Address;
            const originalToToken = isBuyingToken1 ? token0Address : token1Address;

            // Check if fromToken is native token (zero address)
            const isFromNativeToken = originalFromToken.toLowerCase() === ZERO_ADDRESS.toLowerCase();

            // Check allowance only for ERC20 tokens
            if (!isFromNativeToken) {
                const erc20Contract = new ethers.Contract(
                    fromToken,
                    ['function allowance(address owner, address spender) view returns (uint256)'],
                    this.context.provider,
                );
                const allowance = await erc20Contract.allowance(userAddress, this.oysterAggregator.address);
                if (allowance.lt(requiredAmountIn)) {
                    throw new Error(
                        `Insufficient allowance for ${fromToken}. Required: ${formatUnits(requiredAmountIn, 18)}, Available: ${formatUnits(allowance, 18)}. Please approve first.`,
                    );
                }
            }

            // Query route for this trade using wrapped addresses
            const routeResult = await this.querySinglePoolRoute({
                fromTokenAddress: fromToken,
                toTokenAddress: toToken,
                fromAmount: requiredAmountIn,
                poolAddress,
            });

            // Convert token addresses for swap transaction
            const fromTokenForSwap = zeroToETHForSwap(originalFromToken);
            const toTokenForSwap = zeroToETHForSwap(originalToToken);

            // Create transaction for the trade using original addresses
            const tx = await this.multiSwap(
                {
                    fromTokenAddress: fromTokenForSwap,
                    toTokenAddress: toTokenForSwap,
                    fromTokenAmount: requiredAmountIn,
                    bestPathInfo: routeResult.bestPathInfo,
                    bestAmount: routeResult.bestAmount,
                    slippageInBps,
                    broker,
                    brokerFeeRate,
                    deadline,
                },
                txOptions,
            );

            transactions.push(tx as TransactionReceipt);
        } else {
            // Default behavior: small buy then sell
            // For native tokens, check ETH balance; for ERC20 tokens, check token balance
            let token0Balance: BigNumber;
            let token1Balance: BigNumber;

            if (token0Address.toLowerCase() === ZERO_ADDRESS.toLowerCase()) {
                // token0 is native token, check ETH balance
                token0Balance = await this.context.provider.getBalance(userAddress);
            } else {
                // token0 is ERC20, check token balance
                const erc20Token0 = new ethers.Contract(
                    token0Address,
                    ['function balanceOf(address account) view returns (uint256)'],
                    this.context.provider,
                );
                token0Balance = await erc20Token0.balanceOf(userAddress);
            }

            if (token1Address.toLowerCase() === ZERO_ADDRESS.toLowerCase()) {
                // token1 is native token, check ETH balance
                token1Balance = await this.context.provider.getBalance(userAddress);
            } else {
                // token1 is ERC20, check token balance
                const erc20Token1 = new ethers.Contract(
                    token1Address,
                    ['function balanceOf(address account) view returns (uint256)'],
                    this.context.provider,
                );
                token1Balance = await erc20Token1.balanceOf(userAddress);
            }

            // Choose direction based on which token user has more balance
            const useToken0First = token0Balance.gt(token1Balance);

            // Use wrapped addresses for routing queries
            const wrappedToken0 = toWrappedETH(this.context, token0Address);
            const wrappedToken1 = toWrappedETH(this.context, token1Address);

            const firstToken = useToken0First ? wrappedToken0 : wrappedToken1;
            const secondToken = useToken0First ? wrappedToken1 : wrappedToken0;
            const firstTokenDecimals = useToken0First ? token0Decimals : token1Decimals;
            const firstTokenBalance = useToken0First ? token0Balance : token1Balance;

            // Calculate smart trade amount: min(user balance, amount needed to move price by 0.2%)
            const currentPrice = TickMath.getWadAtTick(currentTick);

            // Calculate target price for 0.2% price movement based on trade direction
            const priceImpactBps = 20; // 0.2% = 20 basis points
            const targetPrice = useToken0First
                ? currentPrice.mul(RATIO_BASE - priceImpactBps).div(RATIO_BASE) // Price down 0.2%
                : currentPrice.mul(RATIO_BASE + priceImpactBps).div(RATIO_BASE); // Price up 0.2%

            // Calculate the tick and sqrtPriceLimitX96 for the target price
            const targetTick = TickMath.getTickAtPWad(targetPrice);
            const sqrtPriceLimitX96 = TickMath.getSqrtRatioAtTick(targetTick);

            // Calculate amount needed to reach target price
            const quoterParams = {
                tokenIn: firstToken,
                tokenOut: secondToken,
                amount: parseUnits('1000000', 18), // Large amount for estimation
                fee: poolFee,
                sqrtPriceLimitX96: sqrtPriceLimitX96,
            };

            let requiredAmountForPriceImpact: BigNumber;
            try {
                const quoteResult = await quoterV2.callStatic.quoteExactOutputSingle(quoterParams);
                requiredAmountForPriceImpact = quoteResult.amountIn;
            } catch (error) {
                // If quote fails, fallback to 1% of balance or minimum amount
                console.warn('Failed to calculate price impact amount, using fallback:', error.message);
                requiredAmountForPriceImpact = firstTokenBalance.div(100).gt(parseUnits('0.01', firstTokenDecimals))
                    ? firstTokenBalance.div(100)
                    : parseUnits('0.01', firstTokenDecimals);
            }

            // Reserve some balance for gas (for native tokens)
            const reservedBalance =
                token0Address.toLowerCase() === ZERO_ADDRESS.toLowerCase() ||
                token1Address.toLowerCase() === ZERO_ADDRESS.toLowerCase()
                    ? parseUnits('0.01', 18) // Reserve 0.01 ETH for gas
                    : ZERO;

            const availableBalance = firstTokenBalance.gt(reservedBalance)
                ? firstTokenBalance.sub(reservedBalance)
                : ZERO;

            // Take minimum of user balance and required amount for 0.2% price impact
            const tradeAmount = availableBalance.lt(requiredAmountForPriceImpact)
                ? availableBalance
                : requiredAmountForPriceImpact;

            // Determine original token addresses
            const originalFirstToken = useToken0First ? token0Address : token1Address;
            const originalSecondToken = useToken0First ? token1Address : token0Address;

            // Check allowance for first trade (only for ERC20 tokens)
            const isFirstTokenNative = originalFirstToken.toLowerCase() === ZERO_ADDRESS.toLowerCase();

            if (!isFirstTokenNative) {
                const erc20FirstToken = new ethers.Contract(
                    firstToken,
                    ['function allowance(address owner, address spender) view returns (uint256)'],
                    this.context.provider,
                );
                const allowance = await erc20FirstToken.allowance(userAddress, this.oysterAggregator.address);
                if (allowance.lt(tradeAmount)) {
                    throw new Error(
                        `Insufficient allowance for ${firstToken}. Required: ${formatUnits(tradeAmount, firstTokenDecimals)}, Available: ${formatUnits(allowance, firstTokenDecimals)}. Please approve first.`,
                    );
                }
            }

            // Trade 1: First token to second token
            const firstRoute = await this.querySinglePoolRoute({
                fromTokenAddress: firstToken,
                toTokenAddress: secondToken,
                fromAmount: tradeAmount,
                poolAddress,
            });

            // Convert token addresses for swap transaction
            const firstTokenForSwap = zeroToETHForSwap(originalFirstToken);
            const secondTokenForSwap = zeroToETHForSwap(originalSecondToken);

            const firstTx = await this.multiSwap(
                {
                    fromTokenAddress: firstTokenForSwap,
                    toTokenAddress: secondTokenForSwap,
                    fromTokenAmount: tradeAmount,
                    bestPathInfo: firstRoute.bestPathInfo,
                    bestAmount: firstRoute.bestAmount,
                    slippageInBps,
                    broker,
                    brokerFeeRate,
                    deadline,
                },
                txOptions,
            );

            transactions.push(firstTx as TransactionReceipt);

            // Trade 2: Second token back to first token
            const secondRoute = await this.querySinglePoolRoute({
                fromTokenAddress: secondToken,
                toTokenAddress: firstToken,
                fromAmount: firstRoute.bestAmount,
                poolAddress,
            });

            const secondTx = await this.multiSwap(
                {
                    fromTokenAddress: secondTokenForSwap,
                    toTokenAddress: firstTokenForSwap,
                    fromTokenAmount: firstRoute.bestAmount,
                    bestPathInfo: secondRoute.bestPathInfo,
                    bestAmount: secondRoute.bestAmount,
                    slippageInBps,
                    broker,
                    brokerFeeRate,
                    deadline,
                },
                txOptions,
            );

            transactions.push(secondTx as TransactionReceipt);
        }

        return transactions;
    }
}
