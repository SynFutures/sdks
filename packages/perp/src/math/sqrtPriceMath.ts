// Removed bigint import, using native bigint
import { solidityRequire } from '../utils';
import { Quotation, QuoteParam } from '../types';
import { MAX_UINT_160, ONE, Q96, ZERO } from './constants';
import { addIn256, r2w, mulDivRoundingUp, multiplyIn256, wmulUp, wdiv } from './basic';

export abstract class SqrtPriceMath {
    public static getDeltaBaseAutoRoundUp(
        sqrtRatioAX96: bigint,
        sqrtRatioBX96: bigint,
        liquidity: bigint,
    ): bigint {
        return liquidity < ZERO
            ? this.getDeltaBase(sqrtRatioAX96, sqrtRatioBX96, liquidity * -1n, false) * -1n
            : this.getDeltaBase(sqrtRatioAX96, sqrtRatioBX96, liquidity, true);
    }

    public static getDeltaQuoteAutoRoundUp(
        sqrtRatioAX96: bigint,
        sqrtRatioBX96: bigint,
        liquidity: bigint,
    ): bigint {
        return liquidity < ZERO
            ? this.getDeltaQuote(sqrtRatioAX96, sqrtRatioBX96, liquidity * -1n, false) * -1n
            : this.getDeltaQuote(sqrtRatioAX96, sqrtRatioBX96, liquidity, true);
    }

    public static getDeltaBase(
        sqrtRatioAX96: bigint,
        sqrtRatioBX96: bigint,
        liquidity: bigint,
        roundUp: boolean,
    ): bigint {
        if (sqrtRatioAX96 > sqrtRatioBX96) {
            [sqrtRatioAX96, sqrtRatioBX96] = [sqrtRatioBX96, sqrtRatioAX96];
        }
        const numerator1 = liquidity << 96n;
        const numerator2 = sqrtRatioBX96 - sqrtRatioAX96;
        return roundUp
            ? mulDivRoundingUp(mulDivRoundingUp(numerator1, numerator2, sqrtRatioBX96), ONE, sqrtRatioAX96)
            : (numerator1 * numerator2) / sqrtRatioBX96 / sqrtRatioAX96;
    }

    public static getDeltaQuote(
        sqrtRatioAX96: bigint,
        sqrtRatioBX96: bigint,
        liquidity: bigint,
        roundUp: boolean,
    ): bigint {
        if (sqrtRatioAX96 > sqrtRatioBX96) {
            [sqrtRatioAX96, sqrtRatioBX96] = [sqrtRatioBX96, sqrtRatioAX96];
        }
        return roundUp
            ? mulDivRoundingUp(liquidity, sqrtRatioBX96 - sqrtRatioAX96, Q96)
            : ((sqrtRatioBX96 - sqrtRatioAX96) * liquidity) / Q96;
    }

    public static getNextSqrtPriceFromDeltaBase(
        sqrtPX96: bigint,
        liquidity: bigint,
        amount: bigint,
        isLong: boolean,
    ): bigint {
        solidityRequire(sqrtPX96 > ZERO);
        solidityRequire(liquidity > ZERO);

        // round to make sure that we pass the target price
        return this.getNextSqrtPriceFromAmount0RoundingUp(sqrtPX96, liquidity, amount, !isLong);
    }

    public static getNextSqrtPriceFromInput(
        sqrtPX96: bigint,
        liquidity: bigint,
        amountIn: bigint,
        zeroForOne: boolean,
    ): bigint {
        solidityRequire(sqrtPX96 > ZERO);
        solidityRequire(liquidity > ZERO);

        return zeroForOne
            ? this.getNextSqrtPriceFromAmount0RoundingUp(sqrtPX96, liquidity, amountIn, true)
            : this.getNextSqrtPriceFromAmount1RoundingDown(sqrtPX96, liquidity, amountIn, true);
    }

