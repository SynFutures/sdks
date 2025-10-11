import { BigNumber, CallOverrides, ethers } from 'ethers';
import {
    SimulateTradeParamsBase,
    SimulateMarketOrderByMarginParams,
    SimulateTradeResult,
    SimulateMarketOrderByLeverageParams,
    SimulateCloseParams,
    TradeInfo,
    Position,
    Amm,
    Quotation,
    SimulateRemoveLiquidityParams,
    SimulateRemoveLiquidityResult,
    InstrumentIdentifier,
    Instrument,
    Portfolio,
    SimulateAdjustMarginByMarginParams,
    SimulateAdjustMarginParamsBase,
    SimulateAdjustMarginByLeverageParams,
    SimulateAdjustMarginByMarginResult,
    SimulateAdjustMarginByLeverageResult,
    SimulateCrossMarketOrderParams,
    SimulateCrossMarketOrderResult,
    SimulateLimitOrderResult,
    SimulateLimitOrderParams,
    SimulateBatchPlaceResult,
    SimulateBatchPlaceParams,
    SimulateAddLiquidityWithAsymmetricRangeParams,
    SimulateAddLiquidityWithAsymmetricRangeResult,
    InstrumentSetting,
    TokenInfo,
    SimulateAddLiquidityParams,
    SimulateAddLiquidityResult,
    SimulateScaledLimitOrderParams,
    SimulateScaledLimitOrderResult,
    ByBase,
    ByQuote,
    RawRange,
    SimulateImpermenantLossParams,
    SimulateImpermenantLossResult,
} from '../types';
import {
    wdiv,
    wmul,
    TickMath,
    ZERO,
    sqrtX96ToWad,
    SqrtPriceMath,
    wmulDown,
    r2w,
    wadToSqrtX96,
    Q96,
    wdivUp,
    wmulUp,
    sqrt,
    getMaxLeverage,
    alignPriceToTick,
    calcBoost,
    ADDRESS_ZERO,
    calcAsymmetricBoost,
    getMinOrderMargin,
    wdivDown,
    bigIntAbs,
} from '../math';
import {
    signOfSide,
    isPosition,
    isByBase,
    isInstrument,
    positionEquity,
    factory,
    positionMaxWithdrawableMargin,
    isPositionMMSafe,
    isPositionIMSafe,
    positionAdditionMarginToIMRSafe,
    positionLeverage,
    rangeToPosition,
    isCexMarket,
    rangeKey,
    reverseSide,
    isPortfolio,
    getTokenInfo,
    alphaWadToTickDelta,
    parseTicks,
    rangeLowerPositionIfRemove,
    rangeUpperPositionIfRemove,
    tickDeltaToAlphaWad,
    inquireTransferAmountFromTargetLeverage,
    bnMax,
} from '../utils';
import {
    updateFundingIndex,
    combine,
    withinOrderLimit,
    withinDeviationLimit,
    alignRangeTick,
    entryDelta,
    getMarginFromLiquidity,
    getBatchOrderRatios,
} from '../utils/lowLevel';
import {
    INITIAL_MARGIN_RATIO,
    MAINTENANCE_MARGIN_RATIO,
    MAX_BATCH_ORDER_COUNT,
    MIN_BATCH_ORDER_COUNT,
    MIN_RANGE_MULTIPLIER,
    ORDER_SPACING,
    PEARL_SPACING,
    PERP_EXPIRY,
    RATIO_BASE,
} from '../constants';
import { BatchOrderSizeDistribution, Side, Status } from '../enum';
import { SimulateInterface } from './simulate.interface';
import { SynfError } from '../errors/synfError';
import { SimulationError } from '../errors/simulationError';
import { Context } from '@derivation-tech/context';
import { formatEther, parseEther } from 'ethers/lib/utils';
import { QuotationStructOutput } from 'src/typechain/Observer';
import { QuoteParamStructOutput } from 'src/typechain/current/Config';

export class SimulateModule implements SimulateInterface {
    context: Context;

    constructor(context: Context) {
        this.context = context;
    }

    private get observer() {
        return this.context.perp._observer;
    }

    private convertQuotationToBigInt(quotation: QuotationStructOutput): Quotation {
        return {
            benchmark: quotation.benchmark.toBigInt(),
            sqrtFairPX96: quotation.sqrtFairPX96.toBigInt(),
            tick: quotation.tick,
            mark: quotation.mark.toBigInt(),
            entryNotional: quotation.entryNotional.toBigInt(),
            fee: quotation.fee.toBigInt(),
            minAmount: quotation.minAmount.toBigInt(),
            sqrtPostFairPX96: quotation.sqrtPostFairPX96.toBigInt(),
            postTick: quotation.postTick,
        };
    }

    private convertQuoteParamToBigInt(quoteParam: {
        minMarginAmount: BigNumber;
        tradingFeeRatio: number;
        protocolFeeRatio: number;
        qtype: number;
        tip: BigNumber;
      }) {
        return {
            stabilityFeeRatioParam: ZERO,
            minMarginAmount: quoteParam.minMarginAmount.toBigInt(),
            tradingFeeRatio: quoteParam.tradingFeeRatio,
            protocolFeeRatio: quoteParam.protocolFeeRatio,
            tip: quoteParam.tip.toBigInt(),
            qtype: quoteParam.qtype,
        };
    }

    private async getPosition(tradeInfo: TradeInfo | Position, overrides?: CallOverrides) {
        if (isPosition(tradeInfo)) {
            return tradeInfo;
        }

        const portfolio = await this.observer.getPortfolio(tradeInfo, overrides ?? {});

        return portfolio.position;
    }

    private async getPortfolio(traderInfo: TradeInfo | Portfolio, overrides?: CallOverrides) {
        if (isPortfolio(traderInfo)) {
            return traderInfo;
        } else {
            return await this.observer.getPortfolio(traderInfo, overrides ?? {});
        }
    }

    private getPriceInfo(priceInfo: bigint | number) {
        let targetTick: number;
        let targetPrice: bigint;

        if (typeof priceInfo === 'number') {
            targetTick = priceInfo;
            targetPrice = TickMath.getWadAtTick(targetTick);
        } else {
            const result = alignPriceToTick(priceInfo);
            targetTick = result.tick;
            targetPrice = result.price;
        }

        return { targetTick, targetPrice };
    }

