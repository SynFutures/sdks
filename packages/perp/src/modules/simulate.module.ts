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

export class SimulateModule implements SimulateInterface {
    context: Context;

    constructor(context: Context) {
        this.context = context;
    }

    private get observer() {
        return this.context.perp._observer;
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

    private getPriceInfo(priceInfo: BigNumber | number) {
        let targetTick: number;
        let targetPrice: BigNumber;

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
        markPrice: BigNumber,
        overrides?: CallOverrides,
    ): Promise<{ baseSize: BigNumber; quoteSize: BigNumber; quotation: Quotation | null }>;
    private inquireByBaseOrQuote(
        params: { tradeInfo: TradeInfo; size: ByBase | ByQuote; side: Side },
        markPrice: BigNumber,
        overrides: CallOverrides,
        expectQuotation: true,
    ): Promise<{ baseSize: BigNumber; quoteSize: BigNumber; quotation: Quotation }>;
    private async inquireByBaseOrQuote(
        params: { tradeInfo: TradeInfo; size: ByBase | ByQuote; side: Side },
        markPrice: BigNumber,
        overrides?: CallOverrides,
        expectQuotation = false,
    ): Promise<{ baseSize: BigNumber; quoteSize: BigNumber; quotation: Quotation | null }> {
        let baseSize: BigNumber;
        let quoteSize: BigNumber;
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

        const { baseSize, quoteSize } = await this.inquireByBaseOrQuote(params, amm.markPrice, overrides ?? {});

        const sign = signOfSide(params.side);
        const long = sign > 0;
        const { targetTick, targetPrice } = this.getPriceInfo(params.priceInfo);

        const currentTick = amm.tick;
        if ((long && targetTick <= currentTick) || (!long && targetTick >= currentTick)) {
            throw new SimulationError('Please place normal order');
        }

        let swapToTick = long ? targetTick + 1 : targetTick - 1;
        let { size: swapSize, quotation } = await this.context.perp.contracts.observer.inquireByTick(
            instrument.instrumentAddr,
            amm.expiry,
            swapToTick,
            overrides ?? {},
        );

        if ((long && quotation.postTick <= targetTick) || (!long && quotation.postTick >= targetTick)) {
            swapToTick = long ? swapToTick + 1 : swapToTick - 1;
            const retry = await this.context.perp.contracts.observer.inquireByTick(
                instrument.instrumentAddr,
                amm.expiry,
                swapToTick,
                overrides ?? {},
            );
            swapSize = retry.size;
            quotation = retry.quotation;
        }

        if ((long && swapSize.lt(0)) || (!long && swapSize.gt(0))) {
            throw new SimulationError('Wrong Side');
        }

        const tradeSimulation = await this._simulateMarketOrderByLeverage(
            {
                tradeInfo: params.tradeInfo,
                side: params.side,
                size: { base: swapSize.abs() },
                slippage: params.slippage,
                strictMode: params.strictMode,
                instrument: instrument,
                leverage: params.leverage,
            },
            overrides ?? {},
        );

        const position = await this.getPosition(params.tradeInfo, overrides ?? {});
        if (position.size.isZero() && quotation.entryNotional.lt(instrument.minTradeValue)) {
            throw new SimulationError('Size to tick is trivial');
        }

        const orderBaseSize = baseSize.sub(swapSize.abs());
        const orderQuoteSize = quoteSize.sub(tradeSimulation.size.quote);

        const orderSimulation = {
            ...this._simulateOrder(instrument, amm, targetPrice, orderBaseSize, params.leverage),
            tick: targetTick,
            size: { base: orderBaseSize, quote: orderQuoteSize },
        };

        const minOrderValue = instrument.minOrderValue;
        const targetTickPrice = TickMath.getWadAtTick(targetTick);
        const minOrderSize = wdivUp(minOrderValue, targetTickPrice);

        if (swapSize.abs().add(minOrderSize).gt(baseSize)) {
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
        if (params.leverage.gt(ethers.utils.parseEther(maxLeverage + ''))) {
            throw new SimulationError('Insufficient margin to open position');
        }

        if (!withinOrderLimit(targetPrice, amm.markPrice, instrument.setting.initialMarginRatio)) {
            throw new SimulationError('Limit order price is too far away from mark price');
        }

        if (!withinDeviationLimit(amm.fairPrice, amm.markPrice, instrument.setting.initialMarginRatio)) {
            throw new SimulationError('Fair price is too far away from mark price');
        }

        let baseSize: BigNumber;
        let quoteSize: BigNumber;

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
                const baseSize = wmul(params.baseSize, r2w(params.ratios[index]));

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

        let baseSize: BigNumber;
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
                if (baseSize.mul(ratios[i]).div(RATIO_BASE).lt(minSizes[i])) {
                    needNewRatios = true;
                    break;
                }
            }
            // only adjust sizes if possible
            if (needNewRatios && minSizes.reduce((acc, minSize) => acc.add(minSize), ZERO).lt(baseSize)) {
                ratios = getBatchOrderRatios(BatchOrderSizeDistribution.FLAT, params.priceInfo.length);
            }
        }

        // calculate totalMinSize
        const sizes = ratios.map((ratio) => baseSize.mul(ratio).div(RATIO_BASE));

        // pick the max minSize/size ratio
        const minSizeToSizeRatio = minSizes
            .map((minSize, i) => bnMax(wdivUp(minSize, sizes[i]), ZERO))
            .reduce((acc, ratio) => bnMax(acc, ratio), ZERO);
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
                quote: res.reduce((acc, res) => acc.add(res?.size.quote ?? ZERO), ZERO),
            },
        };
    }

    private _simulateOrder(
        instrument: Instrument,
        amm: Amm,
        targetPrice: BigNumber,
        baseSize: BigNumber,
        leverage: BigNumber,
    ): Omit<SimulateLimitOrderResult, 'tick' | 'size' | 'quotation'> {
        const markPrice = amm.markPrice;

        const tradeValue = wmulUp(targetPrice, baseSize);

        const bnMax = (a: BigNumber, b: BigNumber): BigNumber => (a.gt(b) ? a : b);
        let margin = wdivUp(wmulUp(bnMax(targetPrice, markPrice), baseSize), leverage);
        const minMargin = getMinOrderMargin(targetPrice, markPrice, baseSize, instrument.setting.initialMarginRatio);
        if (margin.lt(minMargin)) {
            margin = minMargin;
        }

        return {
            limitPrice: targetPrice,
            tradeValue,
            margin,
            leverage,
            minFeeRebate: wmul(wmul(targetPrice, baseSize), r2w(instrument.setting.quoteParam.tradingFeeRatio)),
        };
    }

    private async simulateTrade<T extends SimulateTradeParamsBase>(
        params: T,
        simulate: (
            markPrice: BigNumber,
            baseSize: BigNumber,
            sign: number,
            prePosition: Position,
            preEquity: BigNumber,
            tradeLoss: BigNumber,
            quotation: Quotation,
        ) => { margin: BigNumber; leverage: BigNumber },
        overrides?: CallOverrides,
    ): Promise<SimulateTradeResult> {
        // eslint-disable-next-line prefer-const
        let { instrument, amm } = await this.mustGetInstrumentAndAmm(
            params.tradeInfo,
            params.instrument,
            overrides ?? {},
        );
        const prePosition = await this.getPosition(params.tradeInfo, overrides ?? {});

        const { baseSize, quoteSize, quotation } = await this.inquireByBaseOrQuote(
            params,
            amm.markPrice,
            overrides ?? {},
            true,
        );

        if (baseSize.lte(0)) {
            // TODO: @samlior
            throw new SimulationError('Invalid trade size');
        }

        const sign = signOfSide(params.side);
        const tradePrice = wdiv(quotation.entryNotional, baseSize.abs());
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
            sign > 0 ? worstNotional.sub(wmul(markPrice, baseSize)) : wmul(markPrice, baseSize).sub(worstNotional);

        const preEquity = positionEquity(prePosition, amm);
        const rawSize = baseSize.mul(sign);

        // call different callback functions
        // to achieve different simulations
        let { margin, leverage } = simulate(markPrice, baseSize, sign, prePosition, preEquity, tradeLoss, quotation);

        // combine a newly opened position with an existing position
        // to get the post position
        const { position: rawPosition, realized: realized } = combine(amm, prePosition, {
            balance: margin.lt(0) ? quotation.fee.mul(-1) : margin.sub(quotation.fee),
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
        if (!postPosition.size.eq(ZERO) && margin.lt(ZERO)) {
            const maxWithdrawableMargin = positionMaxWithdrawableMargin(
                postPosition,
                amm,
                instrument.setting.initialMarginRatio,
            );

            if (margin.abs().gt(maxWithdrawableMargin)) {
                if (params.strictMode) {
                    // TODO: @samlior
                    throw new SimulationError('Exceed max leverage');
                }

                margin = maxWithdrawableMargin.mul(-1);
                exceedMaxLeverage = true;
            }

            postPosition.balance = postPosition.balance.add(margin);
        }

        // as for creating new position or increasing a position: if leverage < 0 or leverage > 10, the position is not IMR safe
        // as for closing or decreasing a position: if leverage < 0 or leverage > 20, the position is not MMR safe
        if (
            // user closes position
            postPosition.size.eq(ZERO) ||
            // user changes the side of the position
            (prePosition.size.mul(sign).lt(ZERO) && baseSize.abs().lt(prePosition.size.abs()))
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
                postPosition.balance = postPosition.balance.add(additionalMargin);
                margin = margin.add(additionalMargin);
                leverage = positionLeverage(postPosition, amm);
                exceedMaxLeverage = true;
            }
        }

        // price impact = (postFair - preFair) / preFair
        const priceImpact = wdiv(
            sqrtX96ToWad(quotation.sqrtPostFairPX96).sub(sqrtX96ToWad(quotation.sqrtFairPX96)),
            sqrtX96ToWad(quotation.sqrtFairPX96),
        );

        const stabilityFee = SqrtPriceMath.getStabilityFee(quotation, instrument.setting.quoteParam);

        return {
            tradePrice: tradePrice,
            tradeValue: quotation.entryNotional,
            tradingFee: quotation.fee.sub(stabilityFee),
            stabilityFee,
            margin,
            marginChanged:
                postPosition.size.eq(ZERO) && postPosition.balance.gt(ZERO) ? postPosition.balance.mul(-1) : margin,
            leverage: postPosition.size.eq(ZERO) ? ZERO : leverage,
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
                markPrice: BigNumber,
                baseSize: BigNumber,
                sign: number,
                prePosition: Position,
                preEquity: BigNumber,
                tradeLoss: BigNumber,
                quotation: Quotation,
            ) => {
                const postEquity = preEquity.add(params.margin).sub(tradeLoss).sub(quotation.fee);
                const leverage = wdiv(wmul(markPrice, baseSize.mul(sign).add(prePosition.size)).abs(), postEquity);
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
                markPrice: BigNumber,
                baseSize: BigNumber,
                sign: number,
                prePosition: Position,
                preEquity: BigNumber,
                tradeLoss: BigNumber,
                quotation: Quotation,
            ) => {
                // calc margin required by fixed leverage
                // postEquity = preEquity + margin - tradeLoss - fee
                // margin = postEquity - preEquity + tradeLoss + fee
                const postEquity = wdiv(
                    wmul(markPrice, baseSize.mul(sign).add(prePosition.size)).abs(),
                    params.leverage,
                );
                const margin = postEquity.sub(preEquity).add(tradeLoss).add(quotation.fee);
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
                markPrice: BigNumber,
                baseSize: BigNumber,
                sign: number,
                prePosition: Position,
                preEquity: BigNumber,
                tradeLoss: BigNumber,
                quotation: Quotation,
            ) => {
                const margin = ZERO;
                const postEquity = preEquity.add(ZERO).sub(tradeLoss).sub(quotation.fee);
                const leverage = wdiv(wmul(markPrice, baseSize.mul(sign).add(prePosition.size)).abs(), postEquity);
                return { leverage, margin };
            },
            overrides ?? {},
        );
    }

    private async simulateAdjustMargin<T extends SimulateAdjustMarginParamsBase>(
        params: T,
        simulate: (position: Position, amm: Amm) => { margin: BigNumber; leverage: BigNumber },
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

        if (margin.lt(ZERO) && margin.abs().gt(maxWithdrawableMargin)) {
            throw new SimulationError('Invalid input');
        }

        // decrease balance
        postPosition = {
            ...postPosition,
            balance: postPosition.balance.add(margin),
        };

        return {
            postPosition,
            transferIn: margin.gt(0),
            margin: margin.abs(),
            leverage,
        };
    }

    async simulateAdjustMarginByMargin(
        params: SimulateAdjustMarginByMarginParams,
        overrides?: CallOverrides,
    ): Promise<SimulateAdjustMarginByMarginResult> {
        if (params.margin.lt(0)) {
            throw new SimulationError('Invalid margin');
        }

        const result = await this.simulateAdjustMargin(
            params,
            (position, amm) => {
                const margin = params.margin.mul(params.transferIn ? 1 : -1);
                const value = wmul(amm.markPrice, position.size.abs());
                const equity = positionEquity(position, amm).add(margin);
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
    ): Promise<BigNumber> {
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
        instrumentAmmSqrtPX96: BigNumber,
        instrumentMinRangeValue: BigNumber,
        px96?: BigNumber,
    ): BigNumber {
        const sqrtPX96 = px96 ? px96 : instrumentAmmSqrtPX96;
        return instrumentMinRangeValue.mul(Q96).div(sqrtPX96.mul(2));
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
                    quoteParam: { stabilityFeeRatioParam: ZERO, ...quoteParam },
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

        const minTradeValue = setting.quoteParam.minMarginAmount.mul(RATIO_BASE).div(setting.initialMarginRatio);

        const instrumentMinRangeValue = minTradeValue.mul(MIN_RANGE_MULTIPLIER);

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
        const sqrtStrikeLowerPX96 = basedPX96.sub(wmulDown(basedPX96, r2w(params.slippage)));
        const sqrtStrikeUpperPX96 = basedPX96.add(wmulDown(basedPX96, r2w(params.slippage)));

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
            lowerLeverage: rawLowerPosition.size.mul(lowerPrice).div(rawLowerPosition.balance).abs(),
            upperPosition: factory.createPosition({
                instrumentAddr: instrumentAddress,
                expiry: params.expiry,
                traderAddr: ADDRESS_ZERO,
                ...rawUpperPosition,
            }),
            upperLeverage: rawUpperPosition.size.mul(upperPrice).div(rawUpperPosition.balance).abs(),
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

        const sqrtStrikeLowerPX96 = amm.sqrtPX96.sub(wmulDown(amm.sqrtPX96, r2w(params.slippage)));
        const sqrtStrikeUpperPX96 = amm.sqrtPX96.add(wmulDown(amm.sqrtPX96, r2w(params.slippage)));

        return {
            removedPosition,
            postPosition,
            limitTicks: TickMath.encodeLimitTicks(sqrtStrikeLowerPX96, sqrtStrikeUpperPX96),
            removedPositionEntryPrice: sqrt(sqrtX96ToWad(amm.sqrtPX96).mul(sqrtX96ToWad(range.sqrtEntryPX96))),
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
                    quoteParam: { stabilityFeeRatioParam: ZERO, ...quoteParam },
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
            margin,
            setting.initialMarginRatio,
        );
        const { tickLower, tickUpper } = parseTicks(rangeKey(lowerTick, upperTick));
        const simulationRange: RawRange = {
            liquidity,
            balance: margin,
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
