import { BigNumber, CallOverrides, ethers } from 'ethers';
import { BlockInfo, TokenInfo, ZERO_ADDRESS, CHAIN_ID, Context } from '@derivation-tech/context';
import { CexMarket, Instrument__factory } from '../typechain';
import { AssembledInstrumentDataStructOutput } from '../typechain/Observer';
import {
    Amm,
    Instrument,
    DexV2Feeder,
    FetchInstrumentParam,
    FundFlow,
    InstrumentIdentifier,
    InstrumentInfo,
    InstrumentMarket,
    MarketConfig,
    MarketInfo,
    Pending,
    Portfolio,
    Position,
    PriceFeeder,
    Quotation,
    QuoteParam,
    InstrumentSetting,
    RawPosition,
    RawAmm,
    LiquidityDetails,
    MinimalPearl,
    FetchPortfolioParam,
} from '../types';
import { Side, QuoteType, FeederType, MarketType, InstrumentCondition } from '../enum';
import { calcMaxWithdrawable, TickMath, wdiv, ZERO, SqrtPriceMath } from '../math';
import {
    quickRetry,
    getTokenInfo,
    getTokenSymbol,
    trimObj,
    isCexMarket,
    rangeToPosition,
    signOfSide,
    factory,
    toPortfolio,
} from '../utils';
import { calcBenchmarkPrice, cancelOrderToPosition, combine, fillOrderToPosition } from '../utils/lowLevel';
import { InstrumentParser } from '../parser';
import { SynfError } from '../errors';
import { ObserverInterface } from './observer.interface';

const batchSize = 10;

export class ObserverModule implements ObserverInterface {
    context: Context;

    //Symbol -> Instrument address
    cache: Map<string, string> = new Map<string, string>();

    constructor(context: Context) {
        this.context = context;
    }

    private async getMiscInfo(
        instrumentAddress: string[],
        overrides?: CallOverrides,
    ): Promise<{ placePaused: boolean; fundingHour: number }[]> {
        const instrumentInterface = Instrument__factory.createInterface();

        let needFundingHour = this.context.chainId !== CHAIN_ID.BLAST && this.context.chainId !== CHAIN_ID.LOCAL;
        if (overrides && overrides.blockTag) {
            const blockTag = await overrides.blockTag;
            if (typeof blockTag === 'number' || blockTag.startsWith('0x')) {
                const blockNumber = ethers.BigNumber.from(blockTag).toNumber();
                if (this.context.chainId === CHAIN_ID.BASE && blockNumber < 21216046) {
                    needFundingHour = false;
                }
            }
        }

        const calls = [];
        for (const instrumentAddr of instrumentAddress) {
            calls.push({
                target: instrumentAddr,
                callData: instrumentInterface.encodeFunctionData('placePaused'),
            });
            if (needFundingHour) {
                calls.push({
                    target: instrumentAddr,
                    callData: instrumentInterface.encodeFunctionData('fundingHour'),
                });
            }
        }

        const rawMiscInfo = await this.context.getMulticall3().callStatic.aggregate(calls, overrides ?? {});

        const miscList: { placePaused: boolean; fundingHour: number }[] = [];
        for (let j = 0; j < rawMiscInfo.returnData.length; j = needFundingHour ? j + 2 : j + 1) {
            const [placePaused] = instrumentInterface.decodeFunctionResult('placePaused', rawMiscInfo.returnData[j]);
            const [fundingHour] = needFundingHour
                ? instrumentInterface.decodeFunctionResult('fundingHour', rawMiscInfo.returnData[j + 1])
                : [24];
            miscList.push({
                placePaused: placePaused,
                fundingHour: fundingHour === 0 ? 24 : fundingHour,
            });
        }

        return miscList;
    }