    private async mustGetInstrumentAndAmm(
        anyInfo: {
            instrumentAddr: string;
            expiry: number;
        },
        instrument?: Instrument,
        overrides?: CallOverrides,
    ): Promise<{ instrument: Instrument; amm: Amm }> {
        const result = await this.getInstrumentAndAmm(anyInfo, instrument, overrides ?? {});

        if (result === undefined || result.amm === undefined) {
            throw new SynfError(
                'Instrument or amm not found: ' + `instrument: ${anyInfo.instrumentAddr}, expiry: ${anyInfo.expiry}`,
            );
        }

        return result as { instrument: Instrument; amm: Amm };
    }

    private async getInstrumentAndAmm(
        anyInfo: {
            instrumentAddr: string;
            expiry: number;
        },
        instrument?: Instrument,
        overrides?: CallOverrides,
    ): Promise<{ instrument: Instrument; amm?: Amm } | undefined> {
        if (instrument) {
            return { instrument, amm: instrument.amms.get(anyInfo.expiry) };
        }
        instrument = await this.observer.getInstrument(
            {
                instrument: anyInfo.instrumentAddr,
                expiries: [anyInfo.expiry],
            },
            overrides ?? {},
        );
        if (instrument === undefined) {
            return undefined;
        }
        return { instrument, amm: instrument.amms.get(anyInfo.expiry) };
    }

    private inquireByBaseOrQuote(
        params: { tradeInfo: TradeInfo; size: ByBase | ByQuote; side: Side },
        markPrice: bigint,
        overrides?: CallOverrides,
    ): Promise<{ baseSize: bigint; quoteSize: bigint; quotation: Quotation | null }>;
    private inquireByBaseOrQuote(
        params: { tradeInfo: TradeInfo; size: ByBase | ByQuote; side: Side },
        markPrice: bigint,
        overrides: CallOverrides,
        expectQuotation: true,
    ): Promise<{ baseSize: bigint; quoteSize: bigint; quotation: Quotation }>;
    private async inquireByBaseOrQuote(
        params: { tradeInfo: TradeInfo; size: ByBase | ByQuote; side: Side },
        markPrice: bigint,
        overrides?: CallOverrides,
        expectQuotation = false,
    ): Promise<{ baseSize: bigint; quoteSize: bigint; quotation: Quotation | null }> {
        let baseSize: bigint;
        let quoteSize: bigint;
        let quotation: Quotation | null = null;

        if (isByBase(params.size)) {
            const { quoteAmount, quotation: _quotation } = await this.observer
                .inquireByBase(
                    params.tradeInfo.instrumentAddr,
                    params.tradeInfo.expiry,
                    params.side,
                    params.size.base,
                    overrides ?? {},
                )
                .catch((err) => {
                    if (expectQuotation) {
                        throw err;
                    }

                    return {
                        quoteAmount: wmul((params.size as ByBase).base, markPrice),
                        quotation: null,
                    };
                });

            baseSize = params.size.base;
            quoteSize = quoteAmount;
            quotation = _quotation;
        } else {
            const { baseAmount, quotation: _quotation } = await this.observer
                .inquireByQuote(
                    params.tradeInfo.instrumentAddr,
                    params.tradeInfo.expiry,
                    params.side,
                    params.size.quote,
                    overrides ?? {},
                )
                .catch((err) => {
                    if (expectQuotation) {
                        throw err;
                    }

                    return {
                        baseAmount: wdiv((params.size as ByQuote).quote, markPrice),
                        quotation: null,
                    };
                });

            baseSize = baseAmount;
            quoteSize = params.size.quote;
            quotation = _quotation;
        }

        return { baseSize, quoteSize, quotation };
    }

    async simulateCrossMarketOrder(
        params: SimulateCrossMarketOrderParams,
        overrides?: CallOverrides,
    ): Promise<SimulateCrossMarketOrderResult> {
        const { instrument, amm } = await this.mustGetInstrumentAndAmm(
            params.tradeInfo,
            params.instrument,
            overrides ?? {},
        );

        const sign = signOfSide(params.side);
        const long = sign > 0;
        const { targetTick, targetPrice } = this.getPriceInfo(params.priceInfo);

        const currentTick = amm.tick;
        if ((long && targetTick <= currentTick) || (!long && targetTick >= currentTick)) {
            throw new SimulationError('Please place normal order');
        }

        let swapToTick = long ? targetTick + 1 : targetTick - 1;
        let swapSize: bigint;
        let quotation: Quotation;
        if (params.inquireResult) {
            swapSize = params.inquireResult.firstQuote.size;
            quotation = params.inquireResult.firstQuote.quotation;
        } else {
            const res = await this.context.perp.contracts.observer.inquireByTick(
                instrument.instrumentAddr,
                amm.expiry,
                swapToTick,
                overrides ?? {},
            );
            swapSize = res.size.toBigInt();
            quotation = this.convertQuotationToBigInt(res.quotation);
        }

        if ((long && quotation.postTick <= targetTick) || (!long && quotation.postTick >= targetTick)) {
            swapToTick = long ? swapToTick + 1 : swapToTick - 1;
            if (params.inquireResult) {
                swapSize = params.inquireResult.secondQuote.size;
                quotation = params.inquireResult.secondQuote.quotation;
            } else {
                const retry = await this.context.perp.contracts.observer.inquireByTick(
                    instrument.instrumentAddr,
                    amm.expiry,
                    swapToTick,
                    overrides ?? {},
                );
                swapSize = retry.size.toBigInt();
                quotation = this.convertQuotationToBigInt(retry.quotation);
            }
        }

        if ((long && swapSize < 0n) || (!long && swapSize > 0n)) {
            throw new SimulationError('Wrong Side');
        }

        const tradeSimulation = await this._simulateMarketOrderByLeverage(
            {
                tradeInfo: params.tradeInfo,
                side: params.side,
                size: { base: swapSize < 0n ? -swapSize : swapSize },
                slippage: params.slippage,
                strictMode: params.strictMode,
                instrument: instrument,
                leverage: params.leverage,
                inquireResult: {
                    size: swapSize,
                    quotation,
                }
            },
            overrides ?? {},
        );

        const position = await this.getPosition(params.tradeInfo, overrides ?? {});
        if (position.size === 0n && quotation.entryNotional < instrument.minTradeValue) {
            throw new SimulationError('Size to tick is trivial');
        }

        // split user's intended size into:
        // - market leg: swapSize.abs() executed immediately to reach target tick
        // - limit leg: the remaining size to place at targetTick
        // For ByBase, base amount is the user's intent; quote is derived at worst-of(mark, target)
        // For ByQuote, quote amount is the user's intent; base is derived at worst-of(mark, target)
        const worstPrice = bnMax(amm.markPrice, targetPrice);

        let orderBaseSize: bigint;
        let orderQuoteSize: bigint;
        if (isByBase(params.size)) {
            const totalBase = params.size.base;
            const remainingBase = totalBase - (swapSize < 0n ? -swapSize : swapSize);
            orderBaseSize = remainingBase > 0n ? remainingBase : 0n;
            orderQuoteSize = wmulUp(orderBaseSize, worstPrice);
        } else {
            const totalQuote = params.size.quote;
            const spentQuote = tradeSimulation.size.quote;
            const remainingQuote = totalQuote - spentQuote;
            orderQuoteSize = remainingQuote > 0n ? remainingQuote : 0n;
            // derive base conservatively at worstPrice to keep size.quote and base consistent
            orderBaseSize = wdivDown(orderQuoteSize, worstPrice);
        }

        const orderSimulation = {
            ...this._simulateOrder(instrument, amm, targetPrice, orderBaseSize, params.leverage),
            tick: targetTick,
            size: { base: orderBaseSize, quote: orderQuoteSize },
        };

        const minOrderValue = instrument.minOrderValue;
        const targetTickPrice = TickMath.getWadAtTick(targetTick);
        const minOrderSize = wdivUp(minOrderValue, targetTickPrice);

        // placeable only if remaining base meets min base requirement at target
        if (orderBaseSize < minOrderSize) {
            // in this case we can't place order since size is too small
            return {
                canPlaceOrder: false,
                minOrderSize,
                tradeSimulation,
                orderSimulation,
            };
        } else {
            return {
                canPlaceOrder: true,
                minOrderSize,
                tradeSimulation,
                orderSimulation,
            };
        }
    }

