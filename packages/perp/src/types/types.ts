import type { BlockInfo, CHAIN_ID } from '@derivation-tech/context';
import type { BigNumber, CallOverrides, Signer } from 'ethers';
import {
  CexMarket,
  Config,
  DexV2Market,
  Beacon,
  Gate,
  Observer,
  Guardian,
  EmergingFeederFactory,
  PythFeederFactory,
} from '../typechain';
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
  totalIn: BigNumber;
  totalOut: BigNumber;
}

export interface Pending {
  timestamp: number;
  native: boolean;
  amount: BigNumber;
  exemption: BigNumber;
}

export interface Instrument {
  // redundant fields
  instrumentAddr: string;

  // basic fields
  symbol: string;
  market: InstrumentMarket;
  condition: InstrumentCondition;
  setting: InstrumentSetting;
  spotPrice: BigNumber;
  // expiry => amm
  amms: Map<number, Amm>;
  base: BaseInfo;
  quote: TokenInfo;

  // additional fields
  instrumentType: FeederType;
  marketType: MarketType;
  minTradeValue: BigNumber;
  minOrderValue: BigNumber;
  minRangeValue: BigNumber;
  minTickDelta: number;

  displayBase: BaseInfo;
  displayQuote: TokenInfo;

  placePaused: boolean;
  fundingHour: number;
  isInverse?: boolean;

  blockInfo?: BlockInfo;
}

export interface InstrumentInfo {
  chainId: CHAIN_ID;
  addr: string;
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
  scaler0: BigNumber;
  aggregator0: string;
  heartBeat0: number;
  scaler1: BigNumber;
  aggregator1: string;
  heartBeat1: number;
}

export interface DexV2Feeder {
  ftype: FeederType;
  isToken0Quote: boolean;
  pair: string;
  scaler0: BigNumber;
  scaler1: BigNumber;
}

export interface RawOrder {
  // basic fields
  balance: BigNumber;
  size: BigNumber;
  taken: BigNumber;
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
  limitPrice: BigNumber;

  isInverse?: boolean;

  blockInfo?: BlockInfo;
}

// correspond Record in contract
// "Record" is a reserved keyword in TypeScript, so we can't use it as a type name.
export interface ContractRecord {
  taken: BigNumber;
  fee: BigNumber;
  entrySocialLossIndex: BigNumber;
  entryFundingIndex: BigNumber;
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
  sqrtPX96: BigNumber; // current price
  liquidity: BigNumber;
  totalLiquidity: BigNumber;
  involvedFund: BigNumber;
  openInterests: BigNumber;
  feeIndex: BigNumber;
  protocolFee: BigNumber;
  totalLong: BigNumber;
  totalShort: BigNumber;
  longSocialLossIndex: BigNumber;
  shortSocialLossIndex: BigNumber;
  longFundingIndex: BigNumber;
  shortFundingIndex: BigNumber;
  insuranceFund: BigNumber;
  settlementPrice: BigNumber;
  // the last updated block number of timestamp
  timestampUpdatedAt?: number;
  // mark price
  markPrice: BigNumber;
}

export interface Amm extends RawAmm {
  // redundant fields
  instrumentAddr: string;

  // additional fields
  fairPrice: BigNumber;

  isInverse?: boolean;

  blockInfo?: BlockInfo;
}

export interface Pearl {
  liquidityGross: BigNumber; // the total position liquidity that references this tick
  liquidityNet: BigNumber; // amount of net liquidity added (subtracted) when tick is crossed from left to right (right to left)
  nonce: number;
  fee: BigNumber;
  left: BigNumber;
  taken: BigNumber;
  entrySocialLossIndex: BigNumber; // social loss per contract borne by taken but unfilled order
  entryFundingIndex: BigNumber; // funding income per contract owned by taken but unfilled order
  blockInfo?: BlockInfo;
}

export interface RawPosition {
  // basic fields
  balance: BigNumber;
  size: BigNumber;
  entryNotional: BigNumber;
  entrySocialLossIndex: BigNumber;
  entryFundingIndex: BigNumber;
}

export interface Position extends RawPosition {
  // redundant fields
  instrumentAddr: string;
  expiry: number;
  traderAddr: string;

  // additional fields
  side: Side;
  entryPrice: BigNumber;

  isInverse?: boolean;

  blockInfo?: BlockInfo;
}

export interface Quotation {
  benchmark: BigNumber;
  sqrtFairPX96: BigNumber;
  tick: number;
  mark: BigNumber;
  entryNotional: BigNumber;
  fee: BigNumber;
  minAmount: BigNumber;
  sqrtPostFairPX96: BigNumber;
  postTick: number;
}

export interface RawRange {
  // basic fields
  liquidity: BigNumber;
  balance: BigNumber;
  sqrtEntryPX96: BigNumber;
  entryFeeIndex: BigNumber;
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
  lowerPrice: BigNumber;
  upperPrice: BigNumber;
  entryPrice: BigNumber;

  isInverse?: boolean;

  blockInfo?: BlockInfo;
}

export interface MinimalPearl {
  liquidityNet: BigNumber;
  left: BigNumber;
}

export interface LiquidityDetails {
  amm: {
    sqrtPX96: BigNumber;
    tick: number;
    liquidity: BigNumber;
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
  config: Config;
  gate: Gate;
  observer: Observer;
  guardian?: Guardian;
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