    getPortfolio(params: FetchPortfolioParam, overrides?: CallOverrides): Promise<Portfolio>;
    getPortfolio(params: FetchPortfolioParam[], overrides?: CallOverrides): Promise<Portfolio[]>;
    async getPortfolio(
        params: FetchPortfolioParam | FetchPortfolioParam[],
        overrides?: CallOverrides,
    ): Promise<Portfolio | Portfolio[]> {
        params = Array.isArray(params) ? params : [params];

        const observerInterface = this.context.perp.contracts.observer.interface;

        let portfolios: Portfolio[] = [];
        for (let i = 0; i < params.length; i += batchSize) {
            const _params = params.slice(i, i + batchSize);

            const calls = _params.map((p) => {
                return {
                    target: this.context.perp.contracts.observer.address,
                    callData: observerInterface.encodeFunctionData('getAcc', [
                        p.instrumentAddr,
                        p.expiry,
                        p.traderAddr,
                    ]),
                };
            });

            portfolios = portfolios.concat(
                await quickRetry(() =>
                    this.context
                        .getMulticall3()
                        .callStatic.aggregate(calls, overrides ?? {})
                        .then(({ returnData }) =>
                            returnData.map((d, i) => {
                                const p = _params[i];

                                return toPortfolio(
                                    p.instrumentAddr,
                                    p.expiry,
                                    p.traderAddr,
                                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                                    observerInterface.decodeFunctionResult('getAcc', d) as any,
                                );
                            }),
                        ),
                ),
            );
        }

        return portfolios.length === 1 ? portfolios[0] : portfolios;
    }

    async getAllInstruments(overrides?: CallOverrides): Promise<Instrument[]> {
        const instrumentLists = await this.context.perp.contracts.gate.getAllInstruments(overrides ?? {});

        const totalPage = Math.ceil(instrumentLists.length / batchSize);
        const rawList = [];
        const miscInfoList = [];

        for (let i = 0; i < totalPage; i++) {
            const queryList = instrumentLists.slice(
                i * batchSize,
                (i + 1) * batchSize >= instrumentLists.length ? instrumentLists.length : (i + 1) * batchSize,
            );

            rawList.push(
                await quickRetry(() =>
                    this.context.perp.contracts.observer.getInstrumentByAddressList(queryList, overrides ?? {}),
                ),
            );

            miscInfoList.push(await quickRetry(async () => this.getMiscInfo(queryList, overrides ?? {})));
        }

        let assembledInstrumentDatas: Instrument[] = [];
        for (let i = 0; i < rawList.length; i++) {
            const miscInfo = miscInfoList[i];
            const [rawInstrument, rawBlockInfo] = trimObj(rawList[i]);
            assembledInstrumentDatas = assembledInstrumentDatas.concat(
                await this.parseInstrumentData(rawInstrument, miscInfo, rawBlockInfo, overrides ?? {}),
            );
        }

        return assembledInstrumentDatas;
    }

    getInstrument(params: FetchInstrumentParam | string, overrides?: CallOverrides): Promise<Instrument>;
    getInstrument(params: (FetchInstrumentParam | string)[], overrides?: CallOverrides): Promise<Instrument[]>;
    async getInstrument(
        params: FetchInstrumentParam | string | (FetchInstrumentParam | string)[],
        overrides?: CallOverrides,
    ): Promise<Instrument | Instrument[]> {
        const _params = Array.isArray(params) ? params : [params];

        const formattedParams: FetchInstrumentParam[] = [];

        for (let i = 0; i < _params.length; i++) {
            const p = _params[i];
            if (typeof p === 'string') {
                if (ethers.utils.isAddress(p)) {
                    formattedParams.push({
                        instrument: p,
                        expiries: [],
                    });
                } else {
                    formattedParams.push({
                        instrument: await this._getInstrumentBySymbol(p, overrides ?? {}),
                        expiries: [],
                    });
                }
            } else {
                if (ethers.utils.isAddress(p.instrument)) {
                    formattedParams.push(p);
                } else {
                    formattedParams.push({
                        instrument: await this._getInstrumentBySymbol(p.instrument, overrides ?? {}),
                        expiries: p.expiries,
                    });
                }
            }
        }

        const [rawList, rawBlockInfo] = trimObj(
            await this.context.perp.contracts.observer.getInstrumentBatch(formattedParams, overrides ?? {}),
        );

        const miscInfoList = await this.getMiscInfo(
            formattedParams.map((p) => p.instrument),
            overrides ?? {},
        );

        const instruments = await this.parseInstrumentData(rawList, miscInfoList, rawBlockInfo, overrides ?? {});

        return Array.isArray(params) ? instruments : instruments?.[0];
    }