    async simulateLimitOrder(
        params: SimulateLimitOrderParams,
        overrides?: CallOverrides,
    ): Promise<SimulateLimitOrderResult> {
        const { instrument, amm } = await this.mustGetInstrumentAndAmm(
            params.tradeInfo,
            params.instrument,
            overrides ?? {},
        );

        const { targetTick, targetPrice } = this.getPriceInfo(params.priceInfo);

        const currentTick = amm.tick;
        if (currentTick === targetTick) {
            throw new SimulationError('Invalid price');
        }

        const isLong = targetTick < currentTick;
        if ((params.side === Side.LONG && !isLong) || (params.side === Side.SHORT && isLong)) {
            throw new SimulationError('Invalid price');
        }

        const maxLeverage = getMaxLeverage(instrument.setting.initialMarginRatio);
        if (params.leverage > BigInt(ethers.utils.parseEther(maxLeverage + '').toString())) {
            throw new SimulationError('Insufficient margin to open position');
        }

        if (!withinOrderLimit(targetPrice, amm.markPrice, instrument.setting.initialMarginRatio)) {
            throw new SimulationError('Limit order price is too far away from mark price');
        }

        if (!withinDeviationLimit(amm.fairPrice, amm.markPrice, instrument.setting.initialMarginRatio)) {
            throw new SimulationError('Fair price is too far away from mark price');
        }

        let baseSize: bigint;
        let quoteSize: bigint;

        if (isByBase(params.size)) {
            baseSize = params.size.base;
            quoteSize = wmulUp(baseSize, bnMax(amm.markPrice, targetPrice));
        } else {
            quoteSize = params.size.quote;
            baseSize = wdivDown(quoteSize, bnMax(amm.markPrice, targetPrice));
        }

        const res = this._simulateOrder(instrument, amm, targetPrice, baseSize, params.leverage);

        return {
            ...res,
            tick: targetTick,
            size: {
                base: baseSize,
                quote: quoteSize,
            },
        };
    }

    protected async simulateBatchPlace(
        params: SimulateBatchPlaceParams,
        overrides?: CallOverrides,
    ): Promise<SimulateBatchPlaceResult> {
        const { instrument, amm } = await this.mustGetInstrumentAndAmm(
            params.tradeInfo,
            params.instrument,
            overrides ?? {},
        );

        if (params.targetTicks.length < MIN_BATCH_ORDER_COUNT || params.targetTicks.length > MAX_BATCH_ORDER_COUNT) {
            throw new SimulationError(
                `Order count should be between ${MIN_BATCH_ORDER_COUNT} and ${MAX_BATCH_ORDER_COUNT}`,
            );
        }

        if (params.targetTicks.length !== params.ratios.length) {
            throw new SimulationError('Ticks and ratios length not equal');
        }

        if (params.ratios.reduce((acc, ratio) => acc + ratio, 0) !== RATIO_BASE) {
            throw new SimulationError('Ratios sum not equal to RATIO_BASE: 10000');
        }

        // check for same tick and unaligned ticks
        if (new Set(params.targetTicks).size !== params.targetTicks.length) {
            throw new SimulationError('Duplicated ticks');
        }

        if (params.targetTicks.find((tick) => tick % PEARL_SPACING !== 0)) {
            throw new SimulationError('Unaligned ticks');
        }

        const orders: (SimulateLimitOrderResult | null)[] = [];
        for (let index = 0; index < params.targetTicks.length; index++) {
            const { targetTick, targetPrice } = this.getPriceInfo(params.targetTicks[index]);

            try {
                const baseSize = wmul(params.baseSize, r2w(BigInt(params.ratios[index])));

                const quoteSize = wmulUp(baseSize, bnMax(amm.markPrice, targetPrice));

                const res = this._simulateOrder(instrument, amm, targetPrice, baseSize, params.leverage);

                orders.push({
                    ...res,
                    tick: targetTick,
                    size: {
                        base: baseSize,
                        quote: quoteSize,
                    },
                });
            } catch {
                // ignore error and mark it as null
                orders.push(null);
            }
        }

        return orders;
    }

