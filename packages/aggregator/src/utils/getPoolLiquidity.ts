import { ConfigClientInterface } from '../clients/config';
import { PoolCurve, PoolType } from '../types/contract';
import { fromWei, toWei } from './utils';

export async function fitPoolCurves(
    config: ConfigClientInterface,
    pool: string,
    poolType: PoolType,
    token0Balance: bigint,
    token1Balance: bigint,
    token0Decimal: number,
    token1Decimal: number,
    ratio = 0.5,
    steps = 50,
    batchSize = 10,
    blockTag?: number,
): Promise<{ sellCurves: PoolCurve[]; buyCurves: PoolCurve[] }> {
    // Convert BigInt balances to numbers and calculate max amounts
    const token0Bal = fromWei(token0Balance, token0Decimal);
    const token1Bal = fromWei(token1Balance, token1Decimal);

    // Calculate max amounts for both directions (2% of balance)
    const maxToken0In = token0Bal * ratio;
    const maxToken1In = token1Bal * ratio;

    const token0Step = maxToken0In / steps;
    const token1Step = maxToken1In / steps;

    // Prepare arrays of input amounts starting with 0.01% of balance
    let token0Inputs: bigint[] = [toWei(token0Bal * 0.0001, token0Decimal)].concat(
        Array.from({ length: steps }, (_, i) => toWei(token0Step * (i + 1), token0Decimal)),
    );

    let token1Inputs: bigint[] = [toWei(token1Bal * 0.0001, token1Decimal)].concat(
        Array.from({ length: steps }, (_, i) => toWei(token1Step * (i + 1), token1Decimal)),
    );

    // Split inputs into batches and get amounts out for both directions
    let sellAmountsOut: bigint[] = [];
    let buyAmountsOut: bigint[] = [];

    // Process sell amounts in batches
    for (let i = 0; i < token0Inputs.length; i += batchSize) {
        const batchInputs = token0Inputs.slice(i, i + batchSize);
        const batchResults = await config.getAmountsOut(
            pool,
            poolType,
            true,
            batchInputs,
            blockTag,
        );
        sellAmountsOut = sellAmountsOut.concat(batchResults);
    }

    // Process buy amounts in batches
    for (let i = 0; i < token1Inputs.length; i += batchSize) {
        const batchInputs = token1Inputs.slice(i, i + batchSize);
        const batchResults = await config.getAmountsOut(
            pool,
            poolType,
            false,
            batchInputs,
            blockTag,
        );
        buyAmountsOut = buyAmountsOut.concat(batchResults);
    }

    // filter token0Inputs and sellAmountsOut, liquidity used out
    let cutoffIndex0 = token0Inputs.length;
    for (let i = 1; i < token0Inputs.length; i++) {
        if (sellAmountsOut[i] === sellAmountsOut[i - 1]) {
            cutoffIndex0 = i;
            break;
        }
    }
    token0Inputs = token0Inputs.slice(0, cutoffIndex0);
    sellAmountsOut = sellAmountsOut.slice(0, cutoffIndex0);

    // filter token1Inputs and buyAmountsOut, liquidity used out
    let cutoffIndex1 = token1Inputs.length;
    for (let i = 1; i < token1Inputs.length; i++) {
        if (buyAmountsOut[i] === buyAmountsOut[i - 1]) {
            cutoffIndex1 = i;
            break;
        }
    }
    token1Inputs = token1Inputs.slice(0, cutoffIndex1);
    buyAmountsOut = buyAmountsOut.slice(0, cutoffIndex1);

    // Ensure arrays remain aligned
    const minLength = Math.min(token0Inputs.length, sellAmountsOut.length);
    token0Inputs = token0Inputs.slice(0, minLength);
    sellAmountsOut = sellAmountsOut.slice(0, minLength);

    const minLengthBuy = Math.min(token1Inputs.length, buyAmountsOut.length);
    token1Inputs = token1Inputs.slice(0, minLengthBuy);
    buyAmountsOut = buyAmountsOut.slice(0, minLengthBuy);

    // Process points with decimal correction and mid price points
    const sellPoints = token0Inputs
        .map((amountInWei, i) => {
            const amountIn = fromWei(amountInWei, token0Decimal);
            const amountOut = fromWei(sellAmountsOut[i], token1Decimal);
            const price = amountOut / amountIn;
            return [price, amountOut];
        })
        .filter((point, i, arr) => {
            if (i === 0) return true;
            return point[0] < arr[i - 1][0] && point[1] > arr[i - 1][1];
        });

    const buyPoints = token1Inputs
        .map((amountInWei, i) => {
            const amountIn = fromWei(amountInWei, token1Decimal);
            const amountOut = fromWei(buyAmountsOut[i], token0Decimal);
            const price = amountIn / amountOut;
            return [price, amountOut];
        })
        .filter((point, i, arr) => {
            if (i === 0) return true;
            return point[0] > arr[i - 1][0] && point[1] > arr[i - 1][1];
        });

    // Convert to price-amount format for spline calculation
    const sellPricePoints = sellPoints.map((p) => [p[0], p[1]]);
    const buyPricePoints = buyPoints.map((p) => [p[0], p[1]]);

    // Fit curves
    const sellCurves = calculateSplineParams(sellPricePoints);
    const buyCurves = calculateSplineParams(buyPricePoints);

    return {
        sellCurves,
        buyCurves,
    };
}

