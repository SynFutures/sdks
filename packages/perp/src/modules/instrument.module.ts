import { BigNumber, ethers } from 'ethers';
import { Context } from '@derivation-tech/context';
import { Instrument__factory } from '../typechain';
import {
    PlaceLimitOrderParam,
    AddLiquidityParam,
    PlaceMarketOrderParam,
    AddParam,
    AdjustMarginParam,
    BatchCancelOrderParam,
    CancelOrderParam,
    FillOrderParam,
    InstrumentIdentifier,
    PlaceCrossMarketOrderParam,
    PlaceParam,
    RemoveLiquidityParam,
    TxOptions,
    TxOptionsWithSigner,
    BatchPlaceLimitOrderParam,
    SettleParam,
} from '../types';
import { MarketType, Side } from '../enum';
import {
    toPopulatedTxOverrides,
    encodeTradeParam,
    encodePlaceParam,
    encodeAddParam,
    encodeAdjustParam,
    encodeCancelParam,
    encodeFillParam,
    encodeRemoveParam,
    encodeBatchPlaceParam,
    getTokenInfo,
    isCexMarket,
    signOfSide,
} from '../utils';
import { DEFAULT_REFERRAL_CODE, MAX_CANCEL_ORDER_COUNT } from '../constants';
import { InstrumentInterface } from './instrument.interface';
import { InstrumentParser } from '../parser';
import { SynfError } from '../errors/synfError';
import { SimulationError } from '../errors/simulationError';

export class InstrumentModule implements InstrumentInterface {
    context: Context;

    constructor(context: Context) {
        this.context = context;
    }

    getInstrumentContract(address: string, signerOrProvider?: ethers.providers.Provider | ethers.Signer) {
        return Instrument__factory.connect(address, signerOrProvider ?? this.context.provider);
    }

    async computeInstrumentAddress(instrumentIdentifier: InstrumentIdentifier): Promise<string> {
        const gateAddress = this.context.perp.configuration.config.contractAddress.gate;
        const marketType = instrumentIdentifier.marketType as MarketType;
        const beaconAddress = this.context.perp.configuration.config.contractAddress.market[marketType]!.beacon;
        const instrumentProxyByteCode = this.context.perp.configuration.config.instrumentProxyByteCode;
        const salt = await this.computeInstrumentSalt(instrumentIdentifier);
        return ethers.utils.getCreate2Address(
            gateAddress,
            ethers.utils.keccak256(salt),
            ethers.utils.keccak256(
                ethers.utils.solidityPack(
                    ['bytes', 'bytes32'],
                    [instrumentProxyByteCode, ethers.utils.hexZeroPad(beaconAddress, 32)],
                ),
            ),
        );
    }

    async computeInstrumentSalt(instrumentIdentifier: InstrumentIdentifier): Promise<string> {
        const { baseTokenInfo, quoteTokenInfo } = await getTokenInfo(instrumentIdentifier, this.context);

        const quoteAddress = quoteTokenInfo.address;

        let data;
        if (isCexMarket(instrumentIdentifier.marketType)) {
            const baseSymbol =
                typeof instrumentIdentifier.baseSymbol === 'string'
                    ? instrumentIdentifier.baseSymbol
                    : instrumentIdentifier.baseSymbol.symbol;
            data = ethers.utils.defaultAbiCoder.encode(
                ['string', 'string', 'address'],
                [instrumentIdentifier.marketType.toString(), baseSymbol, quoteAddress],
            );
        } else {
            data = ethers.utils.defaultAbiCoder.encode(
                ['string', 'address', 'address'],
                [instrumentIdentifier.marketType.toString(), baseTokenInfo.address, quoteAddress],
            );
        }

        return data;
    }

    async computeInitData(instrumentIdentifier: InstrumentIdentifier): Promise<string> {
        const { baseTokenInfo, quoteTokenInfo } = await getTokenInfo(instrumentIdentifier, this.context);

        const quoteAddress = quoteTokenInfo.address;

        let data;
        if (isCexMarket(instrumentIdentifier.marketType)) {
            const baseSymbol =
                typeof instrumentIdentifier.baseSymbol === 'string'
                    ? instrumentIdentifier.baseSymbol
                    : instrumentIdentifier.baseSymbol.symbol;

            data = ethers.utils.defaultAbiCoder.encode(['string', 'address'], [baseSymbol, quoteAddress]);
        } else {
            data = ethers.utils.defaultAbiCoder.encode(['address', 'address'], [baseTokenInfo.address, quoteAddress]);
        }

        return data;
    }