    async simulateScaledLimitOrder(
        params: SimulateScaledLimitOrderParams,
        overrides?: CallOverrides,
    ): Promise<SimulateScaledLimitOrderResult> {
        if (params.priceInfo.length < MIN_BATCH_ORDER_COUNT || params.priceInfo.length > MAX_BATCH_ORDER_COUNT) {
            throw new SimulationError(
                `Order count should be between ${MIN_BATCH_ORDER_COUNT} and ${MAX_BATCH_ORDER_COUNT}`,
            );
        }

        const { instrument } = await this.mustGetInstrumentAndAmm(params.tradeInfo, params.instrument, overrides ?? {});

        let baseSize: bigint;
        if (isByBase(params.size)) {
            baseSize = params.size.base;
        } else {
            throw new SimulationError('quote size is not supported');
        }

        const targetTicks = params.priceInfo.map((p) => (typeof p === 'number' ? p : TickMath.getTickAtPWad(p)));

        let ratios = getBatchOrderRatios(params.sizeDistribution, params.priceInfo.length);

        // if sizeDistribution is random, we need to adjust the ratios to make sure orderValue meet minOrderValue with best effort
        const minOrderValue = instrument.minOrderValue;
        const minSizes = targetTicks.map((tick) => wdivUp(minOrderValue, TickMath.getWadAtTick(tick)));
        if (params.sizeDistribution === BatchOrderSizeDistribution.RANDOM) {
        // check if any baseSize * ratio is less than minSize
        let needNewRatios = false;
        for (let i = 0; i < minSizes.length; i++) {
            if ((baseSize * BigInt(ratios[i])) / BigInt(RATIO_BASE) < minSizes[i]) {
                needNewRatios = true;
                break;
            }
        }
        // only adjust sizes if possible
        if (needNewRatios && minSizes.reduce((acc, minSize) => acc + minSize, 0n) < baseSize) {
            ratios = getBatchOrderRatios(BatchOrderSizeDistribution.FLAT, params.priceInfo.length);
        }
        }

        // calculate totalMinSize
        const sizes = ratios.map((ratio) => (baseSize * BigInt(ratio)) / BigInt(RATIO_BASE));

        // pick the max minSize/size ratio
        const minSizeToSizeRatio = minSizes
            .map((minSize, i) => bnMax(wdivUp(minSize, sizes[i]), 0n))
            .reduce((acc, ratio) => bnMax(acc, ratio), 0n);
        const totalMinSize = wmulUp(baseSize, minSizeToSizeRatio);

        const res = await this.simulateBatchPlace(
            {
                tradeInfo: params.tradeInfo,
                targetTicks,
                ratios,
                baseSize,
                side: params.side,
                leverage: params.leverage,
                instrument,
            },
            overrides ?? {},
        );

        return {
            orders: targetTicks.map((tick: number, index: number) => {
                return (
                    res[index] && {
                        ...res[index],
                        ratio: ratios[index],
                        minOrderSize: minSizes[index],
                    }
                );
            }),
            totalMinSize,
            size: {
                base: baseSize,
                quote: res.reduce((acc, res) => acc + (res?.size.quote ?? 0n), 0n),
            },
        };
    }

    private _simulateOrder(
        instrument: Instrument,
        amm: Amm,
        targetPrice: bigint,
        baseSize: bigint,
        leverage: bigint,
    ): Omit<SimulateLimitOrderResult, 'tick' | 'size' | 'quotation'> {
        const markPrice = amm.markPrice;

        const tradeValue = wmulUp(targetPrice, baseSize);

        const bnMax = (a: bigint, b: bigint): bigint => (a > b ? a : b);
        let margin = wdivUp(wmulUp(bnMax(targetPrice, markPrice), baseSize), leverage);
        const minMargin = getMinOrderMargin(targetPrice, markPrice, baseSize, instrument.setting.initialMarginRatio);
        if (margin < minMargin) {
            margin = minMargin;
        }

        return {
            limitPrice: targetPrice,
            tradeValue,
            margin,
            leverage,
            minFeeRebate: wmul(wmul(targetPrice, baseSize), r2w(BigInt(instrument.setting.quoteParam.tradingFeeRatio))),
        };
    }