    public static getNextSqrtPriceFromOutput(
        sqrtPX96: bigint,
        liquidity: bigint,
        amountOut: bigint,
        zeroForOne: boolean,
    ): bigint {
        solidityRequire(sqrtPX96 > ZERO);
        solidityRequire(liquidity > ZERO);

        return zeroForOne
            ? this.getNextSqrtPriceFromAmount1RoundingDown(sqrtPX96, liquidity, amountOut, false)
            : this.getNextSqrtPriceFromAmount0RoundingUp(sqrtPX96, liquidity, amountOut, false);
    }

    public static getLiquidityFromMargin(
        sqrtEntryPX96: bigint,
        sqrtUpperPX96: bigint,
        entryMargin: bigint,
        initialMarginRatio: number,
    ): bigint {
        solidityRequire(sqrtEntryPX96 > ZERO);
        solidityRequire(sqrtUpperPX96 > ZERO);
        const numerator1 = entryMargin * sqrtUpperPX96;
        const numerator2 = sqrtEntryPX96;
        const denominator1 = sqrtUpperPX96 - sqrtEntryPX96;

        let temp = (numerator1 * numerator2) / denominator1;
        temp = (temp * Q96) / sqrtUpperPX96;
        const denominator2 = wmulUp(sqrtUpperPX96, r2w(BigInt(initialMarginRatio + 10000))) - sqrtEntryPX96;
        return temp / denominator2;
    }

    private static getNextSqrtPriceFromAmount0RoundingUp(
        sqrtPX96: bigint,
        liquidity: bigint,
        amount: bigint,
        add: boolean,
    ): bigint {
        if (amount === ZERO) return sqrtPX96;
        const numerator1 = liquidity << 96n;
        if (add) {
            const product = multiplyIn256(amount, sqrtPX96);
            if (product / amount === sqrtPX96) {
                const denominator = addIn256(numerator1, product);
                if (denominator >= numerator1) {
                    return mulDivRoundingUp(numerator1, sqrtPX96, denominator);
                }
            }
            return mulDivRoundingUp(numerator1, ONE, (numerator1 / sqrtPX96) + amount);
        } else {
            const product = multiplyIn256(amount, sqrtPX96);
            solidityRequire(product / amount === sqrtPX96);
            solidityRequire(numerator1 > product);
            return mulDivRoundingUp(numerator1, sqrtPX96, numerator1 - product);
        }
    }

    private static getNextSqrtPriceFromAmount1RoundingDown(
        sqrtPX96: bigint,
        liquidity: bigint,
        amount: bigint,
        add: boolean,
    ): bigint {
        if (add) {
            const quotient = amount <= MAX_UINT_160 ? (amount << 96n) / liquidity : (amount * Q96) / liquidity;
            return sqrtPX96 + quotient;
        } else {
            const quotient = mulDivRoundingUp(amount, Q96, liquidity);
            solidityRequire(sqrtPX96 > quotient);
            return sqrtPX96 - quotient;
        }
    }

    public static getStabilityFee(quotation: Quotation, param: QuoteParam): bigint {
        const feePaid = quotation.fee;
        const protocolFeePaid = wmulUp(quotation.entryNotional, r2w(BigInt(param.protocolFeeRatio)));
        const baseFeePaid = wmulUp(quotation.entryNotional, r2w(BigInt(param.tradingFeeRatio)));

        let stabilityFee = feePaid - protocolFeePaid - baseFeePaid;
        if (stabilityFee < 0n) stabilityFee = ZERO;
        return stabilityFee;
    }

    getStabilityFeeRatio(quotation: Quotation, param: QuoteParam, maintenanceMarginRatio: number): number {
        // maintenanceMarginRatio is no more needed
        void maintenanceMarginRatio;
        const stabilityFee = SqrtPriceMath.getStabilityFee(quotation, param);
        const ratioTemp = wdiv(stabilityFee, quotation.entryNotional);
        const scaler = BigInt(10) ** 14n;
        const ratio = (ratioTemp + (scaler - 1n)) / scaler;
        return Number(ratio);
    }
}
