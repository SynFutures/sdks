// BigNumber replaced with bigint
import type { TokenInfo } from '@derivation-tech/context';
import type { BatchOrderSizeDistribution, MarketType, QuoteType, Side } from '../enum';
import type { Portfolio, Instrument, Position, Quotation } from './types';

export interface InstrumentSetting {
    initialMarginRatio: number;
    maintenanceMarginRatio: number;
    quoteParam: QuoteParam;
}

export interface QuoteParam {
    minMarginAmount: bigint;

    tradingFeeRatio: number;
    protocolFeeRatio: number;
    stabilityFeeRatioParam: bigint;

    tip: bigint;
    qtype: QuoteType;
}

export interface InstrumentIdentifier {
    marketType: MarketType;
    baseSymbol: string | TokenInfo;
    quoteSymbol: string | TokenInfo;
}

export interface AdjustParam {
    expiry: number;
    net: bigint;
    deadline: number;
    referralCode?: string;
}

export interface AddParam {
    expiry: number;
    tickDeltaLower: number;
    tickDeltaUpper: number;
    amount: bigint;
    limitTicks: bigint;
    deadline: number;
    referralCode?: string;
}

export interface RemoveParam {
    expiry: number;
    traderAddr: string;
    tickLower: number;
    tickUpper: number;
    limitTicks: bigint;
    deadline: number;
}

export interface TradeParam {
    expiry: number;
    size: bigint;
    amount: bigint;
    limitTick: number;
    deadline: number;
    referralCode?: string;
}

export interface FillParam {
    expiry: number;
    tick: number;
    target: string;
    nonce: number;
}

export interface CancelParam {
    expiry: number;
    tick: number;
    deadline: number;
}

export interface BatchCancelParam {
    expiry: number;
    ticks: number[];
    deadline: number;
}

export interface LiquidateParam {
    expiry: number;
    target: string;
    size: bigint;
    amount: bigint;
}

export interface PlaceParam {
    expiry: number;
    tick: number;
    size: bigint;
    amount: bigint;
    deadline: number;
    referralCode?: string;
}

export interface BatchPlaceParam {
    expiry: number;
    ticks: number[];
    ratios: number[];
    size: bigint;
    leverage: bigint;
    deadline: number;
}

export interface FetchPortfolioParam {
    traderAddr: string;
    instrumentAddr: string;
    expiry: number;
    isInverse?: boolean;
}

export interface FetchInstrumentParam {
    instrument: string;
    expiries: number[];
    isInverse?: boolean;
}

export interface FillOrderParam extends FillParam {
    instrumentAddr: string;
}

export interface AdjustMarginParam {
    instrumentAddr: string;
    expiry: number;
    transferIn: boolean;
    margin: bigint;
    deadline: number;
    referralCode?: string;
}

export interface AddLiquidityParam {
    instrumentAddr: string | InstrumentIdentifier;
    expiry: number;
    tickDeltaLower: number;
    tickDeltaUpper: number;
    margin: bigint;
    limitTicks: bigint;
    deadline: number;
    referralCode?: string;
    isInverse?: boolean;
}

export interface RemoveLiquidityParam extends RemoveParam {
    instrumentAddr: string;
    isInverse?: boolean;
}

export interface PlaceLimitOrderParam {
    instrumentAddr: string;
    expiry: number;
    tick: number;
    baseSize: bigint;
    margin: bigint;
    side: Side;
    deadline: number;
    referralCode?: string;
    isInverse?: boolean;
}

export interface BatchPlaceLimitOrderParam {
    instrumentAddr: string;
    expiry: number;
    ticks: number[];
    ratios: number[];
    baseSize: bigint;
    side: Side;
    leverage: bigint;
    deadline: number;
    referralCode?: string;
    isInverse?: boolean;
}

export interface PlaceMarketOrderParam {
    instrumentAddr: string;
    expiry: number;
    side: Side;
    baseSize: bigint;
    margin: bigint;
    limitTick: number;
    deadline: number;
    referralCode?: string;
    isInverse?: boolean;
}

