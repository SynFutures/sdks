import { BigNumber, PopulatedTransaction } from 'ethers';
import { TransactionReceipt } from '@ethersproject/abstract-provider';
import { TxOptions, TxOptionsWithSigner } from '@synfutures/sdks-perp';
import { Pair, PoolType } from './types';
import { OysterAggregator, QuerySplitRoute, QuerySingleRoute, Config } from './typechain';
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
    SimulateMixSwapResult,
    SimulateMultiSwapParam,
    SimulateMultiSwapResult,
    QuerySinglePoolRouteParam,
    SimulateMTSinglePoolParam,
    SimulateMTSinglePoolResult,
} from './params';

export interface AggregatorInterface {
    get querySingleRouteContract(): QuerySingleRoute;
    get querySplitRouteContract(): QuerySplitRoute;
    get oysterAggregator(): OysterAggregator;
    get config(): Config;

    getPoolList(token0Address: string, token1Address: string, excludePoolTypes?: PoolType[]): Promise<Pair[]>;

    getPoolAdapter(poolType: PoolType): Promise<string>;

    getMidPrices(params: GetMidPricesParam): Promise<GetMidPricesResult>;

    getAmountsOut(params: GetAmountsOutParam): Promise<GetAmountsOutResult>;

    queryDirectRoute(params: QueryDirectRouteParam): Promise<QueryDirectRouteResult>;

    querySplitRoute(params: QuerySplitRouteParam): Promise<QuerySplitRouteResult>;

    querySingleRoute(params: QuerySingleRouteParam): Promise<QuerySingleRouteResult>;

    simulateMixSwap(params: SimulateMixSwapParam): Promise<SimulateMixSwapResult>;

    simulateMultiSwap(params: SimulateMultiSwapParam): Promise<SimulateMultiSwapResult>;

    querySinglePoolRoute(params: QuerySinglePoolRouteParam): Promise<QuerySplitRouteResult>;

    simulateMTSinglePool(params: SimulateMTSinglePoolParam): Promise<SimulateMTSinglePoolResult>;

    getPoolLiquidity(params: GetPoolLiquidityParam): Promise<GetPoolLiquidityResult>;

    mixSwap(params: MixSwapParam, txOptions: TxOptionsWithSigner): Promise<TransactionReceipt>;
    mixSwap(params: MixSwapParam, txOptions?: TxOptions): Promise<PopulatedTransaction>;
    mixSwap(params: MixSwapParam, txOptions?: TxOptions): Promise<TransactionReceipt | PopulatedTransaction>;

    multiSwap(params: MultiSwapParam, txOptions: TxOptionsWithSigner): Promise<TransactionReceipt>;
    multiSwap(params: MultiSwapParam, txOptions?: TxOptions): Promise<PopulatedTransaction>;
    multiSwap(params: MultiSwapParam, txOptions?: TxOptions): Promise<TransactionReceipt | PopulatedTransaction>;

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
    wethConvert(
        params: {
            fromTokenAddress: string;
            toTokenAddress: string;
            amount: BigNumber;
        },
        txOptions?: TxOptions,
    ): Promise<TransactionReceipt | PopulatedTransaction>;

}