    donateInsuranceFund(
        instrumentAddr: string,
        expiry: number,
        amount: BigNumber,
        txOptions: TxOptionsWithSigner,
    ): Promise<ethers.providers.TransactionReceipt>;
    donateInsuranceFund(
        instrumentAddr: string,
        expiry: number,
        amount: BigNumber,
        txOptions?: TxOptions,
    ): Promise<ethers.PopulatedTransaction>;
    async donateInsuranceFund(
        instrumentAddr: string,
        expiry: number,
        amount: BigNumber,
        txOptions?: TxOptions,
    ): Promise<ethers.providers.TransactionReceipt | ethers.PopulatedTransaction> {
        const instrument = this.getInstrumentContract(instrumentAddr, txOptions?.signer);
        const unsignedTx = await instrument.populateTransaction.donateInsuranceFund(
            expiry,
            amount,
            toPopulatedTxOverrides(txOptions),
        );
        return this.context.tx.sendTx(unsignedTx, txOptions);
    }

    fillLimitOrder(param: FillOrderParam, txOptions: TxOptionsWithSigner): Promise<ethers.providers.TransactionReceipt>;
    fillLimitOrder(param: FillOrderParam, txOptions?: TxOptions): Promise<ethers.PopulatedTransaction>;
    async fillLimitOrder(
        param: FillOrderParam,
        txOptions?: TxOptions,
    ): Promise<ethers.providers.TransactionReceipt | ethers.PopulatedTransaction> {
        const instrument = this.getInstrumentContract(param.instrumentAddr, txOptions?.signer);
        const unsignedTx = await instrument.populateTransaction.fill(
            encodeFillParam(param),
            toPopulatedTxOverrides(txOptions),
        );
        return this.context.tx.sendTx(unsignedTx, txOptions);
    }

    adjustMargin(
        param: AdjustMarginParam,
        txOptions: TxOptionsWithSigner,
    ): Promise<ethers.providers.TransactionReceipt>;
    adjustMargin(param: AdjustMarginParam, txOptions?: TxOptions): Promise<ethers.PopulatedTransaction>;
    async adjustMargin(
        param: AdjustMarginParam,
        txOptions?: TxOptions,
    ): Promise<ethers.providers.TransactionReceipt | ethers.PopulatedTransaction> {
        const sign: number = param.transferIn ? 1 : -1;
        const instrument = this.getInstrumentContract(param.instrumentAddr, txOptions?.signer);

        const unsignedTx = await instrument.populateTransaction.trade(
            encodeAdjustParam({
                expiry: param.expiry,
                net: param.margin.mul(sign),
                deadline: param.deadline,
                referralCode: param.referralCode ?? DEFAULT_REFERRAL_CODE,
            }),
            toPopulatedTxOverrides(txOptions),
        );
        return this.context.tx.sendTx(unsignedTx, txOptions);
    }