    private async simulateTrade<T extends SimulateTradeParamsBase>(
        params: T,
        simulate: (
            markPrice: bigint,
            baseSize: bigint,
            sign: number,
            prePosition: Position,
            preEquity: bigint,
            tradeLoss: bigint,
            quotation: Quotation,
        ) => { margin: bigint; leverage: bigint },
        overrides?: CallOverrides,
    ): Promise<SimulateTradeResult> {
        // eslint-disable-next-line prefer-const
        let { instrument, amm } = await this.mustGetInstrumentAndAmm(
            params.tradeInfo,
            params.instrument,
            overrides ?? {},
        );
        const prePosition = await this.getPosition(params.tradeInfo, overrides ?? {});

        let baseSize: bigint;
        let quoteSize: bigint;
        let quotation: Quotation;
        // if inquireResult is provided, skip on-chain inquire or inquireByNotional rpc call
        if (params.inquireResult) {
            if (isByBase(params.size)) {
                baseSize = params.size.base;
                quoteSize = params.inquireResult.quotation.entryNotional;
                quotation = params.inquireResult.quotation;
            } else {
                baseSize = params.inquireResult.size;
                quoteSize = params.size.quote;
                quotation = params.inquireResult.quotation;
            }
        } else {
            const res = await this.inquireByBaseOrQuote(params, amm.markPrice, overrides ?? {}, true);
            baseSize = res.baseSize;
            quoteSize = res.quoteSize;
            quotation = res.quotation;
        }

        if (baseSize <= 0n) {
            // TODO: @samlior
            throw new SimulationError('Invalid trade size');
        }

        const sign = signOfSide(params.side);
        const tradePrice = wdiv(quotation.entryNotional, baseSize < 0n ? -baseSize : baseSize);
        const limitTick = TickMath.getLimitTick(tradePrice, params.slippage, params.side);
        const markPrice = amm.markPrice;

        // update funding index if expiry is perp
        if (amm.expiry === PERP_EXPIRY) {
            let timestamp: number;

            if (!overrides || !overrides.blockTag) {
                // update funding by the current time
                timestamp = Math.floor(Date.now() / 1000);
            } else {
                // update funding by the time specified by the user
                const block = await this.context.provider.getBlock(overrides.blockTag);
                timestamp = block.timestamp;
            }

            const { longFundingIndex, shortFundingIndex } = updateFundingIndex(amm, amm.markPrice, timestamp);

            // create a copy,
            // preventing modification of the original value
            amm = {
                ...amm,
                longFundingIndex,
                shortFundingIndex,
            };
        }

        // a flag used to determine whether the maximum leverage ratio has been reached
        let exceedMaxLeverage = false;

        // calculate tradeLoss by limit price
        // subsequent calculations will add tradeLoss to ensure that
        // the transaction can still succeed in the worst case scenario
        const limitPrice = TickMath.getWadAtTick(limitTick);
        const worstNotional = wmul(limitPrice, baseSize);
        const tradeLoss =
            sign > 0 ? worstNotional - wmul(markPrice, baseSize) : wmul(markPrice, baseSize) - worstNotional;

        const preEquity = positionEquity(prePosition, amm);
        const rawSize = baseSize * BigInt(sign);

        // call different callback functions
        // to achieve different simulations
        let { margin, leverage } = simulate(markPrice, baseSize, sign, prePosition, preEquity, tradeLoss, quotation);

        // combine a newly opened position with an existing position
        // to get the post position
        const { position: rawPosition, realized: realized } = combine(amm, prePosition, {
            balance: margin < 0n ? quotation.fee * BigInt(-1) : margin - quotation.fee,
            size: rawSize,
            entryNotional: quotation.entryNotional,
            entrySocialLossIndex: sign > 0 ? amm.longSocialLossIndex : amm.shortSocialLossIndex,
            entryFundingIndex: sign > 0 ? amm.longFundingIndex : amm.shortFundingIndex,
        });
        const postPosition = factory.createPosition({
            ...prePosition,
            ...rawPosition,
        });

        // if margin is less than 0, it means that the user can withdraw margin from the position.
        // in this case, it is necessary to check whether the amount of margin to be withdrawn is
        // greater than the maximum amount that can be withdrawn.
        if (postPosition.size !== 0n && margin < 0n) {
            const maxWithdrawableMargin = positionMaxWithdrawableMargin(
                postPosition,
                amm,
                instrument.setting.initialMarginRatio,
            );

            if ((margin < 0n ? -margin : margin) > maxWithdrawableMargin) {
                if (params.strictMode) {
                    // TODO: @samlior
                    throw new SimulationError('Exceed max leverage');
                }

                margin = maxWithdrawableMargin * BigInt(-1);
                exceedMaxLeverage = true;
            }

            postPosition.balance = postPosition.balance + margin;
        }

        // as for creating new position or increasing a position: if leverage < 0 or leverage > 10, the position is not IMR safe
        // as for closing or decreasing a position: if leverage < 0 or leverage > 20, the position is not MMR safe
        if (
            // user closes position
            postPosition.size === 0n ||
            // user changes the side of the position
            (prePosition.size * BigInt(sign) < 0n && (baseSize < 0n ? -baseSize : baseSize) < (prePosition.size < 0n ? -prePosition.size : prePosition.size))
        ) {
            if (!isPositionMMSafe(postPosition, amm, instrument.setting.maintenanceMarginRatio)) {
                // TODO: @samlior
                throw new SimulationError('Insufficient margin to open position');
            }
        } else {
            if (!isPositionIMSafe(postPosition, amm, instrument.setting.initialMarginRatio, true)) {
                if (params.strictMode) {
                    // TODO: @samlior
                    throw new SimulationError('Exceed max leverage');
                }

                const additionalMargin = positionAdditionMarginToIMRSafe(
                    postPosition,
                    amm,
                    instrument.setting.initialMarginRatio,
                    true,
                    params.slippage,
                );
                postPosition.balance = postPosition.balance + additionalMargin;
                margin = margin + additionalMargin;
                leverage = positionLeverage(postPosition, amm);
                exceedMaxLeverage = true;
            }
        }

        // price impact = (postFair - preFair) / preFair
        const priceImpact = wdiv(
            sqrtX96ToWad(quotation.sqrtPostFairPX96) - sqrtX96ToWad(quotation.sqrtFairPX96),
            sqrtX96ToWad(quotation.sqrtFairPX96),
        );

        const stabilityFee = SqrtPriceMath.getStabilityFee(quotation, instrument.setting.quoteParam);

        return {
            tradePrice: tradePrice,
            tradeValue: quotation.entryNotional,
            tradingFee: quotation.fee - stabilityFee,
            stabilityFee,
            margin,
            marginChanged:
                postPosition.size === 0n && postPosition.balance > 0n ? postPosition.balance * BigInt(-1) : margin,
            leverage: postPosition.size === 0n ? 0n : leverage,
            priceImpact,
            postPosition,
            realized,
            limitTick,
            exceedMaxLeverage,
            size: {
                base: baseSize,
                quote: quoteSize,
            },
        };
    }

    simulateMarketOrderByMargin(
        params: SimulateMarketOrderByMarginParams,
        overrides?: CallOverrides,
    ): Promise<SimulateTradeResult> {
        return this.simulateTrade(
            params,
            (
                markPrice: bigint,
                baseSize: bigint,
                sign: number,
                prePosition: Position,
                preEquity: bigint,
                tradeLoss: bigint,
                quotation: Quotation,
            ) => {
                const postEquity = preEquity + params.margin - tradeLoss - quotation.fee;
                const leverage = wdiv((wmul(markPrice, baseSize * BigInt(sign) + prePosition.size) < 0n ? -wmul(markPrice, baseSize * BigInt(sign) + prePosition.size) : wmul(markPrice, baseSize * BigInt(sign) + prePosition.size)), postEquity);
                return { leverage, margin: params.margin };
            },
            overrides ?? {},
        );
    }

    protected _simulateMarketOrderByLeverage(
        params: SimulateMarketOrderByLeverageParams,
        overrides?: CallOverrides,
    ): Promise<SimulateTradeResult> {
        return this.simulateTrade(
            params,
            (
                markPrice: bigint,
                baseSize: bigint,
                sign: number,
                prePosition: Position,
                preEquity: bigint,
                tradeLoss: bigint,
                quotation: Quotation,
            ) => {
                // calc margin required by fixed leverage
                // postEquity = preEquity + margin - tradeLoss - fee
                // margin = postEquity - preEquity + tradeLoss + fee
                const postEquity = wdiv(
                    (wmul(markPrice, baseSize * BigInt(sign) + prePosition.size) < 0n ? -wmul(markPrice, baseSize * BigInt(sign) + prePosition.size) : wmul(markPrice, baseSize * BigInt(sign) + prePosition.size)),
                    params.leverage,
                );
                const margin = postEquity - preEquity + tradeLoss + quotation.fee;
                return { leverage: params.leverage, margin };
            },
            overrides ?? {},
        );
    }

    simulateMarketOrderByLeverage(
        params: SimulateMarketOrderByLeverageParams,
        overrides?: CallOverrides,
    ): Promise<SimulateTradeResult> {
        return this._simulateMarketOrderByLeverage(params, overrides);
    }

