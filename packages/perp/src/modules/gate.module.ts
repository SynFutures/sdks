import { BigNumber, ethers } from 'ethers';
import { Context } from '@derivation-tech/context';
import { NATIVE_TOKEN_ADDRESS } from '../constants';
import { GateInterface } from './gate.interface';
import { TxOptions, TxOptionsWithSigner } from '../types';
import { encodeDepositParam, encodeWithdrawParam, toPopulatedTxOverrides } from '../utils';
import { NumericConverter } from '../math';

export class GateModule implements GateInterface {
    context: Context;

    constructor(context: Context) {
        this.context = context;
    }

    async deposit(
        quoteAddr: string,
        amount: BigNumber,
        txOptions: TxOptionsWithSigner,
    ): Promise<ethers.providers.TransactionReceipt>;
    async deposit(quoteAddr: string, amount: BigNumber, txOptions?: TxOptions): Promise<ethers.PopulatedTransaction>;
    async deposit(
        quoteAddr: string,
        amount: BigNumber,
        txOptions?: TxOptions,
    ): Promise<ethers.providers.TransactionReceipt | ethers.PopulatedTransaction> {
        const usingNative = quoteAddr.toLowerCase() === NATIVE_TOKEN_ADDRESS.toLowerCase();
        const unsignedTx = await this.context.perp.contracts.gate.populateTransaction.deposit(
            encodeDepositParam(quoteAddr, amount),
            { ...toPopulatedTxOverrides(txOptions), ...(usingNative ? { value: amount } : {}) },
        );
        return this.context.tx.sendTx(unsignedTx, txOptions);
    }

    async depositWad(
        quoteAddr: string,
        amount: BigNumber,
        txOptions: TxOptionsWithSigner,
    ): Promise<ethers.providers.TransactionReceipt>;
    async depositWad(quoteAddr: string, amount: BigNumber, txOptions?: TxOptions): Promise<ethers.PopulatedTransaction>;
    async depositWad(
        quoteAddr: string,
        amount: BigNumber,
        txOptions?: TxOptions,
    ): Promise<ethers.providers.TransactionReceipt | ethers.PopulatedTransaction> {
        const usingNative = quoteAddr.toLowerCase() === NATIVE_TOKEN_ADDRESS.toLowerCase();
        const quoteInfo = usingNative ? this.context.wrappedNativeToken : await this.context.getTokenInfo(quoteAddr);
        const decimals = quoteInfo.decimals;
        const amountCover = NumericConverter.toContractQuoteAmount(amount, decimals);
        return this.deposit(quoteAddr, amountCover, txOptions);
    }

    async withdraw(
        quoteAddr: string,
        amount: BigNumber,
        txOptions: TxOptionsWithSigner,
    ): Promise<ethers.providers.TransactionReceipt>;
    async withdraw(quoteAddr: string, amount: BigNumber, txOptions?: TxOptions): Promise<ethers.PopulatedTransaction>;
    async withdraw(
        quoteAddr: string,
        amount: BigNumber,
        txOptions?: TxOptions,
    ): Promise<ethers.providers.TransactionReceipt | ethers.PopulatedTransaction> {
        const unsignedTx = await this.context.perp.contracts.gate.populateTransaction.withdraw(
            encodeWithdrawParam(quoteAddr, amount),
            toPopulatedTxOverrides(txOptions),
        );
        return await this.context.tx.sendTx(unsignedTx, txOptions);
    }

    async withdrawWad(
        quoteAddr: string,
        amount: BigNumber,
        txOptions: TxOptionsWithSigner,
    ): Promise<ethers.providers.TransactionReceipt>;
    async withdrawWad(
        quoteAddr: string,
        amount: BigNumber,
        txOptions?: TxOptions,
    ): Promise<ethers.PopulatedTransaction>;
    async withdrawWad(
        quoteAddr: string,
        amount: BigNumber,
        txOptions?: TxOptions,
    ): Promise<ethers.providers.TransactionReceipt | ethers.PopulatedTransaction> {
        const usingNative = quoteAddr.toLowerCase() === NATIVE_TOKEN_ADDRESS.toLowerCase();
        const quoteInfo = usingNative ? this.context.wrappedNativeToken : await this.context.getTokenInfo(quoteAddr);
        const decimals = quoteInfo.decimals;
        const amountCover = NumericConverter.toContractQuoteAmount(amount, decimals);
        return await this.withdraw(quoteAddr, amountCover, txOptions);
    }

    async getPendingParams(
        quotes: string[],
        txOptions?: TxOptions,
    ): Promise<{
        pendingDuration: BigNumber;
        thresholds: BigNumber[];
    }> {
        const gateInterface = this.context.perp.contracts.gate.interface;
        const calls = quotes.map((quote) => {
            return {
                target: this.context.perp.contracts.gate.address,
                callData: gateInterface.encodeFunctionData('thresholdOf', [quote]),
            };
        });
        calls.push({
            target: this.context.perp.contracts.gate.address,
            callData: gateInterface.encodeFunctionData('pendingDuration'),
        });
        const rawRet = (
            await this.context.getMulticall3().callStatic.aggregate(calls, toPopulatedTxOverrides(txOptions))
        ).returnData;
        const thresholds = rawRet
            .slice(0, quotes.length)
            .map((ret) => gateInterface.decodeFunctionResult('thresholdOf', ret)[0] as BigNumber);
        const pendingDuration = gateInterface.decodeFunctionResult(
            'pendingDuration',
            rawRet[quotes.length],
        )[0] as BigNumber;
        return { pendingDuration, thresholds };
    }

    claimPendingWithdraw(
        quote: string,
        trader: string,
        txOptions: TxOptionsWithSigner,
    ): Promise<ethers.providers.TransactionReceipt>;
    claimPendingWithdraw(quote: string, trader: string, txOptions?: TxOptions): Promise<ethers.PopulatedTransaction>;
    async claimPendingWithdraw(
        quote: string,
        trader: string,
        txOptions?: TxOptions,
    ): Promise<ethers.providers.TransactionReceipt | ethers.PopulatedTransaction> {
        const unsignedTx = await this.context.perp.contracts.gate.populateTransaction.release(
            quote,
            trader,
            toPopulatedTxOverrides(txOptions),
        );

        return this.context.tx.sendTx(unsignedTx, txOptions);
    }
}