    private async _getInstrumentBySymbol(symbol: string, overrides?: CallOverrides): Promise<string> {
        const cachedInstrumentAddress = this.cache.get(symbol);
        if (cachedInstrumentAddress) {
            return cachedInstrumentAddress;
        }

        await this.getAllInstruments(overrides ?? {});

        const updatedInstrumentAddress = this.cache.get(symbol);
        if (!updatedInstrumentAddress) {
            throw new SynfError('unknown symbol: ' + symbol);
        }
        return updatedInstrumentAddress;
    }

    async parseInstrumentData(
        rawList: AssembledInstrumentDataStructOutput[],
        miscInfoList: { placePaused: boolean; fundingHour: number }[],
        blockInfo: BlockInfo,
        overrides?: CallOverrides,
    ): Promise<Instrument[]> {
        const assembledInstrumentDatas: Instrument[] = [];
        for (let i = 0; i < rawList.length; i++) {
            const rawInstrument = rawList[i];
            const miscInfo = miscInfoList[i];
            const [baseSymbol, quoteSymbol, marketType] = rawInstrument.symbol.split('-');
            const quoteTokenInfo = await this.getQuoteTokenInfo(
                quoteSymbol,
                rawInstrument.instrumentAddr,
                overrides ?? {},
            );
            let baseInfo: TokenInfo = { symbol: baseSymbol, address: ethers.constants.AddressZero, decimals: 0 };
            if (!isCexMarket(marketType as MarketType)) {
                // fetch base token info from ctx
                const onCtxBaseInfo = await this.context.getTokenInfo(baseSymbol);
                if (onCtxBaseInfo) {
                    baseInfo = onCtxBaseInfo;
                }
            }

            const instrumentInfo: InstrumentInfo = {
                chainId: this.context.chainId,
                addr: rawInstrument.instrumentAddr,
                symbol: rawInstrument.symbol,
                base: baseInfo,
                quote: quoteTokenInfo,
            };

            const marketInfo: MarketInfo = {
                addr: rawInstrument.market,
                type: marketType,
                beacon: this.context.perp.configuration.config.contractAddress.market[marketType as MarketType]!.beacon,
            };
            const marketConfig: MarketConfig =
                this.context.perp.configuration.config.marketConfig[marketType as MarketType]!;
            const feeder = isCexMarket(marketType as MarketType)
                ? (rawInstrument.priceFeeder as PriceFeeder)
                : (rawInstrument.dexV2Feeder as DexV2Feeder);
            // we assume that marketConfig is not null
            const market: InstrumentMarket = { info: marketInfo, config: marketConfig, feeder: feeder };

            const instrumentSetting: InstrumentSetting = {
                initialMarginRatio: rawInstrument.initialMarginRatio,
                maintenanceMarginRatio: rawInstrument.maintenanceMarginRatio,
                quoteParam: rawInstrument.param as QuoteParam,
            };

            const amms: Map<number, Amm> = new Map<number, Amm>();

            for (let i = 0; i < rawInstrument.amms.length; i++) {
                const rawAmm = rawInstrument.amms[i];
                if (rawAmm.expiry === 0) {
                    continue;
                }
                const amm = factory.createAmm({
                    ...rawAmm,
                    instrumentAddr: rawInstrument.instrumentAddr,
                    markPrice: rawInstrument.markPrices[i],
                    blockInfo,
                });
                amms.set(rawAmm.expiry, amm);
            }

            const rawAssembledInstrumentData = {
                instrumentAddr: rawInstrument.instrumentAddr,
                symbol: rawInstrument.symbol,
                market,
                condition: rawInstrument.condition as InstrumentCondition,
                setting: instrumentSetting,
                spotPrice: rawInstrument.spotPrice,
                amms,
                base: baseInfo,
                quote: quoteTokenInfo,
                blockInfo,
                ...miscInfo,
            };

            const assembledInstrumentData = factory.createInstrument(rawAssembledInstrumentData);

            // Update cache
            this.cache.set(instrumentInfo.symbol, assembledInstrumentData.instrumentAddr);

            this.context.registerAddress(instrumentInfo.addr, instrumentInfo.symbol);
            this.context.registerContractParser(instrumentInfo.addr, new InstrumentParser());
            assembledInstrumentDatas.push(assembledInstrumentData);
        }
        return assembledInstrumentDatas;
    }