function calculateSplineParams(points: number[][]): PoolCurve[] {
    const x = points.map((p) => p[0]);
    const a = points.map((p) => p[1]);
    const n = x.length - 1;

    // Initialize arrays
    const h = new Array(n);
    const A = new Array(n);
    const l = new Array(n + 1);
    const u = new Array(n);
    const z = new Array(n + 1);
    const c = new Array(n + 1);
    const b = new Array(n);
    const d = new Array(n);

    // Step 1: Calculate h
    for (let i = 0; i < n; i++) {
        h[i] = x[i + 1] - x[i];
    }

    // Step 2: Calculate A
    for (let i = 1; i < n; i++) {
        A[i] = (3 * (a[i + 1] - a[i])) / h[i] - (3 * (a[i] - a[i - 1])) / h[i - 1];
    }

    // Step 3-4: Calculate l, u, z
    l[0] = 1;
    u[0] = 0;
    z[0] = 0;

    for (let i = 1; i < n; i++) {
        l[i] = 2 * (x[i + 1] - x[i - 1]) - h[i - 1] * u[i - 1];
        u[i] = h[i] / l[i];
        z[i] = (A[i] - h[i - 1] * z[i - 1]) / l[i];
    }

    // Step 5: Initialize end conditions
    l[n] = 1;
    z[n] = 0;
    c[n] = 0;

    // Step 6: Back substitution
    for (let j = n - 1; j >= 0; j--) {
        c[j] = z[j] - u[j] * c[j + 1];
        b[j] = (a[j + 1] - a[j]) / h[j] - (h[j] * (c[j + 1] + 2 * c[j])) / 3;
        d[j] = (c[j + 1] - c[j]) / (3 * h[j]);
    }

    return points.slice(0, -1).map((_, i) => ({
        range: {
            min: x[i],
            max: x[i + 1],
        },
        coefficients: [a[i], b[i], c[i], d[i]], // [a, b, c, d] for cubic spline
    }));
}