    addLiquidity(
        param: AddLiquidityParam,
        txOptions: TxOptionsWithSigner,
    ): Promise<ethers.providers.TransactionReceipt>;
    addLiquidity(param: AddLiquidityParam, txOptions?: TxOptions): Promise<ethers.PopulatedTransaction>;
    async addLiquidity(
        param: AddLiquidityParam,
        txOptions?: TxOptions,
    ): Promise<ethers.providers.TransactionReceipt | ethers.PopulatedTransaction> {
        const addParam: AddParam = {
            expiry: param.expiry,
            tickDeltaLower: param.tickDeltaLower,
            tickDeltaUpper: param.tickDeltaUpper,
            amount: param.margin,
            limitTicks: param.limitTicks,
            deadline: param.deadline,
            referralCode: param.referralCode ?? DEFAULT_REFERRAL_CODE,
        };
        let unsignedTx;
        if (typeof param.instrumentAddr !== 'string') {
            const gate = this.context.perp.contracts.gate.connect(txOptions?.signer || this.context.provider);
            const instrumentIdentifier = param.instrumentAddr;
            const instrumentAddress = await this.computeInstrumentAddress(instrumentIdentifier);
            const indexOfInstrument = await gate.indexOf(instrumentAddress, toPopulatedTxOverrides(txOptions));
            if (!BigNumber.from(indexOfInstrument).isZero()) {
                throw new SynfError('Instrument exits: ' + instrumentAddress);
            }
            this.context.registerContractParser(instrumentAddress, new InstrumentParser());
            this.context.registerAddress(
                instrumentAddress,
                instrumentIdentifier.baseSymbol +
                    '-' +
                    instrumentIdentifier.quoteSymbol +
                    '-' +
                    instrumentIdentifier.marketType,
            );
            // need to create instrument
            unsignedTx = await gate.populateTransaction.launch(
                instrumentIdentifier.marketType,
                instrumentAddress,
                await this.computeInitData(instrumentIdentifier),
                encodeAddParam(addParam),
                toPopulatedTxOverrides(txOptions),
            );
            return this.context.tx.sendTx(unsignedTx, txOptions);
        } else {
            const instrument = this.getInstrumentContract(param.instrumentAddr, txOptions?.signer);
            const unsignedTx = await instrument.populateTransaction.add(
                encodeAddParam(addParam),
                toPopulatedTxOverrides(txOptions),
            );
            return this.context.tx.sendTx(unsignedTx, txOptions);
        }
    }

    removeLiquidity(
        param: RemoveLiquidityParam,
        txOptions: TxOptionsWithSigner,
    ): Promise<ethers.providers.TransactionReceipt>;
    removeLiquidity(param: RemoveLiquidityParam, txOptions?: TxOptions): Promise<ethers.PopulatedTransaction>;
    async removeLiquidity(
        param: RemoveLiquidityParam,
        txOptions?: TxOptions,
    ): Promise<ethers.providers.TransactionReceipt | ethers.PopulatedTransaction> {
        const instrument = this.getInstrumentContract(param.instrumentAddr, txOptions?.signer);
        const unsignedTx = await instrument.populateTransaction.remove(
            encodeRemoveParam(param),
            toPopulatedTxOverrides(txOptions),
        );
        return this.context.tx.sendTx(unsignedTx, txOptions);
    }

    placeLimitOrder(
        param: PlaceLimitOrderParam,
        txOptions: TxOptionsWithSigner,
    ): Promise<ethers.providers.TransactionReceipt>;
    placeLimitOrder(param: PlaceLimitOrderParam, txOptions?: TxOptions): Promise<ethers.PopulatedTransaction>;
    async placeLimitOrder(
        addLimitOrderParam: PlaceLimitOrderParam,
        txOptions?: TxOptions,
    ): Promise<ethers.providers.TransactionReceipt | ethers.PopulatedTransaction> {
        const sign = signOfSide(addLimitOrderParam.side);
        const param: PlaceParam = {
            expiry: addLimitOrderParam.expiry,
            size: addLimitOrderParam.baseSize.mul(sign),
            amount: addLimitOrderParam.margin,
            tick: addLimitOrderParam.tick,
            deadline: addLimitOrderParam.deadline,
        };
        const instrument = this.getInstrumentContract(addLimitOrderParam.instrumentAddr, txOptions?.signer);
        const unsignedTx = await instrument.populateTransaction.place(
            encodePlaceParam({
                expiry: param.expiry,
                size: param.size,
                amount: param.amount,
                tick: param.tick,
                deadline: param.deadline,
                referralCode: addLimitOrderParam.referralCode ?? DEFAULT_REFERRAL_CODE,
            }),
            toPopulatedTxOverrides(txOptions),
        );
        return this.context.tx.sendTx(unsignedTx, txOptions);
    }

