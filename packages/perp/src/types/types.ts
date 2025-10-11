import type { BlockInfo, CHAIN_ID } from '@derivation-tech/context';
import type { CallOverrides, Signer } from 'ethers';
import { CexMarket, DexV2Market, Beacon, Guardian, EmergingFeederFactory, PythFeederFactory } from '../typechain';
import { Config as LegacyConfig, Gate as LegacyGate, Observer as LegacyObserver } from '../typechain';
import { Config as CurrentConfig, Gate as CurrentGate, Observer as CurrentObserver } from '../typechain/current';
import type { FeederType, InstrumentCondition, MarketType, Side, Status } from '../enum';
import type { InstrumentSetting, QuoteParam } from './params';

export interface Portfolio {
    instrumentAddr: string;
    expiry: number;
    traderAddr: string;

    // oid->order
    orders: Map<number, Order>;
    // rid->range
    ranges: Map<number, Range>;
    position: Position;

    // additional
    isEmpty: boolean;

    isInverse?: boolean;

    blockInfo?: BlockInfo;
}

export interface FundFlow {
    totalIn: bigint;
    totalOut: bigint;
}

export interface Pending {
    timestamp: number;
    native: boolean;
    amount: bigint;
    exemption: bigint;
}

export interface Instrument {
    // redundant fields
    instrumentAddr: string;
    handler: string;

    // basic fields
    symbol: string;
    market: InstrumentMarket;
    condition: InstrumentCondition;
    setting: InstrumentSetting;
    spotPrice: bigint;
    // expiry => amm
    amms: Map<number, Amm>;
    base: BaseInfo;
    quote: TokenInfo;

    // additional fields
    instrumentType: FeederType;
    marketType: MarketType;
    minTradeValue: bigint;
    minOrderValue: bigint;
    minRangeValue: bigint;
    minTickDelta: number;

    displayBase: BaseInfo;
    displayQuote: TokenInfo;

    placePaused: boolean;
    fundingHour: number;
    disableOrderRebate: boolean;
    isInverse?: boolean;

    blockInfo?: BlockInfo;
}

export interface InstrumentInfo {
    chainId: CHAIN_ID;
    addr: string;
    handler: string;
    symbol: string;
    base: BaseInfo;
    quote: TokenInfo;
}

export interface InstrumentMarket extends Market {
    feeder: PriceFeeder | DexV2Feeder;
}

export interface Market {
    info: MarketInfo;
    config: MarketConfig;
}

export interface MarketInfo {
    addr: string;
    type: string;
    beacon: string;
}

export interface CexFeederSource {
    baseSymbol: string;
    quoteSymbol: string;
    ftype: FeederType;
    aggregator0: string;
    heartBeat0: number;
    aggregator1?: string;
    heartBeat1?: number;
}

export interface DexV2FeederSource {
    factory: string;
    router: string;
}

export interface MarketConfig {
    dailyInterestRate: number;
    feederSource: CexFeederSource[] | DexV2FeederSource[];
}

export interface PythMarketConfig extends MarketConfig {
    pythCore: string;
}

export interface PriceFeeder {
    ftype: FeederType;
    scaler0: bigint;
    aggregator0: string;
    heartBeat0: number;
    scaler1: bigint;
    aggregator1: string;
    heartBeat1: number;
}

export interface DexV2Feeder {
    ftype: FeederType;
    isToken0Quote: boolean;
    pair: string;
    scaler0: bigint;
    scaler1: bigint;
}

export interface RawOrder {
    // basic fields
    balance: bigint;
    size: bigint;
    taken: bigint;
    tick: number;
    nonce: number;
}

export interface Order extends RawOrder {
    // redundant fields
    instrumentAddr: string;
    expiry: number;
    traderAddr: string;

    // additional fields
    oid: number;
    side: Side;
    limitPrice: bigint;

    isInverse?: boolean;

    blockInfo?: BlockInfo;
}

// correspond Record in contract
// "Record" is a reserved keyword in TypeScript, so we can't use it as a type name.
export interface ContractRecord {
    taken: bigint;
    fee: bigint;
    entrySocialLossIndex: bigint;
    entryFundingIndex: bigint;
}

export interface RawAmm {
    // basic fields
    // timestamp of the specified expiry
    expiry: number;
    // for futures, it's the timestamp of moment switched to SETTLING
    // for perpetual, it's the timestamp of last funding fee update
    timestamp: number;
    status: Status;
    tick: number; // current tick. tick = floor(log_{1.0001}(sqrtPX96))
    sqrtPX96: bigint; // current price
    liquidity: bigint;
    totalLiquidity: bigint;
    involvedFund: bigint;
    openInterests: bigint;
    feeIndex: bigint;
    protocolFee: bigint;
    totalLong: bigint;
    totalShort: bigint;
    longSocialLossIndex: bigint;
    shortSocialLossIndex: bigint;
    longFundingIndex: bigint;
    shortFundingIndex: bigint;
    insuranceFund: bigint;
    settlementPrice: bigint;
    // the last updated block number of timestamp
    timestampUpdatedAt?: number;
    // mark price
    markPrice: bigint;
}

export interface Amm extends RawAmm {
    // redundant fields
    instrumentAddr: string;

    // additional fields
    fairPrice: bigint;