    async getQuoteTokenInfo(
        quoteSymbol: string,
        instrumentAddr: string,
        overrides?: CallOverrides,
    ): Promise<TokenInfo> {
        return (
            (await this.context.getTokenInfo(quoteSymbol)) ??
            (await this.context.getTokenInfo(
                (await this.context.perp.contracts.observer.getSetting(instrumentAddr, overrides ?? {})).quote,
            ))
        );
    }

    async inspectDexV2MarketBenchmarkPrice(
        instrumentIdentifier: InstrumentIdentifier,
        expiry: number,
        overrides?: CallOverrides,
    ): Promise<BigNumber> {
        const { baseSymbol, quoteSymbol } = getTokenSymbol(
            instrumentIdentifier.baseSymbol,
            instrumentIdentifier.quoteSymbol,
        );
        const baseParam = this.context.perp.configuration.config.quotesParam[baseSymbol];
        const quoteParam = this.context.perp.configuration.config.quotesParam[quoteSymbol];

        const baseStable = baseParam && baseParam.qtype === QuoteType.STABLE;
        const quoteStable = quoteParam && quoteParam.qtype === QuoteType.STABLE;

        const feederType: FeederType = ((baseStable ? 2 : 0) + (quoteStable ? 1 : 0)) as FeederType;

        const rawSpotPrice = await this.getDexV2RawSpotPrice(instrumentIdentifier, overrides ?? {});

        return calcBenchmarkPrice(
            expiry,
            rawSpotPrice,
            feederType,
            this.context.perp.configuration.config.marketConfig.DEXV2!.dailyInterestRate,
        );
    }

    async inspectCexMarketBenchmarkPrice(
        instrumentIdentifier: InstrumentIdentifier,
        expiry: number,
    ): Promise<BigNumber> {
        const instrumentAddress = await this.context.perp.instrument.computeInstrumentAddress(instrumentIdentifier);
        const market = this.context.perp.contracts.marketContracts[instrumentIdentifier.marketType]
            ?.market as CexMarket;
        let benchmarkPrice;
        try {
            benchmarkPrice = await market.getBenchmarkPrice(instrumentAddress, expiry);
        } catch (e) {
            console.error('fetch chainlink market price error', e);
            benchmarkPrice = ZERO;
        }

        return benchmarkPrice;
    }

    async getRawSpotPrice(identifier: InstrumentIdentifier, overrides?: CallOverrides): Promise<BigNumber> {
        if (identifier.marketType === MarketType.DEXV2) {
            return await this.getDexV2RawSpotPrice(identifier, overrides ?? {});
        } else if (isCexMarket(identifier.marketType)) {
            return await this.getCexRawSpotPrice(identifier, overrides ?? {});
        } else {
            throw new SynfError('Unsupported market type: ' + identifier.marketType);
        }
    }

    async getNextInitializedTickOutside(
        instrumentAddr: string,
        expiry: number,
        tick: number,
        right: boolean,
        overrides?: CallOverrides,
    ): Promise<number> {
        return await this.context.perp.contracts.observer.getNextInitializedTickOutside(
            instrumentAddr,
            expiry,
            tick,
            right,
            overrides ?? {},
        );
    }