export function analyzePoolLiquidity(
    pools: string[],
    allPoolCurves: { sellCurves: PoolCurve[]; buyCurves: PoolCurve[] }[],
    testPrices: number[],
    isBuy: boolean,
): { price: number; poolAmounts: { pool: string; amount0: number; amount1: number }[] }[] {
    // Get amounts for all test prices
    const results = testPrices.map((price) => {
        const poolAmounts = pools.map((pool) => {
            if (isBuy) {
                const curves = allPoolCurves[pools.indexOf(pool)].buyCurves;
                // find highest price
                const maxPriceCurve = curves.reduce(
                    (max, curve) => (curve.range.max > (max?.range.max || -Infinity) ? curve : max),
                    curves[0],
                );

                for (const curve of curves) {
                    const amount0 = getAmountOutFromPrice(price, curve);
                    if (amount0 !== null) {
                        const amount1 = amount0 * price;
                        return { pool, amount0, amount1 };
                    }
                }

                // if price > maxPrice, use maxPrice -> amountOut
                if (price > maxPriceCurve.range.max) {
                    const amount0 = getAmountOutFromPrice(maxPriceCurve.range.max, maxPriceCurve);
                    if (amount0 !== null) {
                        const amount1 = amount0 * maxPriceCurve.range.max;
                        return { pool, amount0, amount1 };
                    }
                }
            } else {
                const curves = allPoolCurves[pools.indexOf(pool)].sellCurves;
                // find lowest price curve
                const minPriceCurve = curves.reduce(
                    (min, curve) => (curve.range.min < (min?.range.min || Infinity) ? curve : min),
                    curves[0],
                );

                for (const curve of curves) {
                    const amount1 = getAmountOutFromPrice(price, curve);
                    if (amount1 !== null) {
                        const amount0 = amount1 / price;
                        return { pool, amount0, amount1 };
                    }
                }

                // if price < minPrice, use minPrice -> amountOut
                if (price < minPriceCurve.range.min) {
                    const amount1 = getAmountOutFromPrice(minPriceCurve.range.min, minPriceCurve);
                    if (amount1 !== null) {
                        const amount0 = amount1 / minPriceCurve.range.min;
                        return { pool, amount0, amount1 };
                    }
                }
            }
            return { pool, amount0: 0, amount1: 0 };
        });

        return {
            price,
            poolAmounts,
        };
    });

    return results;
}

function getAmountOutFromPrice(price: number, curve: PoolCurve) {
    const [a, b, c, d] = curve.coefficients;
    const lower = Math.min(curve.range.min, curve.range.max);
    const upper = Math.max(curve.range.min, curve.range.max);

    // Use the correct reference point for dx calculation
    const x0 = curve.range.min;
    const dx = price - x0;

    // Calculate using cubic spline formula: a + b*dx + c*dx^2 + d*dx^3
    const amountOut = a + b * dx + c * dx * dx + d * dx * dx * dx;

    // Check if the price is within the valid range
    if (price >= lower && price <= upper) {
        return amountOut;
    }

    return null;
}

// ... existing code ...

export function adjustLiquidityResults(
    results: {
        price: number;
        poolAmounts: {
            pool: string;
            amount0: number;
            amount1: number;
        }[];
    }[],
    isBuy: boolean,
): {
    price: number;
    poolAmounts: {
        pool: string;
        amount0: number;
        amount1: number;
    }[];
}[] {
    // Sort by price: ascending for buy, descending for sell
    const sortedResults = [...results].sort((a, b) => (isBuy ? a.price - b.price : b.price - a.price));

    // Track data for each pool separately
    const poolMap = new Map<
        string,
        {
            maxAmount: number;
            lastValidIndex: number;
        }
    >();

    // Initialize tracking data for each pool
    sortedResults[0].poolAmounts.forEach(({ pool }) => {
        poolMap.set(pool, {
            maxAmount: isBuy
                ? sortedResults[0].poolAmounts.find((p) => p.pool === pool)?.amount0 || 0
                : sortedResults[0].poolAmounts.find((p) => p.pool === pool)?.amount1 || 0,
            lastValidIndex: 0,
        });
    });

    // Find the last increasing point for each pool
    for (let i = 1; i < sortedResults.length; i++) {
        sortedResults[i].poolAmounts.forEach(({ pool, amount0, amount1 }) => {
            const poolData = poolMap.get(pool);
            if (!poolData) return;

            const currentAmount = isBuy ? amount0 : amount1;
            if (currentAmount > poolData.maxAmount) {
                poolData.maxAmount = currentAmount;
                poolData.lastValidIndex = i;
            }
        });
    }

    // Adjust values after non-increasing points
    poolMap.forEach((poolData, pool) => {
        for (let i = poolData.lastValidIndex + 1; i < sortedResults.length; i++) {
            const poolAmount = sortedResults[i].poolAmounts.find((p) => p.pool === pool);
            if (poolAmount) {
                if (isBuy) {
                    poolAmount.amount0 = poolData.maxAmount;
                } else {
                    poolAmount.amount1 = poolData.maxAmount;
                }
            }
        }
    });

    return sortedResults;
}