    isInverse?: boolean;

    blockInfo?: BlockInfo;
}

export interface Pearl {
    liquidityGross: bigint; // the total position liquidity that references this tick
    liquidityNet: bigint; // amount of net liquidity added (subtracted) when tick is crossed from left to right (right to left)
    nonce: number;
    fee: bigint;
    left: bigint;
    taken: bigint;
    entrySocialLossIndex: bigint; // social loss per contract borne by taken but unfilled order
    entryFundingIndex: bigint; // funding income per contract owned by taken but unfilled order
    blockInfo?: BlockInfo;
}

export interface RawPosition {
    // basic fields
    balance: bigint;
    size: bigint;
    entryNotional: bigint;
    entrySocialLossIndex: bigint;
    entryFundingIndex: bigint;
}

export interface Position extends RawPosition {
    // redundant fields
    instrumentAddr: string;
    expiry: number;
    traderAddr: string;

    // additional fields
    side: Side;
    entryPrice: bigint;

    isInverse?: boolean;

    blockInfo?: BlockInfo;
}

export interface Quotation {
    benchmark: bigint;
    sqrtFairPX96: bigint;
    tick: number;
    mark: bigint;
    entryNotional: bigint;
    fee: bigint;
    minAmount: bigint;
    sqrtPostFairPX96: bigint;
    postTick: number;
}

export interface RawRange {
    // basic fields
    liquidity: bigint;
    balance: bigint;
    sqrtEntryPX96: bigint;
    entryFeeIndex: bigint;
    tickLower: number;
    tickUpper: number;
}

export interface Range extends RawRange {
    // redundant fields
    instrumentAddr: string;
    expiry: number;
    traderAddr: string;

    // additional fields
    rid: number;
    lowerPrice: bigint;
    upperPrice: bigint;
    entryPrice: bigint;

    isInverse?: boolean;

    blockInfo?: BlockInfo;
}

export interface MinimalPearl {
    liquidityNet: bigint;
    left: bigint;
}

export interface LiquidityDetails {
    amm: {
        sqrtPX96: bigint;
        tick: number;
        liquidity: bigint;
    };
    tids: number[];
    pearls: MinimalPearl[];
    tick2Pearl: Map<number, MinimalPearl>;

    blockInfo: BlockInfo;
}

export interface TokenInfo {
    name?: string;
    symbol: string;
    address: string;
    decimals: number;
    isStableCoin?: boolean;
}

export interface BaseInfo {
    name?: string;
    symbol: string;
    address: string; // for chainlink base is ZERO address
    decimals: number; // for chainlink base is 0
}

export interface GasOptions {
    gasLimitMultiple?: number;
    gasPriceMultiple?: number;
    enableGasPrice?: boolean;
    disableGasLimit?: boolean;
}

export interface TxOptions extends CallOverrides, GasOptions {
    signer?: Signer;
}

export type TxOptionsWithSigner = Omit<TxOptions, 'signer'> & {
    signer: Signer;
};

export interface MarketAddress {
    beacon: string;
    market: string;
    // only apply for chainlink
    feeders?: { [key in string]?: string };
}

export interface FeederFactoryAddress {
    beacon: string;
    factory: string;
}

export interface ContractAddress {
    gate: string;
    observer: string;
    config: string;
    guardian?: string;
    market: { [key in MarketType]?: MarketAddress };
    feederFactory: { [key in MarketType]?: FeederFactoryAddress };
}

export interface SynFuturesConfig {
    marketConfig: { [key in MarketType]?: MarketConfig | PythMarketConfig };
    quotesParam: { [key in string]?: QuoteParam };
    contractAddress: ContractAddress;
    instrumentProxyByteCode: string;
    tokenInfo?: TokenInfo[];
    inversePairs?: InversePairsInfo;
}

export type InversePairsInfo = string[];

export interface QuoteParamJson {
    tradingFeeRatio: number;
    stabilityFeeRatioParam: string;
    protocolFeeRatio: number;
    qtype: number;
    minMarginAmount: string; // numeric string
    tip: string; // numeric string
}

export interface SynfConfigJson {
    subgraph: string;
    // aws proxy for frontend use
    subgraphProxy: string;
    marketConfig: { [key in MarketType]?: MarketConfig };
    quotesParam: { [key in string]?: QuoteParamJson };
    contractAddress: ContractAddress;
    instrumentProxyByteCode: string;
}

export interface SynFuturesV3Contracts {
    // Use 'any' type to support both legacy and current contract versions
    // The actual type safety is maintained by the TypeChain factories
    // Both versions implement the same core functionality with slight differences
    config: LegacyConfig | CurrentConfig; // Config contract (may have different methods between versions)
    gate: LegacyGate | CurrentGate; // Gate contract
    observer: LegacyObserver | CurrentObserver; // Observer contract (QuoteParam structure differs between versions)
    guardian?: Guardian; // Guardian is unchanged between versions
    marketContracts: { [key in MarketType]?: MarketContracts };
    feederFactoryContracts: { [key in MarketType]?: FeederFactoryContracts };
}

export interface MarketContracts {
    market: CexMarket | DexV2Market;
    beacon: Beacon;
}

export interface FeederFactoryContracts {
    factory: EmergingFeederFactory | PythFeederFactory;
    beacon: Beacon;
}