    async getSizeToTargetTick(
        instrumentAddr: string,
        expiry: number,
        targetTick: number,
        overrides?: CallOverrides,
    ): Promise<BigNumber> {
        const observer = this.context.perp.contracts.observer;
        const amm = await observer.getAmm(instrumentAddr, expiry, overrides ?? {});
        const targetPX96 = TickMath.getSqrtRatioAtTick(targetTick);
        if (targetPX96.eq(amm.sqrtPX96)) {
            return ZERO;
        }
        const long = targetTick > amm.tick;
        let size = ZERO;

        const currTickLeft = (await observer.getPearls(instrumentAddr, expiry, [amm.tick], overrides ?? {}))[0].left;
        if (long && currTickLeft.isNegative()) {
            size = size.sub(currTickLeft);
        }

        let sqrtPX96 = amm.sqrtPX96;
        let liquidity = amm.liquidity;

        let nextTick = await this.getNextInitializedTickOutside(
            instrumentAddr,
            expiry,
            amm.tick + (long ? 0 : 1),
            long,
            overrides ?? {},
        );

        while (true) {
            const nextPX96 = TickMath.getSqrtRatioAtTick(nextTick);
            if ((long && nextTick > targetTick) || (!long && nextTick < targetTick)) {
                // tick has been found
                const delta = SqrtPriceMath.getDeltaBaseAutoRoundUp(sqrtPX96, targetPX96, liquidity);
                // for now, add extra 1 to cover precision loss
                size = long ? size.add(delta).add(1) : size.sub(delta).sub(1);
                break;
            }
            // continue search
            const nextPearl = (await observer.getPearls(instrumentAddr, expiry, [nextTick], overrides ?? {}))[0];
            const delta = SqrtPriceMath.getDeltaBaseAutoRoundUp(sqrtPX96, nextPX96, liquidity);
            size = long ? size.add(delta) : size.sub(delta);
            if (nextTick === targetTick) {
                break;
            }
            if ((long && nextPearl.left.isNegative()) || (!long && nextPearl.left.gt(0))) {
                size = size.sub(nextPearl.left);
            }

            // update
            sqrtPX96 = nextPX96;
            if (nextPearl.liquidityGross.gt(ZERO)) {
                liquidity = liquidity.add(long ? nextPearl.liquidityNet : nextPearl.liquidityNet.mul(-1));
            }

            nextTick = await this.getNextInitializedTickOutside(
                instrumentAddr,
                expiry,
                nextTick,
                long,
                overrides ?? {},
            );
        }
        return size;
    }

    async getFundFlows(
        quoteAddrs: string[],
        trader: string,
        overrides?: CallOverrides,
    ): Promise<{
        fundFlows: FundFlow[];
        blockInfo: BlockInfo;
    }> {
        const gateInterface = this.context.perp.contracts.gate.interface;
        const observerInterface = this.context.perp.contracts.observer.interface;

        const calls: { target: string; callData: string }[] = [];

        calls.push(
            ...quoteAddrs.map((quote) => {
                return {
                    target: this.context.perp.contracts.gate.address,
                    callData: gateInterface.encodeFunctionData('fundFlowOf', [quote, trader]),
                };
            }),
        );
        // just to get the block info
        calls.push({
            target: this.context.perp.contracts.observer.address,
            callData: observerInterface.encodeFunctionData('getVaultBalances', [trader, quoteAddrs]),
        });
        const rawRet = (await this.context.getMulticall3().callStatic.aggregate(calls, overrides ?? {})).returnData;
        const fundFlows = rawRet.slice(0, quoteAddrs.length).map((ret) => {
            return trimObj(gateInterface.decodeFunctionResult('fundFlowOf', ret)[0]) as FundFlow;
        });
        const blockInfo = trimObj(
            observerInterface.decodeFunctionResult('getVaultBalances', rawRet[quoteAddrs.length])[1],
        );
        return { fundFlows, blockInfo: blockInfo as BlockInfo };
    }

    async getUserPendings(
        quotes: string[],
        trader: string,
        overrides?: CallOverrides,
    ): Promise<{
        pendings: { maxWithdrawable: BigNumber; pending: Pending }[];
        blockInfo: BlockInfo;
    }> {
        const gateInterface = this.context.perp.contracts.gate.interface;
        const observerInterface = this.context.perp.contracts.observer.interface;
        const calls: { target: string; callData: string }[] = [];
        calls.push(
            ...quotes.map((quote) => {
                return {
                    target: this.context.perp.contracts.gate.address,
                    callData: gateInterface.encodeFunctionData('fundFlowOf', [quote, trader]),
                };
            }),
        );
        calls.push(
            ...quotes.map((quote) => {
                return {
                    target: this.context.perp.contracts.gate.address,
                    callData: gateInterface.encodeFunctionData('thresholdOf', [quote]),
                };
            }),
        );
        calls.push(
            ...quotes.map((quote) => {
                return {
                    target: this.context.perp.contracts.gate.address,
                    callData: gateInterface.encodeFunctionData('reserveOf', [quote, trader]),
                };
            }),
        );
        calls.push({
            target: this.context.perp.contracts.observer.address,
            callData: observerInterface.encodeFunctionData('getPendings', [quotes, trader]),
        });
        const rawRet = (await this.context.getMulticall3().callStatic.aggregate(calls, overrides ?? {})).returnData;
        const fundFlows = rawRet
            .slice(0, quotes.length)
            .map((ret: string) => gateInterface.decodeFunctionResult('fundFlowOf', ret)[0] as FundFlow);
        const thresholds = rawRet
            .slice(quotes.length, quotes.length * 2)
            .map((ret: string) => gateInterface.decodeFunctionResult('thresholdOf', ret)[0] as BigNumber);
        const reserves = rawRet
            .slice(quotes.length * 2, quotes.length * 3)
            .map((ret: string) => gateInterface.decodeFunctionResult('reserveOf', ret)[0] as BigNumber);
        const decoded = observerInterface.decodeFunctionResult('getPendings', rawRet[quotes.length * 3]);
        const pendings = decoded[0] as Pending[];
        const blockInfo = trimObj(decoded[1]) as BlockInfo;
        return {
            pendings: pendings.map((pending, index) => {
                return {
                    maxWithdrawable: calcMaxWithdrawable(thresholds[index], pending, fundFlows[index], reserves[index]),
                    pending,
                };
            }),
            blockInfo,
        };
    }