    async simulateClose(params: SimulateCloseParams, overrides?: CallOverrides): Promise<SimulateTradeResult> {
        const prePosition = await this.getPosition(params.tradeInfo, overrides ?? {});

        return await this.simulateTrade(
            {
                ...params,
                tradeInfo: prePosition,
                side: reverseSide(prePosition.side),
            },
            (
                markPrice: bigint,
                baseSize: bigint,
                sign: number,
                prePosition: Position,
                preEquity: bigint,
                tradeLoss: bigint,
                quotation: Quotation,
            ) => {
                const margin = 0n;
                const postEquity = preEquity + 0n - tradeLoss - quotation.fee;
                const leverage = wdiv((wmul(markPrice, baseSize * BigInt(sign) + prePosition.size) < 0n ? -wmul(markPrice, baseSize * BigInt(sign) + prePosition.size) : wmul(markPrice, baseSize * BigInt(sign) + prePosition.size)), postEquity);
                return { leverage, margin };
            },
            overrides ?? {},
        );
    }

    private async simulateAdjustMargin<T extends SimulateAdjustMarginParamsBase>(
        params: T,
        simulate: (position: Position, amm: Amm) => { margin: bigint; leverage: bigint },
        overrides?: CallOverrides,
    ) {
        const { instrument, amm } = await this.mustGetInstrumentAndAmm(
            params.tradeInfo,
            params.instrument,
            overrides ?? {},
        );
        let postPosition = await this.getPosition(params.tradeInfo, overrides ?? {});

        const maxWithdrawableMargin = positionMaxWithdrawableMargin(
            postPosition,
            amm,
            instrument.setting.initialMarginRatio,
        );

        const { margin, leverage } = simulate(postPosition, amm);

        if (margin < 0n && (margin < 0n ? -margin : margin) > maxWithdrawableMargin) {
            throw new SimulationError('Invalid input');
        }

        // decrease balance
        postPosition = {
            ...postPosition,
            balance: postPosition.balance + margin,
        };

        return {
            postPosition,
            transferIn: margin > 0n,
            margin: bigIntAbs(margin),
            leverage,
        };
    }

    async simulateAdjustMarginByMargin(
        params: SimulateAdjustMarginByMarginParams,
        overrides?: CallOverrides,
    ): Promise<SimulateAdjustMarginByMarginResult> {
        if (params.margin < 0n) {
            throw new SimulationError('Invalid margin');
        }

        const result = await this.simulateAdjustMargin(
            params,
            (position, amm) => {
                const margin = params.margin * BigInt(params.transferIn ? 1 : -1);
                const value = wmul(amm.markPrice, (position.size < 0n ? -position.size : position.size));
                const equity = positionEquity(position, amm) + margin;
                const leverage = wdiv(value, equity);
                return { leverage, margin };
            },
            overrides ?? {},
        );

        return {
            leverage: result.leverage,
            postPosition: result.postPosition,
        };
    }

    async simulateAdjustMarginByLeverage(
        params: SimulateAdjustMarginByLeverageParams,
        overrides?: CallOverrides,
    ): Promise<SimulateAdjustMarginByLeverageResult> {
        const result = await this.simulateAdjustMargin(
            params,
            (position, amm) => {
                const margin = inquireTransferAmountFromTargetLeverage(position, amm, params.leverage);
                return { leverage: params.leverage, margin };
            },
            overrides ?? {},
        );

        return {
            transferIn: result.transferIn,
            margin: result.margin,
            postPosition: result.postPosition,
        };
    }

    async simulateBenchmarkPrice(
        instrumentIdentifier: InstrumentIdentifier,
        expiry: number,
        overrides?: CallOverrides,
    ): Promise<bigint> {
        let benchmarkPrice;
        if (isCexMarket(instrumentIdentifier.marketType)) {
            benchmarkPrice = await this.observer.inspectCexMarketBenchmarkPrice(
                instrumentIdentifier,
                expiry,
                overrides ?? {},
            );
        } else {
            benchmarkPrice = await this.observer.inspectDexV2MarketBenchmarkPrice(
                instrumentIdentifier,
                expiry,
                overrides ?? {},
            );
        }
        return benchmarkPrice;
    }

    async simulateAddLiquidity(
        params: SimulateAddLiquidityParams,
        overrides?: CallOverrides,
    ): Promise<SimulateAddLiquidityResult> {
        const res = await this._simulateAddLiquidityWithAsymmetricRange(
            {
                expiry: params.expiry,
                instrument: params.instrument,
                alphaWadLower: params.alphaWad,
                alphaWadUpper: params.alphaWad,
                margin: params.margin,
                slippage: params.slippage,
                currentSqrtPX96: params.currentSqrtPX96,
            },
            overrides ?? {},
        );

        return {
            ...res,
            tickDelta: res.tickDeltaUpper,
            equivalentAlpha: tickDeltaToAlphaWad(
                ~~((TickMath.getTickAtPWad(res.upperPrice) - TickMath.getTickAtPWad(res.lowerPrice)) / 2),
            ),
        };
    }

    private _getMinLiquidity(
        instrumentAmmSqrtPX96: bigint,
        instrumentMinRangeValue: bigint,
        px96?: bigint,
    ): bigint {
        const sqrtPX96 = px96 ? px96 : instrumentAmmSqrtPX96;
        return (instrumentMinRangeValue * Q96) / (sqrtPX96 * 2n);
    }