    placeMarketOrder(
        param: PlaceMarketOrderParam,
        txOptions: TxOptionsWithSigner,
    ): Promise<ethers.providers.TransactionReceipt>;
    placeMarketOrder(param: PlaceMarketOrderParam, txOptions?: TxOptions): Promise<ethers.PopulatedTransaction>;
    async placeMarketOrder(
        param: PlaceMarketOrderParam,
        txOptions?: TxOptions,
    ): Promise<ethers.providers.TransactionReceipt | ethers.PopulatedTransaction> {
        if (param.side === Side.FLAT) {
            throw new SimulationError('Invalid Price');
        }
        const sign = signOfSide(param.side);
        const tradeParam: PlaceParam = {
            expiry: param.expiry,
            size: param.baseSize.mul(sign),
            amount: param.margin,
            tick: param.limitTick,
            deadline: param.deadline,
            referralCode: param.referralCode ?? DEFAULT_REFERRAL_CODE,
        };
        const instrument = this.getInstrumentContract(param.instrumentAddr, txOptions?.signer);
        const unsignedTx = await instrument.populateTransaction.trade(
            encodePlaceParam(tradeParam),
            toPopulatedTxOverrides(txOptions),
        );
        return this.context.tx.sendTx(unsignedTx, txOptions);
    }

    cancelLimitOrder(
        param: CancelOrderParam,
        txOptions: TxOptionsWithSigner,
    ): Promise<ethers.providers.TransactionReceipt>;
    cancelLimitOrder(param: CancelOrderParam, txOptions?: TxOptions): Promise<ethers.PopulatedTransaction>;
    async cancelLimitOrder(
        param: CancelOrderParam,
        txOptions?: TxOptions,
    ): Promise<ethers.providers.TransactionReceipt | ethers.PopulatedTransaction> {
        const instrument = this.getInstrumentContract(param.instrumentAddr, txOptions?.signer);
        const unsignedTx = await instrument.populateTransaction.cancel(
            encodeCancelParam({ expiry: param.expiry, ticks: [param.tick], deadline: param.deadline }),
            toPopulatedTxOverrides(txOptions),
        );
        return this.context.tx.sendTx(unsignedTx, txOptions);
    }

    batchPlaceLimitOrder(
        param: BatchPlaceLimitOrderParam,
        txOptions: TxOptionsWithSigner,
    ): Promise<ethers.providers.TransactionReceipt>;
    batchPlaceLimitOrder(param: BatchPlaceLimitOrderParam, txOptions?: TxOptions): Promise<ethers.PopulatedTransaction>;
    async batchPlaceLimitOrder(
        param: BatchPlaceLimitOrderParam,
        txOptions?: TxOptions,
    ): Promise<ethers.providers.TransactionReceipt | ethers.PopulatedTransaction> {
        if (param.side === Side.FLAT) {
            throw new SimulationError('Invalid Price');
        }
        const sign = signOfSide(param.side);
        const instrument = this.getInstrumentContract(param.instrumentAddr, txOptions?.signer);
        const unsignedTx = await instrument.populateTransaction.batchPlace(
            encodeBatchPlaceParam(
                param.expiry,
                param.baseSize.mul(sign),
                param.leverage,
                param.ticks,
                param.ratios,
                param.deadline,
                param.referralCode ?? DEFAULT_REFERRAL_CODE,
            ),
            toPopulatedTxOverrides(txOptions),
        );
        return this.context.tx.sendTx(unsignedTx, txOptions);
    }

    batchCancelLimitOrder(
        param: BatchCancelOrderParam,
        txOptions: TxOptionsWithSigner,
    ): Promise<ethers.providers.TransactionReceipt>;
    batchCancelLimitOrder(param: BatchCancelOrderParam, txOptions?: TxOptions): Promise<ethers.PopulatedTransaction>;
    async batchCancelLimitOrder(
        param: BatchCancelOrderParam,
        txOptions?: TxOptions,
    ): Promise<ethers.providers.TransactionReceipt | ethers.PopulatedTransaction> {
        const instrument = this.getInstrumentContract(param.instrumentAddr, txOptions?.signer);

        if (param.orderTicks.length <= MAX_CANCEL_ORDER_COUNT) {
            const unsignedTx = await instrument.populateTransaction.cancel(
                encodeCancelParam({ expiry: param.expiry, ticks: param.orderTicks, deadline: param.deadline }),
                toPopulatedTxOverrides(txOptions),
            );
            return this.context.tx.sendTx(unsignedTx, txOptions);
        } else {
            // split ticks by size of MAX_CANCEL_ORDER_COUNT
            const tickGroups = [];
            for (let i = 0; i < param.orderTicks.length; i += MAX_CANCEL_ORDER_COUNT) {
                tickGroups.push(param.orderTicks.slice(i, i + MAX_CANCEL_ORDER_COUNT));
            }
            const calldatas = tickGroups.map((group) => {
                return instrument.interface.encodeFunctionData('cancel', [
                    encodeCancelParam({ expiry: param.expiry, ticks: group, deadline: param.deadline }),
                ]);
            });
            const unsignedTx = await instrument.populateTransaction.multicall(
                calldatas,
                toPopulatedTxOverrides(txOptions),
            );
            return this.context.tx.sendTx(unsignedTx, txOptions);
        }
    }

