import { CallOverrides } from 'ethers';
import {
    SimulateCrossMarketOrderParams,
    SimulateCrossMarketOrderResult,
    SimulateLimitOrderParams,
    SimulateLimitOrderResult,
    SimulateScaledLimitOrderParams,
    SimulateScaledLimitOrderResult,
    SimulateMarketOrderByMarginParams,
    SimulateTradeResult,
    SimulateMarketOrderByLeverageParams,
    SimulateCloseParams,
    SimulateAdjustMarginByMarginParams,
    SimulateAdjustMarginByMarginResult,
    SimulateAdjustMarginByLeverageParams,
    SimulateAdjustMarginByLeverageResult,
    SimulateAddLiquidityParams,
    SimulateAddLiquidityResult,
    SimulateAddLiquidityWithAsymmetricRangeParams,
    SimulateAddLiquidityWithAsymmetricRangeResult,
    SimulateRemoveLiquidityParams,
    SimulateRemoveLiquidityResult,
} from '../../types';
import {
    isPortfolio,
    isPosition,
    reverseSide,
    reversePrice,
    isInstrument,
    reversePosition,
    reverseInstrument,
    reversePortfolio,
    reversePriceInfo,
} from '../../utils';
import { SimulateModule } from '../simulate.module';

function reverseSimulateTradeResult(result: SimulateTradeResult): SimulateTradeResult {
    return {
        ...result,
        tradePrice: reversePrice(result.tradePrice),
        postPosition: reversePosition(result.postPosition),
        priceImpact: result.priceImpact.mul(-1),
    };
}

export class InverseSimulateModule extends SimulateModule {
    async simulateCrossMarketOrder(
        param: SimulateCrossMarketOrderParams,
        overrides?: CallOverrides,
    ): Promise<SimulateCrossMarketOrderResult> {
        const isInverse =
            param.isInverse ?? (await this.context.perp.configuration.isInverse(param.tradeInfo.instrumentAddr));

        const result = await super.simulateCrossMarketOrder(
            isInverse
                ? {
                      ...param,
                      tradeInfo: isPosition(param.tradeInfo) ? reversePosition(param.tradeInfo) : param.tradeInfo,
                      priceInfo: reversePriceInfo(param.priceInfo),
                      side: reverseSide(param.side),
                      instrument: param.instrument && reverseInstrument(param.instrument),
                  }
                : param,
            overrides,
        );

        return isInverse
            ? {
                  ...result,
                  tradeSimulation: reverseSimulateTradeResult(result.tradeSimulation),
              }
            : result;
    }

    async simulateLimitOrder(
        param: SimulateLimitOrderParams,
        overrides?: CallOverrides,
    ): Promise<SimulateLimitOrderResult> {
        const isInverse =
            param.isInverse ?? (await this.context.perp.configuration.isInverse(param.tradeInfo.instrumentAddr));

        return await super.simulateLimitOrder(
            isInverse
                ? {
                      ...param,
                      priceInfo: reversePriceInfo(param.priceInfo),
                      side: reverseSide(param.side),
                      instrument: param.instrument && reverseInstrument(param.instrument),
                  }
                : param,
            overrides,
        );
    }

    async simulateScaledLimitOrder(
        param: SimulateScaledLimitOrderParams,
        overrides?: CallOverrides,
    ): Promise<SimulateScaledLimitOrderResult> {
        const isInverse =
            param.isInverse ?? (await this.context.perp.configuration.isInverse(param.tradeInfo.instrumentAddr));

        let result = await super.simulateScaledLimitOrder(
            isInverse
                ? {
                      ...param,
                      priceInfo: param.priceInfo.map((p) => (typeof p === 'number' ? p : reversePrice(p))),
                      side: reverseSide(param.side),
                      instrument: param.instrument && reverseInstrument(param.instrument),
                  }
                : param,
            overrides,
        );

        if (isInverse) {
            result = {
                ...result,
                orders: result.orders.map((o) => {
                    return (
                        o && {
                            ...o,
                            limitPrice: reversePrice(o.limitPrice),
                        }
                    );
                }),
            };
        }

        return result;
    }