export interface CancelOrderParam extends CancelParam {
    instrumentAddr: string;
    isInverse?: boolean;
}

export interface BatchCancelOrderParam {
    instrumentAddr: string;
    expiry: number;
    orderTicks: number[];
    deadline: number;
    isInverse?: boolean;
}

export interface PlaceCrossMarketOrderParam {
    instrumentAddr: string;
    expiry: number;
    side: Side;
    tradeSize: bigint;
    tradeMargin: bigint;
    tradeLimitTick: number;
    orderTick: number;
    orderSize: bigint;
    orderMargin: bigint;
    deadline: number;
    referralCode?: string;
    isInverse?: boolean;
}

export interface SettleParam {
    instrumentAddr: string;
    expiry: number;
    target: string;
}

export type ByBase = { base: bigint };

export type ByQuote = { quote: bigint };

export type TradeInfo = {
    instrumentAddr: string;
    expiry: number;
    traderAddr: string;
};

export type TradeInfoWithOutInstrument = Omit<TradeInfo, 'instrumentAddr'>;

export interface SimulateTradeParamsBase {
    tradeInfo: TradeInfo | Position;
    side: Side;
    size: ByBase | ByQuote;
    slippage: number;
    strictMode?: boolean;
    instrument?: Instrument;
    isInverse?: boolean;
    inquireResult?: {
        size?: bigint;
        quotation: Quotation;
    };
}

export interface SimulateMarketOrderByMarginParams extends SimulateTradeParamsBase {
    margin: bigint;
}

export interface SimulateMarketOrderByLeverageParams extends SimulateTradeParamsBase {
    leverage: bigint;
}

export interface SimulateCloseParams {
    tradeInfo: TradeInfo | Position;
    size: ByBase | ByQuote;
    slippage: number;
    strictMode?: boolean;
    instrument?: Instrument;
    isInverse?: boolean;
    inquireResult?: {
        size?: bigint;
        quotation: Quotation;
    };
}

export interface SimulateTradeResult {
    tradePrice: bigint;
    tradeValue: bigint;
    tradingFee: bigint;
    stabilityFee: bigint;
    margin: bigint;
    marginChanged: bigint;
    leverage: bigint;
    priceImpact: bigint;
    realized: bigint;
    postPosition: Position;
    limitTick: number;
    exceedMaxLeverage: boolean;
    size: ByBase & ByQuote;
}

export interface SimulateAdjustMarginParamsBase {
    tradeInfo: TradeInfo | Position;
    slippage: number;
    instrument?: Instrument;
    isInverse?: boolean;
}

export interface SimulateAdjustMarginByMarginParams extends SimulateAdjustMarginParamsBase {
    transferIn: boolean;
    margin: bigint;
}

export interface SimulateAdjustMarginByLeverageParams extends SimulateAdjustMarginParamsBase {
    leverage: bigint;
}

export interface SimulateAdjustMarginByMarginResult {
    leverage: bigint;
    postPosition: Position;
}

export interface SimulateAdjustMarginByLeverageResult {
    transferIn: boolean;
    margin: bigint;
    postPosition: Position;
}

export interface SimulateAddLiquidityParams {
    expiry: number;
    instrument: Instrument | InstrumentIdentifier;
    alphaWad: bigint;
    margin: bigint;
    slippage: number;
    currentSqrtPX96?: bigint;
    isInverse?: boolean;
}

export interface SimulateAddLiquidityResult {
    tickDelta: number;
    liquidity: bigint;
    upperPrice: bigint;
    lowerPrice: bigint;
    lowerPosition: Position;
    lowerLeverage: bigint;
    upperPosition: Position;
    upperLeverage: bigint;
    limitTicks: bigint;
    minMargin: bigint;
    minEffectiveQuoteAmount: bigint;
    equivalentAlpha: bigint;
    capitalEfficiencyBoost: number;
}