    protected async _simulateAddLiquidityWithAsymmetricRange(
        params: SimulateAddLiquidityWithAsymmetricRangeParams,
        overrides?: CallOverrides,
    ): Promise<SimulateAddLiquidityWithAsymmetricRangeResult> {
        const instrumentAddress = (
            isInstrument(params.instrument)
                ? params.instrument.instrumentAddr
                : await this.context.perp.instrument.computeInstrumentAddress(params.instrument)
        ).toLowerCase();
        const instrumentIdentifier = isInstrument(params.instrument)
            ? {
                  marketType: params.instrument.marketType,
                  baseSymbol: params.instrument.base,
                  quoteSymbol: params.instrument.quote,
              }
            : params.instrument;

        const info = isInstrument(params.instrument)
            ? {
                  instrument: params.instrument,
                  amm: params.instrument.amms.get(params.expiry),
              }
            : await this.getInstrumentAndAmm(
                  { expiry: params.expiry, instrumentAddr: instrumentAddress },
                  undefined,
                  overrides ?? {},
              );

        let quoteInfo: TokenInfo;
        let setting: InstrumentSetting;
        let amm: Amm;

        // see if this instrument is created
        const instrument = info?.instrument;
        if (!instrument || !info?.amm) {
            const benchmarkPrice = await this.simulateBenchmarkPrice(
                instrumentIdentifier,
                params.expiry,
                overrides ?? {},
            );
            const { quoteTokenInfo } = await getTokenInfo(instrumentIdentifier, this.context);
            quoteInfo = quoteTokenInfo;
            if (instrument) {
                setting = instrument.setting;
            } else {
                const quoteParam = await this.context.perp.contracts.config.getQuoteParam(
                    quoteInfo.address,
                    overrides ?? {},
                );
                setting = {
                    initialMarginRatio: INITIAL_MARGIN_RATIO,
                    maintenanceMarginRatio: MAINTENANCE_MARGIN_RATIO,
                    quoteParam: this.convertQuoteParamToBigInt(quoteParam),
                };
            }
            amm = factory.createAmm({
                instrumentAddr: instrumentAddress,
                expiry: 0,
                timestamp: 0,
                status: Status.TRADING,
                tick: TickMath.getTickAtPWad(benchmarkPrice),
                sqrtPX96: wadToSqrtX96(benchmarkPrice),
                liquidity: ZERO,
                totalLiquidity: ZERO,
                involvedFund: ZERO,
                openInterests: ZERO,
                feeIndex: ZERO,
                protocolFee: ZERO,
                totalLong: ZERO,
                totalShort: ZERO,
                longSocialLossIndex: ZERO,
                shortSocialLossIndex: ZERO,
                longFundingIndex: ZERO,
                shortFundingIndex: ZERO,
                insuranceFund: ZERO,
                settlementPrice: ZERO,
                markPrice: ZERO,
            });
        } else {
            amm = info.amm;
            quoteInfo = instrument.quote;
            setting = instrument.setting;
        }

        const minTradeValue = (setting.quoteParam.minMarginAmount * BigInt(RATIO_BASE)) / BigInt(setting.initialMarginRatio);

        const instrumentMinRangeValue = minTradeValue * BigInt(MIN_RANGE_MULTIPLIER);

        const tickDeltaLower = alphaWadToTickDelta(params.alphaWadLower);
        const tickDeltaUpper = alphaWadToTickDelta(params.alphaWadUpper);

        const upperTick = alignRangeTick(amm.tick + tickDeltaUpper, false);
        const lowerTick = alignRangeTick(amm.tick - tickDeltaLower, true);

        const upperPrice = TickMath.getWadAtTick(upperTick);
        const lowerPrice = TickMath.getWadAtTick(lowerTick);

        const { liquidity: liquidity } = entryDelta(
            amm.sqrtPX96,
            lowerTick,
            upperTick,
            params.margin,
            setting.initialMarginRatio,
        );
        const { tickLower, tickUpper } = parseTicks(rangeKey(lowerTick, upperTick));
        const simulationRange: RawRange = {
            liquidity,
            balance: params.margin,
            sqrtEntryPX96: amm.sqrtPX96,
            entryFeeIndex: amm.feeIndex,
            tickLower,
            tickUpper,
        };

        const rawLowerPosition = rangeLowerPositionIfRemove(simulationRange, amm);
        const rawUpperPosition = rangeUpperPositionIfRemove(simulationRange, amm);

        const minMargin = getMarginFromLiquidity(
            amm.sqrtPX96,
            upperTick,
            this._getMinLiquidity(amm.sqrtPX96, instrumentMinRangeValue, amm.sqrtPX96),
            setting.initialMarginRatio,
        );

        const basedPX96 = params.currentSqrtPX96 ? params.currentSqrtPX96 : amm.sqrtPX96;
        const sqrtStrikeLowerPX96 = basedPX96 - wmulDown(basedPX96, r2w(BigInt(params.slippage)));
        const sqrtStrikeUpperPX96 = basedPX96 + wmulDown(basedPX96, r2w(BigInt(params.slippage)));

        return {
            tickDeltaLower,
            tickDeltaUpper,
            liquidity,
            upperPrice: TickMath.getWadAtTick(simulationRange.tickUpper),
            lowerPrice: TickMath.getWadAtTick(simulationRange.tickLower),
            lowerPosition: factory.createPosition({
                instrumentAddr: instrumentAddress,
                expiry: params.expiry,
                traderAddr: ADDRESS_ZERO,
                ...rawLowerPosition,
            }),
            lowerLeverage: ((rawLowerPosition.size * lowerPrice) / rawLowerPosition.balance) < 0n ? -((rawLowerPosition.size * lowerPrice) / rawLowerPosition.balance) : ((rawLowerPosition.size * lowerPrice) / rawLowerPosition.balance),
            upperPosition: factory.createPosition({
                instrumentAddr: instrumentAddress,
                expiry: params.expiry,
                traderAddr: ADDRESS_ZERO,
                ...rawUpperPosition,
            }),
            upperLeverage: ((rawUpperPosition.size * upperPrice) / rawUpperPosition.balance) < 0n ? -((rawUpperPosition.size * upperPrice) / rawUpperPosition.balance) : ((rawUpperPosition.size * upperPrice) / rawUpperPosition.balance),
            limitTicks: TickMath.encodeLimitTicks(sqrtStrikeLowerPX96, sqrtStrikeUpperPX96),
            minMargin,
            minEffectiveQuoteAmount: instrumentMinRangeValue,
            equivalentAlphaLower: tickDeltaToAlphaWad(~~(upperTick - amm.tick)),
            equivalentAlphaUpper: tickDeltaToAlphaWad(~~(amm.tick - lowerTick)),
            capitalEfficiencyBoost:
                params.alphaWadLower === params.alphaWadUpper
                    ? calcBoost(
                          Number.parseFloat(ethers.utils.formatUnits(params.alphaWadLower)),
                          setting.initialMarginRatio,
                      )
                    : calcAsymmetricBoost(
                          Number.parseFloat(ethers.utils.formatUnits(params.alphaWadLower)),
                          Number.parseFloat(ethers.utils.formatUnits(params.alphaWadUpper)),
                          setting.initialMarginRatio,
                      ),
        };
    }