    async simulateMarketOrderByMargin(
        param: SimulateMarketOrderByMarginParams,
        overrides?: CallOverrides,
    ): Promise<SimulateTradeResult> {
        const isInverse =
            param.isInverse ?? (await this.context.perp.configuration.isInverse(param.tradeInfo.instrumentAddr));

        const result = await super.simulateMarketOrderByMargin(
            isInverse
                ? {
                      ...param,
                      tradeInfo: isPosition(param.tradeInfo) ? reversePosition(param.tradeInfo) : param.tradeInfo,
                      side: reverseSide(param.side),
                      instrument: param.instrument && reverseInstrument(param.instrument),
                  }
                : param,
            overrides,
        );

        return isInverse ? reverseSimulateTradeResult(result) : result;
    }

    async simulateMarketOrderByLeverage(
        param: SimulateMarketOrderByLeverageParams,
        overrides?: CallOverrides,
    ): Promise<SimulateTradeResult> {
        const isInverse =
            param.isInverse ?? (await this.context.perp.configuration.isInverse(param.tradeInfo.instrumentAddr));

        const result = await super.simulateMarketOrderByLeverage(
            isInverse
                ? {
                      ...param,
                      tradeInfo: isPosition(param.tradeInfo) ? reversePosition(param.tradeInfo) : param.tradeInfo,
                      side: reverseSide(param.side),
                      instrument: param.instrument && reverseInstrument(param.instrument),
                  }
                : param,
            overrides,
        );

        return isInverse ? reverseSimulateTradeResult(result) : result;
    }

    async simulateClose(param: SimulateCloseParams, overrides?: CallOverrides): Promise<SimulateTradeResult> {
        const isInverse =
            param.isInverse ?? (await this.context.perp.configuration.isInverse(param.tradeInfo.instrumentAddr));

        const result = await super.simulateClose(
            isInverse
                ? {
                      ...param,
                      tradeInfo: isPosition(param.tradeInfo) ? reversePosition(param.tradeInfo) : param.tradeInfo,
                      instrument: param.instrument && reverseInstrument(param.instrument),
                  }
                : param,
            overrides,
        );

        return isInverse ? reverseSimulateTradeResult(result) : result;
    }

    async simulateAdjustMarginByMargin(
        param: SimulateAdjustMarginByMarginParams,
        overrides?: CallOverrides,
    ): Promise<SimulateAdjustMarginByMarginResult> {
        const isInverse =
            param.isInverse ?? (await this.context.perp.configuration.isInverse(param.tradeInfo.instrumentAddr));

        const result = await super.simulateAdjustMarginByMargin(
            isInverse
                ? {
                      ...param,
                      tradeInfo: isPosition(param.tradeInfo) ? reversePosition(param.tradeInfo) : param.tradeInfo,
                      instrument: param.instrument && reverseInstrument(param.instrument),
                  }
                : param,
            overrides,
        );

        return isInverse ? { ...result, postPosition: reversePosition(result.postPosition) } : result;
    }

    async simulateAdjustMarginByLeverage(
        param: SimulateAdjustMarginByLeverageParams,
        overrides?: CallOverrides,
    ): Promise<SimulateAdjustMarginByLeverageResult> {
        const isInverse =
            param.isInverse ?? (await this.context.perp.configuration.isInverse(param.tradeInfo.instrumentAddr));

        const result = await super.simulateAdjustMarginByLeverage(
            isInverse
                ? {
                      ...param,
                      tradeInfo: isPosition(param.tradeInfo) ? reversePosition(param.tradeInfo) : param.tradeInfo,
                      instrument: param.instrument && reverseInstrument(param.instrument),
                  }
                : param,
            overrides,
        );

        return isInverse ? { ...result, postPosition: reversePosition(result.postPosition) } : result;
    }

