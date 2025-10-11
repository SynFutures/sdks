// Removed bigint import, using native bigint
import { RawAmm, Pearl } from '../types';
import { ZERO } from './constants';
import { SqrtPriceMath } from './sqrtPriceMath';
import { TickMath } from './tickMath';
import { neg } from './basic';

export interface SwapImpact {
    sqrtPostPX96: bigint;
    dx: bigint;
    dy: bigint;
}

export abstract class SwapMath {
    public static swapWithinRange(
        sqrtCurrentPX96: bigint,
        sqrtTargetPX96: bigint,
        liquidity: bigint,
        sizeLeft: bigint,
    ): SwapImpact {
        const long = sizeLeft > ZERO;
        const dxMax = SqrtPriceMath.getDeltaBaseAutoRoundUp(sqrtTargetPX96, sqrtCurrentPX96, liquidity);
        let dxAbs: bigint = sizeLeft < 0n ? -sizeLeft : sizeLeft;
        let sqrtPostPX96;
        if (dxAbs >= dxMax) {
            // if sizeLeft is adequate
            dxAbs = dxMax;
            sqrtPostPX96 = sqrtTargetPX96;
        } else {
            // else sizeLeft is completely consumed
            sqrtPostPX96 = SqrtPriceMath.getNextSqrtPriceFromDeltaBase(sqrtCurrentPX96, liquidity, dxAbs, long);
        }

        const dy = SqrtPriceMath.getDeltaQuote(sqrtPostPX96, sqrtCurrentPX96, liquidity, long);
        const dx: bigint = long ? dxAbs : dxAbs * -1n;
        return { sqrtPostPX96, dx, dy };
    }

    public static swapCrossRange(
        pair: {
            amm: RawAmm;
            tbitmap: Map<number, bigint>;
            getPearl(tick: number): Pearl;
        },
        size: bigint,
    ): { liquidity: bigint; ticks: number[]; takens: bigint[] } {
        const amm = pair.amm;
        const ticks = [];
        const takens = [];
        const long: boolean = size > ZERO;

        // update order at pearls
        let totalOrderValue = ZERO;
        let totalCurveValue = ZERO;
        let swapSize = size;
        const currTickLeft = pair.getPearl(amm.tick).left;
        if (swapSize !== 0n && long && currTickLeft < 0n) {
            const swapSizeAbs = swapSize < 0n ? -swapSize : swapSize;
            const currTickLeftAbs = currTickLeft < 0n ? -currTickLeft : currTickLeft;
            const taken = swapSizeAbs >= currTickLeftAbs ? currTickLeft : swapSize * -1n;
            ticks.push(amm.tick);
            takens.push(taken);
            const takenValue = TickMath.calcTakenNotional(amm.tick, taken);
            swapSize = swapSize + taken;
            totalOrderValue = totalOrderValue + takenValue;
            if (swapSize === 0n) {
                return { liquidity: amm.liquidity, ticks, takens };
            }
        }

        let targetTick = TickMath.nextInitializedTick(pair.tbitmap, long ? amm.tick : amm.tick + 1, long);
        let sqrtPX96State = amm.sqrtPX96;
        let liquidityState = amm.liquidity;

        while (true) {
            const targetPX96 = TickMath.getSqrtRatioAtTick(targetTick);

            const { sqrtPostPX96, dx, dy } = SwapMath.swapWithinRange(
                sqrtPX96State,
                targetPX96,
                liquidityState,
                swapSize,
            );
            sqrtPX96State = sqrtPostPX96;
            swapSize = swapSize - dx;
            totalCurveValue = totalCurveValue + dy;

            if (sqrtPostPX96 == targetPX96) {
                const left = pair.getPearl(targetTick)!.left;
                if (swapSize !== 0n && ((long && left < 0n) || (!long && left > 0n))) {
                    const swapSizeAbs = swapSize < 0n ? -swapSize : swapSize;
                    const leftAbs = left < 0n ? -left : left;
                    const taken = swapSizeAbs >= leftAbs ? left : swapSize * -1n;
                    ticks.push(targetTick);
                    takens.push(taken);
                    const takenValue = TickMath.calcTakenNotional(targetTick, taken);
                    swapSize = swapSize + taken;
                    totalOrderValue = totalOrderValue + takenValue;
                }
                const isRangeEnd = pair.getPearl(targetTick)!.liquidityGross > 0n;
                const lastLiquidity = liquidityState;
                if (isRangeEnd) {
                    let liqNet = pair.getPearl(targetTick).liquidityNet;
                    if (!long) liqNet = neg(liqNet);
                    liquidityState = liquidityState + liqNet;
                }
                if (swapSize === ZERO) {
                    if (!long) {
                        liquidityState = lastLiquidity;
                    }
                    break;
                }
                targetTick = TickMath.nextInitializedTick(pair.tbitmap, targetTick, long);
            } else {
                break;
            }
        }
        return { liquidity: liquidityState, ticks, takens };
    }
}