    async simulateAddLiquidityWithAsymmetricRange(
        params: SimulateAddLiquidityWithAsymmetricRangeParams,
        overrides?: CallOverrides,
    ): Promise<SimulateAddLiquidityWithAsymmetricRangeResult> {
        return await this._simulateAddLiquidityWithAsymmetricRange(params, overrides ?? {});
    }

    async simulateRemoveLiquidity(
        params: SimulateRemoveLiquidityParams,
        overrides?: CallOverrides,
    ): Promise<SimulateRemoveLiquidityResult> {
        const portfolio = await this.getPortfolio(params.tradeInfo, overrides ?? {});
        const position = portfolio.position;
        const range = portfolio.ranges.get(rangeKey(params.tickLower, params.tickUpper));
        if (!range) {
            throw new SimulationError('Missing range');
        }
        const { amm } = await this.mustGetInstrumentAndAmm(params.tradeInfo, params.instrument, overrides ?? {});

        const rawPositionRemoved = rangeToPosition(range, amm);
        const rawMainPosition = combine(amm, rawPositionRemoved, position).position;
        const postPosition = factory.createPosition({
            ...rawMainPosition,
            instrumentAddr: position.instrumentAddr,
            expiry: position.expiry,
            traderAddr: position.traderAddr,
        });

        const removedPosition = factory.createPosition({
            ...rawPositionRemoved,
            instrumentAddr: position.instrumentAddr,
            expiry: position.expiry,
            traderAddr: position.traderAddr,
        });

        const sqrtStrikeLowerPX96 = amm.sqrtPX96 - wmulDown(amm.sqrtPX96, r2w(BigInt(params.slippage)));
        const sqrtStrikeUpperPX96 = amm.sqrtPX96 + wmulDown(amm.sqrtPX96, r2w(BigInt(params.slippage)));

        return {
            removedPosition,
            postPosition,
            limitTicks: TickMath.encodeLimitTicks(sqrtStrikeLowerPX96, sqrtStrikeUpperPX96),
            removedPositionEntryPrice: sqrt(sqrtX96ToWad(amm.sqrtPX96) * sqrtX96ToWad(range.sqrtEntryPX96)),
        };
    }

    async simulateImpermanentLoss(
        params: SimulateImpermenantLossParams,
        overrides?: CallOverrides,
    ): Promise<SimulateImpermenantLossResult[]> {
        const instrumentAddress = (
            isInstrument(params.instrument)
                ? params.instrument.instrumentAddr
                : await this.context.perp.instrument.computeInstrumentAddress(params.instrument)
        ).toLowerCase();
        const instrumentIdentifier = isInstrument(params.instrument)
            ? {
                  marketType: params.instrument.marketType,
                  baseSymbol: params.instrument.base,
                  quoteSymbol: params.instrument.quote,
              }
            : params.instrument;

        const info = isInstrument(params.instrument)
            ? {
                  instrument: params.instrument,
                  amm: params.instrument.amms.get(params.expiry),
              }
            : await this.getInstrumentAndAmm(
                  { expiry: params.expiry, instrumentAddr: instrumentAddress },
                  undefined,
                  overrides ?? {},
              );

        let quoteInfo: TokenInfo;
        let setting: InstrumentSetting;
        let amm: Amm;

        // see if this instrument is created
        const instrument = info?.instrument;
        if (!instrument || !info?.amm) {
            const benchmarkPrice = await this.simulateBenchmarkPrice(
                instrumentIdentifier,
                params.expiry,
                overrides ?? {},
            );
            const { quoteTokenInfo } = await getTokenInfo(instrumentIdentifier, this.context);
            quoteInfo = quoteTokenInfo;
            if (instrument) {
                setting = instrument.setting;
            } else {
                const quoteParam = await this.context.perp.contracts.config.getQuoteParam(
                    quoteInfo.address,
                    overrides ?? {},
                );
                setting = {
                    initialMarginRatio: INITIAL_MARGIN_RATIO,
                    maintenanceMarginRatio: MAINTENANCE_MARGIN_RATIO,
                    quoteParam: this.convertQuoteParamToBigInt(quoteParam),
                };
            }
            amm = factory.createAmm({
                instrumentAddr: instrumentAddress,
                expiry: 0,
                timestamp: 0,
                status: Status.TRADING,
                tick: TickMath.getTickAtPWad(benchmarkPrice),
                sqrtPX96: wadToSqrtX96(benchmarkPrice),
                liquidity: ZERO,
                totalLiquidity: ZERO,
                involvedFund: ZERO,
                openInterests: ZERO,
                feeIndex: ZERO,
                protocolFee: ZERO,
                totalLong: ZERO,
                totalShort: ZERO,
                longSocialLossIndex: ZERO,
                shortSocialLossIndex: ZERO,
                longFundingIndex: ZERO,
                shortFundingIndex: ZERO,
                insuranceFund: ZERO,
                settlementPrice: ZERO,
                markPrice: ZERO,
            });
        } else {
            amm = info.amm;
            quoteInfo = instrument.quote;
            setting = instrument.setting;
        }

        const tickDeltaLower = alphaWadToTickDelta(params.alphaWadLower);
        const tickDeltaUpper = alphaWadToTickDelta(params.alphaWadUpper);

        const upperTick = alignRangeTick(amm.tick + tickDeltaUpper, false);
        const lowerTick = alignRangeTick(amm.tick - tickDeltaLower, true);

        const margin = parseEther('1');
        const { liquidity: liquidity } = entryDelta(
            amm.sqrtPX96,
            lowerTick,
            upperTick,
            margin.toBigInt(),
            setting.initialMarginRatio,
        );
        const { tickLower, tickUpper } = parseTicks(rangeKey(lowerTick, upperTick));
        const simulationRange: RawRange = {
            liquidity,
            balance: margin.toBigInt(),
            sqrtEntryPX96: amm.sqrtPX96,
            entryFeeIndex: amm.feeIndex,
            tickLower,
            tickUpper,
        };

        const result: SimulateImpermenantLossResult[] = [];
        for (let i = tickLower; i < tickUpper; i += ORDER_SPACING) {
            amm.tick = i;
            amm.sqrtPX96 = TickMath.getSqrtRatioAtTick(i);
            const removedBalance = rangeToPosition(simulationRange, amm).balance;
            result.push({
                tick: params.isInverse ? -i : i,
                impermanentLoss: Number(formatEther(removedBalance)) / Number(formatEther(margin)) - 1,
            });
        }

        return result;
    }
}