    async inquireByBase(
        instrumentAddr: string,
        expiry: number,
        side: Side,
        baseAmount: BigNumber,
        overrides?: CallOverrides,
    ): Promise<{
        quoteAmount: BigNumber;
        quotation: Quotation;
    }> {
        const instrument = Instrument__factory.connect(instrumentAddr, this.context.provider);
        const sign = signOfSide(side);
        const size = baseAmount.mul(sign);
        const quotation = await instrument.inquire(expiry, size, overrides ?? {});
        const entryNotional = quotation.entryNotional;
        return {
            quoteAmount: entryNotional,
            quotation: quotation,
        };
    }

    async inquireByQuote(
        instrumentAddr: string,
        expiry: number,
        side: Side,
        quoteAmount: BigNumber,
        overrides?: CallOverrides,
    ): Promise<{
        baseAmount: BigNumber;
        quotation: Quotation;
    }> {
        const long = side === Side.LONG;
        const { size, quotation } = await this.context.perp.contracts.observer.inquireByNotional(
            instrumentAddr,
            expiry,
            quoteAmount,
            long,
            overrides ?? {},
        );
        return {
            baseAmount: size.abs(),
            quotation: quotation,
        };
    }

    async getPositionIfSettle(portfolio: Portfolio, amm: RawAmm, overrides?: CallOverrides): Promise<Position> {
        let finalPic: RawPosition = {
            balance: ZERO,
            size: ZERO,
            entryNotional: ZERO,
            entrySocialLossIndex: ZERO,
            entryFundingIndex: ZERO,
        };
        const instrumentAddr = portfolio.instrumentAddr;
        const expiry = amm.expiry;
        // range settle part
        const ranges = Array.from(portfolio.ranges.values());
        const orders = Array.from(portfolio.orders.values());
        for (const range of ranges) {
            const position: RawPosition = rangeToPosition(range, amm);
            finalPic = combine(amm, finalPic, position).position;
        }

        const ticks = orders.map((o) => o.tick);
        const nonces = orders.map((o) => o.nonce);
        const pearls = await this.context.perp.contracts.observer.getPearls(
            instrumentAddr,
            expiry,
            ticks,
            overrides ?? {},
        );
        const records = await this.context.perp.contracts.observer.getRecords(
            instrumentAddr,
            expiry,
            ticks,
            nonces,
            overrides ?? {},
        );
        // order settle part
        for (let i = 0; i < orders.length; i++) {
            const order = orders[i];
            const pearl = pearls[i];
            const record = records[i];
            let position: RawPosition;
            if (pearl.nonce === order.nonce) {
                position = cancelOrderToPosition(
                    pearl.left,
                    pearl.nonce,
                    pearl.taken,
                    pearl.fee,
                    pearl.entrySocialLossIndex,
                    pearl.entryFundingIndex,
                    order,
                    order.tick,
                    order.nonce,
                    record,
                );
            } else {
                position = fillOrderToPosition(
                    pearl.nonce,
                    pearl.taken,
                    pearl.fee,
                    pearl.entrySocialLossIndex,
                    pearl.entryFundingIndex,
                    order,
                    order.tick,
                    order.nonce,
                    order.size,
                    record,
                );
            }
            finalPic = combine(amm, finalPic, position).position;
        }
        // position settle part
        finalPic = combine(amm, finalPic, portfolio.position).position;
        return factory.createPosition({
            ...finalPic,
            instrumentAddr,
            expiry,
            traderAddr: portfolio.traderAddr,
        });
    }