    placeCrossMarketOrder(
        param: PlaceCrossMarketOrderParam,
        txOptions: TxOptionsWithSigner,
    ): Promise<ethers.providers.TransactionReceipt>;
    placeCrossMarketOrder(
        param: PlaceCrossMarketOrderParam,
        txOptions?: TxOptions,
    ): Promise<ethers.PopulatedTransaction>;
    async placeCrossMarketOrder(
        param: PlaceCrossMarketOrderParam,
        txOptions?: TxOptions,
    ): Promise<ethers.providers.TransactionReceipt | ethers.PopulatedTransaction> {
        const sign = signOfSide(param.side);
        const instrument = this.getInstrumentContract(param.instrumentAddr, txOptions?.signer);

        const callData = [];

        callData.push(
            instrument.interface.encodeFunctionData('trade', [
                encodeTradeParam({
                    expiry: param.expiry,
                    size: param.tradeSize.mul(sign),
                    amount: param.tradeMargin,
                    limitTick: param.tradeLimitTick,
                    deadline: param.deadline,
                    referralCode: param.referralCode ?? DEFAULT_REFERRAL_CODE,
                }),
            ]),
        );

        callData.push(
            instrument.interface.encodeFunctionData('place', [
                encodePlaceParam({
                    expiry: param.expiry,
                    size: param.orderSize.mul(sign),
                    amount: param.orderMargin,
                    tick: param.orderTick,
                    deadline: param.deadline,
                    referralCode: param.referralCode ?? DEFAULT_REFERRAL_CODE,
                }),
            ]),
        );

        const unsignedTx = await instrument.populateTransaction.multicall(callData, toPopulatedTxOverrides(txOptions));

        return this.context.tx.sendTx(unsignedTx, txOptions);
    }

    settle(param: SettleParam, txOptions: TxOptionsWithSigner): Promise<ethers.providers.TransactionReceipt>;
    settle(param: SettleParam, txOptions?: TxOptions): Promise<ethers.PopulatedTransaction>;
    async settle(
        param: SettleParam,
        txOptions?: TxOptions,
    ): Promise<ethers.providers.TransactionReceipt | ethers.PopulatedTransaction> {
        const instrument = this.getInstrumentContract(param.instrumentAddr, txOptions?.signer);

        const unsignedTx = await instrument.populateTransaction.settle(
            param.expiry,
            param.target,
            toPopulatedTxOverrides(txOptions),
        );

        return this.context.tx.sendTx(unsignedTx, txOptions);
    }

    multicall(
        instrumentAddr: string,
        callData: string[],
        txOptions: TxOptionsWithSigner,
    ): Promise<ethers.providers.TransactionReceipt>;
    multicall(instrumentAddr: string, callData: string[], txOptions?: TxOptions): Promise<ethers.PopulatedTransaction>;
    async multicall(
        instrumentAddr: string,
        callData: string[],
        txOptions?: TxOptions,
    ): Promise<ethers.providers.TransactionReceipt | ethers.PopulatedTransaction> {
        const instrument = this.getInstrumentContract(instrumentAddr, txOptions?.signer);

        const unsignedTx = await instrument.populateTransaction.multicall(callData, toPopulatedTxOverrides(txOptions));

        return this.context.tx.sendTx(unsignedTx, txOptions);
    }
}