    async simulateAddLiquidity(
        param: SimulateAddLiquidityParams,
        overrides?: CallOverrides,
    ): Promise<SimulateAddLiquidityResult> {
        const isInverse =
            param.isInverse !== undefined
                ? param.isInverse
                : isInstrument(param.instrument)
                  ? await this.context.perp.configuration.isInverse(param.instrument.instrumentAddr)
                  : await this.context.perp.configuration.isInverseByIdentifier(param.instrument);

        const result = await super.simulateAddLiquidity(
            isInverse
                ? {
                      ...param,
                      instrument: isInstrument(param.instrument)
                          ? reverseInstrument(param.instrument)
                          : param.instrument,
                  }
                : param,
            overrides,
        );

        return isInverse
            ? {
                  ...result,
                  upperPrice: reversePrice(result.lowerPrice),
                  lowerPrice: reversePrice(result.upperPrice),
                  lowerPosition: reversePosition(result.upperPosition),
                  lowerLeverage: result.upperLeverage,
                  upperPosition: reversePosition(result.lowerPosition),
                  upperLeverage: result.lowerLeverage,
              }
            : result;
    }

    async simulateAddLiquidityWithAsymmetricRange(
        param: SimulateAddLiquidityWithAsymmetricRangeParams,
        overrides?: CallOverrides,
    ): Promise<SimulateAddLiquidityWithAsymmetricRangeResult> {
        const isInverse =
            param.isInverse !== undefined
                ? param.isInverse
                : isInstrument(param.instrument)
                  ? await this.context.perp.configuration.isInverse(param.instrument.instrumentAddr)
                  : await this.context.perp.configuration.isInverseByIdentifier(param.instrument);

        const result = await super.simulateAddLiquidityWithAsymmetricRange(
            isInverse
                ? {
                      ...param,
                      alphaWadLower: param.alphaWadUpper,
                      alphaWadUpper: param.alphaWadLower,
                      instrument: isInstrument(param.instrument)
                          ? reverseInstrument(param.instrument)
                          : param.instrument,
                  }
                : param,
            overrides,
        );

        return isInverse
            ? {
                  ...result,
                  tickDeltaLower: result.tickDeltaUpper,
                  tickDeltaUpper: result.tickDeltaLower,
                  upperPrice: reversePrice(result.lowerPrice),
                  lowerPrice: reversePrice(result.upperPrice),
                  lowerPosition: reversePosition(result.upperPosition),
                  lowerLeverage: result.upperLeverage,
                  upperPosition: reversePosition(result.lowerPosition),
                  upperLeverage: result.lowerLeverage,
                  equivalentAlphaLower: result.equivalentAlphaUpper,
                  equivalentAlphaUpper: result.equivalentAlphaLower,
              }
            : result;
    }

    async simulateRemoveLiquidity(
        param: SimulateRemoveLiquidityParams,
        overrides?: CallOverrides,
    ): Promise<SimulateRemoveLiquidityResult> {
        const isInverse =
            param.isInverse ?? (await this.context.perp.configuration.isInverse(param.tradeInfo.instrumentAddr));

        const result = await super.simulateRemoveLiquidity(
            isInverse
                ? {
                      ...param,
                      tradeInfo: isPortfolio(param.tradeInfo) ? reversePortfolio(param.tradeInfo) : param.tradeInfo,
                      tickUpper: param.tickLower,
                      tickLower: param.tickUpper,
                      instrument: param.instrument && reverseInstrument(param.instrument),
                  }
                : param,
            overrides,
        );

        return isInverse
            ? {
                  ...result,
                  removedPosition: reversePosition(result.removedPosition),
                  postPosition: reversePosition(result.postPosition),
                  removedPositionEntryPrice: reversePrice(result.removedPositionEntryPrice),
              }
            : result;
    }
}