    async getDexV2RawSpotPrice(identifier: InstrumentIdentifier, overrides?: CallOverrides): Promise<BigNumber> {
        const { baseTokenInfo, quoteTokenInfo } = await getTokenInfo(identifier, this.context);

        const baseScaler = BigNumber.from(10).pow(18 - baseTokenInfo.decimals);
        const quoteScaler = BigNumber.from(10).pow(18 - quoteTokenInfo.decimals);

        const isToken0Quote = BigNumber.from(baseTokenInfo.address).gt(BigNumber.from(quoteTokenInfo.address));

        const dexV2PairInfo = await this.context.perp.contracts.observer.inspectMaxReserveDexV2Pair(
            baseTokenInfo.address,
            quoteTokenInfo.address,
            overrides ?? {},
        );
        if (
            dexV2PairInfo.maxReservePair === ZERO_ADDRESS ||
            dexV2PairInfo.reserve0.isZero() ||
            dexV2PairInfo.reserve1.isZero()
        ) {
            // no liquidity
            return ZERO;
        }

        return isToken0Quote
            ? wdiv(dexV2PairInfo.reserve0.mul(quoteScaler), dexV2PairInfo.reserve1.mul(baseScaler))
            : wdiv(dexV2PairInfo.reserve1.mul(quoteScaler), dexV2PairInfo.reserve0.mul(baseScaler));
    }

    async getCexRawSpotPrice(
        instrumentIdentifier: InstrumentIdentifier,
        overrides?: CallOverrides,
    ): Promise<BigNumber> {
        const instrumentAddress = await this.context.perp.instrument.computeInstrumentAddress(instrumentIdentifier);
        const market = this.context.perp.contracts.marketContracts[instrumentIdentifier.marketType]
            ?.market as CexMarket;
        let rawSpotPrice;
        try {
            rawSpotPrice = await market.getRawPrice(instrumentAddress, overrides ?? {});
        } catch (e) {
            console.error('fetch chainlink spot price error', e);
            rawSpotPrice = ZERO;
        }
        return rawSpotPrice;
    }

    async getGateBalance(target: string, quoteAddrs: string[], overrides?: CallOverrides): Promise<BigNumber[]> {
        const resp = await this.context.perp.contracts.observer.getVaultBalances(target, quoteAddrs, overrides ?? {});
        const balance: BigNumber[] = [];
        for (let i = 0; i < quoteAddrs.length; i++) {
            balance.push(resp[0][i]);
        }
        return balance;
    }

    async getGateBalances(target: string, overrides?: CallOverrides): Promise<(TokenInfo & { balance: BigNumber })[]> {
        const quotes = await Promise.all(
            Object.keys(this.context.perp.configuration.config.quotesParam).map((quote) =>
                this.context.getTokenInfo(quote),
            ),
        );

        const gateBalances = await this.getGateBalance(
            target,
            quotes.map((quote) => quote.address),
            overrides,
        );

        const results: (TokenInfo & { balance: BigNumber })[] = [];

        for (let i = 0; i < quotes.length; i++) {
            if (gateBalances[i].eq(0)) {
                continue;
            }

            results.push({
                ...quotes[i],
                balance: gateBalances[i],
            });
        }

        return results;
    }

    async getLiquidityDetails(
        instrumentAddr: string,
        expiry: number,
        tickDelta: number,
        overrides?: CallOverrides,
    ): Promise<LiquidityDetails> {
        const liquidityDetails = await this.context.perp.contracts.observer.liquidityDetails(
            instrumentAddr,
            expiry,
            tickDelta,
            overrides ?? {},
        );

        const tick2Pearl = new Map<number, MinimalPearl>();
        for (let i = 0; i < liquidityDetails.tids.length; i++) {
            tick2Pearl.set(liquidityDetails.tids[i], liquidityDetails.pearls[i]);
        }

        return {
            ...trimObj(liquidityDetails),
            tick2Pearl,
        };
    }
}