export interface SimulateAddLiquidityWithAsymmetricRangeParams {
    expiry: number;
    instrument: Instrument | InstrumentIdentifier;
    alphaWadLower: bigint;
    alphaWadUpper: bigint;
    margin: bigint;
    slippage: number;
    currentSqrtPX96?: bigint;
    isInverse?: boolean;
}

export interface SimulateAddLiquidityWithAsymmetricRangeResult {
    tickDeltaLower: number;
    tickDeltaUpper: number;
    liquidity: bigint;
    upperPrice: bigint;
    lowerPrice: bigint;
    lowerPosition: Position;
    lowerLeverage: bigint;
    upperPosition: Position;
    upperLeverage: bigint;
    limitTicks: bigint;
    minMargin: bigint;
    minEffectiveQuoteAmount: bigint;
    equivalentAlphaLower: bigint;
    equivalentAlphaUpper: bigint;
    capitalEfficiencyBoost: number;
}

export interface SimulateRemoveLiquidityParams {
    tradeInfo: TradeInfo | Portfolio;
    tickUpper: number;
    tickLower: number;
    slippage: number;
    instrument?: Instrument;
    isInverse?: boolean;
}

export interface SimulateRemoveLiquidityResult {
    removedPosition: Position;
    postPosition: Position;
    limitTicks: bigint;
    removedPositionEntryPrice: bigint;
}

export interface SimulateCrossMarketOrderParams {
    tradeInfo: TradeInfo | Position;
    priceInfo: bigint | number;
    size: ByBase | ByQuote;
    side: Side;
    leverage: bigint;
    slippage: number;
    strictMode?: boolean;
    instrument?: Instrument;
    isInverse?: boolean;
    inquireResult?: {
        firstQuote: {
            size: bigint;
            quotation: Quotation;
        };
        secondQuote: {
            size: bigint;
            quotation: Quotation;
        };
    };
}

export interface SimulateCrossMarketOrderResult {
    canPlaceOrder: boolean;
    minOrderSize: bigint;
    tradeSimulation: SimulateTradeResult;
    orderSimulation: SimulateLimitOrderResult;
}

export interface SimulateLimitOrderParams {
    tradeInfo: TradeInfo;
    priceInfo: bigint | number;
    size: ByBase | ByQuote;
    side: Side;
    leverage: bigint;
    instrument?: Instrument;
    isInverse?: boolean;
}

export interface SimulateLimitOrderResult {
    tick: number;
    margin: bigint;
    leverage: bigint;
    size: ByBase & ByQuote;
    minFeeRebate: bigint;
    limitPrice: bigint;
    tradeValue: bigint;
}

export interface SimulateBatchPlaceParams {
    tradeInfo: TradeInfo;
    targetTicks: number[];
    ratios: number[];
    baseSize: bigint;
    side: Side;
    leverage: bigint;
    instrument?: Instrument;
}

export type SimulateBatchPlaceResult = (SimulateLimitOrderResult | null)[];

export interface SimulateScaledLimitOrderParams {
    tradeInfo: TradeInfo;
    priceInfo: (bigint | number)[];
    sizeDistribution: BatchOrderSizeDistribution;
    size: ByBase | ByQuote;
    side: Side;
    leverage: bigint;
    instrument?: Instrument;
    isInverse?: boolean;
}

export interface SimulateScaledLimitOrderResult {
    orders: (
        | (SimulateLimitOrderResult & {
              ratio: number;
              minOrderSize: bigint;
          })
        | null
    )[];
    totalMinSize: bigint;
    size: ByBase & ByQuote;
}

export interface SimulateImpermenantLossParams {
    expiry: number;
    instrument: Instrument | InstrumentIdentifier;
    isInverse: boolean;
    alphaWadLower: bigint;
    alphaWadUpper: bigint;
}

export interface SimulateImpermenantLossResult {
    tick: number;
    impermanentLoss: number;
}
