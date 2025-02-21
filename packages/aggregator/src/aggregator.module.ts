import { TransactionReceipt } from '@ethersproject/abstract-provider';
import { BigNumber, ethers, PopulatedTransaction } from 'ethers';
import { AbiCoder } from 'ethers/lib/utils';
import { TxOptionsWithSigner, TxOptions, utils, RATIO_BASE } from '@synfutures/sdks-perp';
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
import { Context, formatUnits, fromWad, ONE, ZERO, ZERO_ADDRESS } from '@derivation-tech/context';
import { AggregatorInterface } from './aggregator.interface';
import {
    CONFIG_ADDRESS,
    ETH_ADDRESS,
    OYSTER_AGGREGATOR_ADDRESS,
    QUERY_SINGLE_ROUTE_ADDRESS,
    QUERY_SPLIT_ROUTE_ADDRESS,
} from './constants';
import { Pair, PoolType, SwapType } from './types';
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
}
