import { parseUnits } from 'viem';
import { PoolType, SwapType, getDexFlag, AggregatorModule, calculateSwapSlippage } from '../src';
import { ChainKitRegistry, type Erc20TokenInfo } from '@derivation-tech/viem-kit';
import * as dotenv from 'dotenv';
dotenv.config();

describe('Aggregator-Monad', function () {
    let aggregator: AggregatorModule;
    let chainKit: ReturnType<typeof ChainKitRegistry['for']>;
    const ZERO_BI = 0n;
    const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';
    const token0: Erc20TokenInfo = {
        name: 'WMON',
        address: '0x760AfE86e5de5fa0Ee542fc7B7B713e1c5425701',
        symbol: 'WMON',
        decimals: 18,
    };
    const token1: Erc20TokenInfo = {
        name: 'USDC',
        address: '0xf817257fed379853cDe0fa4F97AB987181B1E5Ea',
        symbol: 'USDT',
        decimals: 6,
    };
    const ETH_TOKEN: Erc20TokenInfo = {
        name: 'ETH',
        address: ZERO_ADDRESS,
        symbol: 'ETH',
        decimals: 18,
    };

    beforeEach(async function () {
        chainKit = ChainKitRegistry.for('monadTestnet');
        aggregator = new AggregatorModule({
            chainId: chainKit.chain.id,
            rpcUrl: process.env.MONAD_RPC!,
        });
        await aggregator.init();
    });

    it('should init succeed', async function () {
        const middleTokens = await aggregator.config.getMiddleTokens();

        expect(middleTokens.length > 0);
    });

    it('should get dex flag succeed', async function () {
        const dexFlag = getDexFlag([PoolType.OYSTER]);
        expect(dexFlag).toBe(BigInt(1 << PoolType.OYSTER));
    });

    it('should get pool list succeed 1', async function () {
        const usdc = token0;
        const weth = token1;
        const result = await aggregator.getPoolList(usdc.address, weth.address);
        expect(result.length).toBeGreaterThan(0);
        for (const pool of result) {
            expect(pool.token0).toBe(usdc.address);
            expect(pool.token1).toBe(weth.address);
            expect(pool.fee > ZERO_BI).toBe(true);
            expect(Object.values(PoolType).includes(pool.poolType)).toBe(true);
            expect(pool.poolAddr).toBeDefined();
            expect(Object.values(SwapType).includes(pool.swapType)).toBe(true);
        }
    });

    it('should not get pool list', async function () {
        const aixbtAddress = '0x4F9Fd6Be4a90f2620860d680c0d4d5Fb53d1A825';
        const cbbtcAddress = '0xcbB7C0000aB88B473b1f5aFd9ef808440eed33Bf';
        const result = await aggregator.getPoolList(aixbtAddress, cbbtcAddress);
        expect(result.length).toBe(0);
    });

    it('should simulate mix swap succeed', async function () {
        const weth = token1;
        const usdc = token0;
        const fromAmount = parseUnits('0.0015', usdc.decimals);
        const routeResult = await aggregator.querySingleRoute({
            fromToken: usdc,
            toToken: weth,
            fromAmount,
            excludePoolTypes: [PoolType.OYSTER],
        });

        const metrics = calculateSwapSlippage({
            inputAmount: fromAmount,
            actualAmountOut: routeResult.bestAmount,
            fromTokenDecimals: usdc.decimals,
            toTokenDecimals: weth.decimals,
            midPrice: routeResult.midPrice,
            slippageInBps: 100,
        });

        expect(metrics.priceImpact).toBeGreaterThan(-1);
        expect(metrics.minReceivedAmount > ZERO_BI).toBe(true);
        console.log('out amount:', metrics.minReceivedAmount.toString());
        console.log('path:', routeResult.bestPoolPath.map((pool) => pool.poolType));
        expect(routeResult.bestPoolPath.length).toBeGreaterThan(0);
    });

    it('should query single route succeed', async function () {
        const weth = token0;
        const usdc = token1;
        const result = await aggregator.querySingleRoute({
            fromToken: usdc,
            toToken: weth,
            fromAmount: parseUnits('0.001', usdc.decimals),
            excludePoolTypes: [],
        });

        expect(result.bestAmount > ZERO_BI).toBe(true);
        expect(result.bestPoolPath.length > 0).toBe(true);
        expect(result.bestPath.length > 0).toBe(true);

        expect(result.bestPath[0]).toBe(usdc.address);
        expect(result.bestPath[result.bestPath.length - 1]).toBe(weth.address);
    });

    it('should simulate multi swap succeed, mon-usdt', async function () {
        const weth = token0;
        const usdc = token1;
        const fromAmount = parseUnits('0.01', weth.decimals);
        const routeResult = await aggregator.querySplitRoute({
            fromToken: ETH_TOKEN,
            toToken: usdc,
            fromAmount,
            excludePoolTypes: [],
            isDirect: false,
        });

        const metrics = calculateSwapSlippage({
            inputAmount: fromAmount,
            actualAmountOut: routeResult.bestAmount,
            fromTokenDecimals: ETH_TOKEN.decimals,
            toTokenDecimals: usdc.decimals,
            midPrice: routeResult.midPrice,
            slippageInBps: 100,
        });

        expect(metrics.priceImpact).toBeGreaterThan(-1);
        expect(metrics.minReceivedAmount > ZERO_BI).toBe(true);
        for (const hop of routeResult.bestPathInfo.oneHops) {
            for (const route of hop.pools) {
                expect(route.poolAddr).toBeDefined();
                expect(Object.values(PoolType).includes(route.poolType)).toBe(true);
                expect(route.fee >= ZERO_BI).toBe(true);
            }
            for (const weight of hop.weights) {
                expect(weight > ZERO_BI).toBe(true);
            }
        }
    });

    it('should simulate multi swap succeed, usdt - mon', async function () {
        const weth = token0;
        const usdc = token1;
        const fromAmount = parseUnits('0.01', usdc.decimals);
        const routeResult = await aggregator.querySplitRoute({
            fromToken: usdc,
            toToken: weth,
            fromAmount,
            excludePoolTypes: [],
            isDirect: false,
        });

        const metrics = calculateSwapSlippage({
            inputAmount: fromAmount,
            actualAmountOut: routeResult.bestAmount,
            fromTokenDecimals: usdc.decimals,
            toTokenDecimals: weth.decimals,
            midPrice: routeResult.midPrice,
            slippageInBps: 100,
        });

        expect(metrics.priceImpact).toBeGreaterThan(-1);
        expect(metrics.minReceivedAmount > ZERO_BI).toBe(true);
        expect(routeResult.bestPathInfo.oneHops.length).toBeGreaterThan(0);
        for (const hop of routeResult.bestPathInfo.oneHops) {
            for (const route of hop.pools) {
                expect(route.poolAddr).toBeDefined();
                expect(Object.values(PoolType).includes(route.poolType)).toBe(true);
                expect(route.fee >= ZERO_BI).toBe(true);
            }
            for (const weight of hop.weights) {
                expect(weight > ZERO_BI).toBe(true);
            }
        }
    });

    // it('should convert between ETH and WETH succeed', async function () {
    //     const weth = {
    //         name: 'WMON',
    //         address: '0x760AfE86e5de5fa0Ee542fc7B7B713e1c5425701',
    //         symbol: 'WMON',
    //         decimals: 18,
    //     };
    //     const ETH_ADDRESS = '0x0000000000000000000000000000000000000000';
    //     const testAmount = parseUnits('1', 18); // 1 ETH/WETH

    //     // Test ETH -> WETH (deposit)
    //     const depositTx = await aggregator.wethConvert({
    //         fromTokenAddress: ETH_ADDRESS,
    //         toTokenAddress: weth.address,
    //         amount: testAmount,
    //     });

    //     expect(depositTx).toBeDefined();
    //     expect(depositTx.to).toBe(weth.address);
    //     expect(depositTx.value).toEqual(testAmount);
    //     expect(depositTx.data).toBeDefined();

    //     // Test WETH -> ETH (withdraw)
    //     const withdrawTx = await aggregator.wethConvert({
    //         fromTokenAddress: weth.address,
    //         toTokenAddress: ETH_ADDRESS,
    //         amount: testAmount,
    //     });

    //     expect(withdrawTx).toBeDefined();
    //     expect(withdrawTx.to).toBe(weth.address);
    //     expect(withdrawTx.value).toBeUndefined();
    //     expect(withdrawTx.data).toBeDefined();

    //     // Test invalid conversion (WETH -> WETH)
    //     await expect(
    //         aggregator.wethConvert({
    //             fromTokenAddress: weth.address,
    //             toTokenAddress: weth.address,
    //             amount: testAmount,
    //         }),
    //     ).rejects.toThrow('At least one token must be ETH for WETH conversion');

    //     // Test invalid conversion (ETH -> ETH)
    //     await expect(
    //         aggregator.wethConvert({
    //             fromTokenAddress: ETH_ADDRESS,
    //             toTokenAddress: ETH_ADDRESS,
    //             amount: testAmount,
    //         }),
    //     ).rejects.toThrow('At least one token must be ETH for WETH conversion');
    // });

    it('should get pool liquidity succeed', async function () {
        const pools = await aggregator.getPoolList(token0.address, token1.address);
        const priceMultipliers = [
            0.996, 0.9965, 0.997, 0.9975, 0.998, 0.9985, 0.999, 0.9995, 1.0005, 1.001, 1.0015, 1.002, 1.0025, 1.003,
            1.0035, 1.004,
        ];
        //console.log("pools:", JSON.stringify(pools,null, 2));
        const results = await aggregator.getPoolLiquidity({
            pools,
            token0,
            token1,
            priceMultipliers,
            ratio: 0.4,
            steps: 16,
            batchSize: 2,
        });

        expect(results.midPrice).toBeGreaterThan(0);
        expect(results.buyLiquidityResults.length).toBe(8);
        for (const result of results.buyLiquidityResults) {
            //console.log(JSON.stringify(result, null, 2));
            //console.log('result.price', result.price, 'result.poolAmounts', result.poolAmounts.length);
            expect(result.price).toBeGreaterThan(0);
            expect(result.poolAmounts.length).toBe(pools.length);
            for (const poolAmount of result.poolAmounts) {
                //expect(poolAmount.amount0).toBeGreaterThanOrEqual(0);
                //expect(poolAmount.amount1).toBeGreaterThanOrEqual(0);
                console.log(
                    'pool',
                    poolAmount.pool,
                    'poolAmount.amount0',
                    poolAmount.amount0,
                    'poolAmount.amount1',
                    poolAmount.amount1,
                );
            }
        }
        expect(results.sellLiquidityResults.length).toBe(8);
        for (const result of results.sellLiquidityResults) {
            //console.log(JSON.stringify(result, null, 2));
            // console.log('result.price', result.price, 'result.poolAmounts', result.poolAmounts.length);
            expect(result.price).toBeGreaterThan(0);
            expect(result.poolAmounts.length).toBe(pools.length);
            for (const poolAmount of result.poolAmounts) {
                //expect(poolAmount.amount0).toBeGreaterThanOrEqual(0);
                //expect(poolAmount.amount1).toBeGreaterThanOrEqual(0);
                console.log(
                    'pool',
                    poolAmount.pool,
                    'poolAmount.amount0',
                    poolAmount.amount0,
                    'poolAmount.amount1',
                    poolAmount.amount1,
                );
            }
        }
    });

    it.skip('should query split route and execute multiSwap succeed', async function () {
        const usdc = token1;
        const weth = {
            name: 'USDT',
            address: '0xfde4C96c8593536E31F229EA8f37b2ADa2699bb2',
            symbol: 'USDT',
            decimals: 6,
        } as Erc20TokenInfo;
        const amount = parseUnits('1000', usdc.decimals);
        // const userAddress = '0x...'; // actual user address

        // Step 1: Query split route
        const route = await aggregator.querySplitRoute({
            fromToken: usdc,
            toToken: weth,
            fromAmount: amount,
            excludePoolTypes: [],
            isDirect: false,
        });

        expect(route.bestAmount > ZERO_BI).toBe(true);
        expect(route.bestPathInfo.tokens.length).toBeGreaterThan(0);
        expect(route.bestPathInfo.tokens[0]).toBe(usdc.address);
        expect(route.bestPathInfo.tokens[route.bestPathInfo.tokens.length - 1]).toBe(weth.address);

        // Step 2: Execute multiSwap
        const rawTx = await aggregator.encodeMultiSwapData({
            fromToken: usdc,
            toToken: weth,
            fromTokenAmount: amount,
            bestPathInfo: route.bestPathInfo,
            bestAmount: route.bestAmount,
            broker: ZERO_ADDRESS,
            brokerFeeRate: 0n,
            userParams: {
                slippageInBps: 100, // 1%
                deadline: Math.floor(Date.now() / 1000) + 5 * 60, // 5 minutes from now,
            },
        });

        expect(rawTx).toBeDefined();
        expect(rawTx.to).toBeDefined();
        expect(rawTx.data).toBeDefined();
        expect(rawTx.value).toBeDefined();
    });

    it('should simulate MT single pool succeed', async function () {
        const weth = token0;
        const usdc = token1;

        // Get pool list to find a valid pool address
        const pools = await aggregator.getPoolList(weth.address, usdc.address);
        expect(pools.length).toBeGreaterThan(0);

        // Use the first pool for testing
        const testPool = pools[0];
        console.log('Testing with pool:', testPool.poolAddr);
        console.log('Pool type:', testPool.poolType);

        const fromAmount = parseUnits('0.0015', usdc.decimals);
        const routeResult = await aggregator.queryOnePoolRoute({
            fromToken: usdc,
            toToken: weth,
            fromAmount,
            poolAddress: testPool.poolAddr,
        });

        const metrics = calculateSwapSlippage({
            inputAmount: fromAmount,
            actualAmountOut: routeResult.bestAmount,
            fromTokenDecimals: usdc.decimals,
            toTokenDecimals: weth.decimals,
            midPrice: routeResult.midPrice,
            slippageInBps: 100,
        });

        // Verify basic result structure
        expect(metrics.priceImpact).toBeGreaterThan(-1);
        expect(metrics.minReceivedAmount > ZERO_BI).toBe(true);
        expect(routeResult.bestPathInfo.tokens.length).toBe(2);

        // Verify tokens are in correct order
        expect(routeResult.bestPathInfo.tokens[0]).toBe(usdc.address);
        expect(routeResult.bestPathInfo.tokens[1]).toBe(weth.address);

        // Verify route structure (should be single pool)
        expect(routeResult.bestPathInfo.oneHops.length).toBe(1);
        expect(routeResult.bestPathInfo.oneHops[0].pools.length).toBe(1);

        const routeInfo = routeResult.bestPathInfo.oneHops[0].pools[0];
        expect(routeInfo.poolAddr).toBe(testPool.poolAddr);
        expect(routeInfo.poolType).toBe(PoolType.OYSTER_NEW);
        expect(routeInfo.fee >= ZERO_BI).toBe(true);

        console.log('Price impact:', metrics.priceImpact);
        console.log('Min received amount:', metrics.minReceivedAmount.toString());
        console.log('Tokens:', routeResult.bestPathInfo.tokens);
    });

    it('should simulate MT single pool with custom adapter succeed', async function () {
        const weth = token0;
        const usdc = token1;

        // Get pool list to find a valid pool address
        const pools = await aggregator.getPoolList(weth.address, usdc.address);
        expect(pools.length).toBeGreaterThan(0);

        // Use the first pool for testing
        const testPool = pools[0];

        // Get default adapter address for comparison
        const defaultAdapter = await aggregator.getPoolAdapter(PoolType.OYSTER_NEW);

        const fromAmount = parseUnits('0.0015', usdc.decimals);
        const routeResult = await aggregator.queryOnePoolRoute({
            fromToken: usdc,
            toToken: weth,
            fromAmount,
            poolAddress: testPool.poolAddr,
            adapterAddress: defaultAdapter,
        });

        const metrics = calculateSwapSlippage({
            inputAmount: fromAmount,
            actualAmountOut: routeResult.bestAmount,
            fromTokenDecimals: usdc.decimals,
            toTokenDecimals: weth.decimals,
            midPrice: routeResult.midPrice,
            slippageInBps: 100,
        });

        // Verify result is valid
        expect(metrics.priceImpact).toBeGreaterThan(-1);
        expect(metrics.minReceivedAmount > ZERO_BI).toBe(true);
        expect(routeResult.bestPathInfo.oneHops.length).toBe(1);
        expect(routeResult.bestPathInfo.oneHops[0].pools.length).toBe(1);

        console.log('Custom adapter test - Price impact:', metrics.priceImpact);
        console.log('Custom adapter test - Min received amount:', metrics.minReceivedAmount.toString());
    });

    it('should query single pool route succeed', async function () {
        const weth = token0;
        const usdc = token1;

        // Get pool list to find a valid pool address
        const pools = await aggregator.getPoolList(weth.address, usdc.address);
        expect(pools.length).toBeGreaterThan(0);

        // Use the first pool for testing
        const testPool = pools[0];

        const result = await aggregator.queryOnePoolRoute({
            fromToken: usdc,
            toToken: weth,
            fromAmount: parseUnits('0.0015', usdc.decimals),
            poolAddress: testPool.poolAddr,
        });

        // Verify result structure
        expect(result.bestAmount > ZERO_BI).toBe(true);
        expect(result.midPrice > ZERO_BI).toBe(true);
        expect(result.bestPathInfo.isValid).toBe(true);
        expect(result.bestPathInfo.tokens.length).toBe(2);
        expect(result.bestPathInfo.oneHops.length).toBe(1);
        expect(result.bestPathInfo.oneHops[0].pools.length).toBe(1);
        expect(result.bestPathInfo.oneHops[0].weights.length).toBe(1);

        // Verify tokens are in correct order
        expect(result.bestPathInfo.tokens[0]).toBe(usdc.address);
        expect(result.bestPathInfo.tokens[1]).toBe(weth.address);

        // Verify pool info
        const poolInfo = result.bestPathInfo.oneHops[0].pools[0];
        expect(poolInfo.poolAddr).toBe(testPool.poolAddr);
        expect(poolInfo.poolType).toBe(PoolType.OYSTER_NEW);
        expect(poolInfo.swapType).toBe(SwapType.ADAPTER);

        // Verify weight is 100% for single pool
        expect(result.bestPathInfo.oneHops[0].weights[0] > ZERO_BI).toBe(true);

        console.log('Query single pool route - Best amount:', result.bestAmount.toString());
        console.log('Query single pool route - Mid price:', result.midPrice.toString());
        console.log('Query single pool route - Final amount out:', result.bestPathInfo.finalAmountOut.toString());
    });

    it.skip('should query single pool route and execute multiSwap with WMON as toToken succeed', async function () {
        const usdc = token1; // USDC
        const wmon = token0; // WMON
        const amount = parseUnits('10', usdc.decimals);
        // const userAddress = '0x...'; // actual user address

        // Get pool list to find a valid pool address
        const pools = await aggregator.getPoolList(wmon.address, usdc.address);
        expect(pools.length).toBeGreaterThan(0);

        // Use the first pool for testing
        const testPool = pools[2];
        console.log('Testing USDC -> WMON with pool:', testPool.poolAddr);

        // Step 1: Query single pool route
        const route = await aggregator.queryOnePoolRoute({
            fromToken: usdc,
            toToken: wmon,
            fromAmount: amount,
            poolAddress: testPool.poolAddr,
        });

        expect(route.bestAmount > ZERO_BI).toBe(true);
        expect(route.bestPathInfo.tokens.length).toBe(2);
        expect(route.bestPathInfo.tokens[0]).toBe(usdc.address);
        expect(route.bestPathInfo.tokens[1]).toBe(wmon.address);
        expect(route.bestPathInfo.oneHops.length).toBe(1);
        expect(route.bestPathInfo.oneHops[0].pools.length).toBe(1);

        // Step 2: Execute multiSwap
        const rawTx = await aggregator.encodeMultiSwapData({
            fromToken: usdc,
            toToken: wmon,
            fromTokenAmount: amount,
            bestPathInfo: route.bestPathInfo,
            bestAmount: route.bestAmount,
            broker: ZERO_ADDRESS,
            brokerFeeRate: 0n,
            userParams: {
                slippageInBps: 100, // 1%
                deadline: Math.floor(Date.now() / 1000) + 5 * 60, // 5 minutes from now,
            },
        });

        expect(rawTx).toBeDefined();
        expect(rawTx.to).toBeDefined();
        expect(rawTx.data).toBeDefined();
        expect(rawTx.value).toBeDefined();

        console.log('USDC -> WMON transaction:', {
            to: rawTx.to,
            value: rawTx.value?.toString(),
            dataLength: rawTx.data?.length,
        });
    });

    it.skip('should query single pool route and execute multiSwap with WMON as fromToken succeed', async function () {
        const wmon = token0; // WMON
        const usdc = token1; // USDC
        const amount = parseUnits('0.1', wmon.decimals); // Smaller amount for WMON
        // const userAddress = '0x...'; // actual user address

        // Get pool list to find a valid pool address
        const pools = await aggregator.getPoolList(wmon.address, usdc.address);
        expect(pools.length).toBeGreaterThan(0);

        // Use the first pool for testing
        const testPool = pools[1];
        console.log('Testing WMON -> USDC with pool:', testPool.poolAddr);

        // Step 1: Query single pool route
        const route = await aggregator.queryOnePoolRoute({
            fromToken: wmon,
            toToken: usdc,
            fromAmount: amount,
            poolAddress: testPool.poolAddr,
        });

        expect(route.bestAmount > ZERO_BI).toBe(true);
        expect(route.bestPathInfo.tokens.length).toBe(2);
        expect(route.bestPathInfo.tokens[0]).toBe(wmon.address);
        expect(route.bestPathInfo.tokens[1]).toBe(usdc.address);
        expect(route.bestPathInfo.oneHops.length).toBe(1);
        expect(route.bestPathInfo.oneHops[0].pools.length).toBe(1);

        // Step 2: Execute multiSwap
        const rawTx = await aggregator.encodeMultiSwapData({
            fromToken: wmon,
            toToken: usdc,
            fromTokenAmount: amount,
            bestPathInfo: route.bestPathInfo,
            bestAmount: route.bestAmount,
            broker: ZERO_ADDRESS,
            brokerFeeRate: 0n,
            userParams: {
                slippageInBps: 100, // 1%
                deadline: Math.floor(Date.now() / 1000) + 5 * 60, // 5 minutes from now,
            },
        });

        expect(rawTx).toBeDefined();
        expect(rawTx.to).toBeDefined();
        expect(rawTx.data).toBeDefined();
        expect(rawTx.value).toBeDefined();

        console.log('WMON -> USDC transaction:', {
            to: rawTx.to,
            value: rawTx.value?.toString(),
            dataLength: rawTx.data?.length,
        });
    });

    it.skip('should query single pool route and execute multiSwap with Native MON as fromToken succeed', async function () {
        const usdc = token1; // USDC
        const amount = parseUnits('0.01', 18); // 0.01 ETH
        // const userAddress = '0x...'; // actual user address

        // Get pool list to find a valid pool address (using WETH address for pool lookup)
        const pools = await aggregator.getPoolList(token0.address, usdc.address); // token0 is WMON
        expect(pools.length).toBeGreaterThan(0);

        // Use the first pool for testing
        const testPool = pools[0];
        console.log('Testing ETH -> USDC with pool:', testPool.poolAddr);

        // Step 1: Query single pool route
        const route = await aggregator.queryOnePoolRoute({
            fromToken: ETH_TOKEN,
            toToken: usdc,
            fromAmount: amount,
            poolAddress: testPool.poolAddr,
        });

        expect(route.bestAmount > ZERO_BI).toBe(true);
        expect(route.bestPathInfo.tokens.length).toBe(2);
        expect(route.bestPathInfo.tokens[0]).toBe(token0.address); // Should be WETH address after conversion
        expect(route.bestPathInfo.tokens[1]).toBe(usdc.address);
        expect(route.bestPathInfo.oneHops.length).toBe(1);
        expect(route.bestPathInfo.oneHops[0].pools.length).toBe(1);

        // Step 2: Execute multiSwap
        const rawTx = await aggregator.encodeMultiSwapData({
            fromToken: ETH_TOKEN,
            toToken: usdc,
            fromTokenAmount: amount,
            bestPathInfo: route.bestPathInfo,
            bestAmount: route.bestAmount,
            broker: ZERO_ADDRESS,
            brokerFeeRate: 0n,
            userParams: {
                slippageInBps: 100, // 1%
                deadline: Math.floor(Date.now() / 1000) + 5 * 60, // 5 minutes from now,
            },
        });

        expect(rawTx).toBeDefined();
        expect(rawTx.to).toBeDefined();
        expect(rawTx.data).toBeDefined();
        expect(rawTx.value).toBe(amount); // Should include ETH value

        console.log('ETH -> USDC transaction:', {
            to: rawTx.to,
            value: rawTx.value?.toString(),
            dataLength: rawTx.data?.length,
        });
    });

    it.skip('should query single pool route and execute multiSwap with Native MON as toToken succeed', async function () {
        const usdc = token1; // USDC
        const amount = parseUnits('1000', usdc.decimals);
        // const userAddress = '0x...'; // actual user address

        // Get pool list to find a valid pool address (using WETH address for pool lookup)
        const pools = await aggregator.getPoolList(token0.address, usdc.address); // token0 is WMON
        expect(pools.length).toBeGreaterThan(0);

        // Use the first pool for testing
        const testPool = pools[0];
        console.log('Testing USDC -> ETH with pool:', testPool.poolAddr);

        // Step 1: Query single pool route
        const route = await aggregator.queryOnePoolRoute({
            fromToken: usdc,
            toToken: ETH_TOKEN,
            fromAmount: amount,
            poolAddress: testPool.poolAddr,
        });

        expect(route.bestAmount > ZERO_BI).toBe(true);
        expect(route.bestPathInfo.tokens.length).toBe(2);
        expect(route.bestPathInfo.tokens[0]).toBe(usdc.address);
        expect(route.bestPathInfo.tokens[1]).toBe(token0.address); // Should be WETH address after conversion
        expect(route.bestPathInfo.oneHops.length).toBe(1);
        expect(route.bestPathInfo.oneHops[0].pools.length).toBe(1);

        // Step 2: Execute multiSwap
        const rawTx = await aggregator.encodeMultiSwapData({
            fromToken: usdc,
            toToken: ETH_TOKEN,
            fromTokenAmount: amount,
            bestPathInfo: route.bestPathInfo,
            bestAmount: route.bestAmount,
            broker: ZERO_ADDRESS,
            brokerFeeRate: 0n,
            userParams: {
                slippageInBps: 100, // 1%
                deadline: Math.floor(Date.now() / 1000) + 5 * 60, // 5 minutes from now,
            },
        });

        expect(rawTx).toBeDefined();
        expect(rawTx.to).toBeDefined();
        expect(rawTx.data).toBeDefined();
        expect(rawTx.value.toString()).toBe('0'); // No ETH value for USDC -> ETH

        console.log('USDC -> ETH transaction:', {
            to: rawTx.to,
            value: rawTx.value?.toString(),
            dataLength: rawTx.data?.length,
        });
    });

    it.skip('should query specified pool', async function () {
        // const test_token1 = {
        //     name: 'YAKI',
        //     address: '0xfe140e1dCe99Be9F4F15d657CD9b7BF622270C50',
        //     symbol: 'YAKI',
        //     decimals: 18,
        // };
        const test_token1 = token1;
        // const test_token0 = {
        //     name: 'WETH',
        //     address: '0xB5a30b0FDc5EA94A52fDc42e3E9760Cb8449Fb37',
        //     symbol: 'WETH',
        //     decimals: 18,
        // };
        const test_token0 = token0;
        const amount = parseUnits('1', test_token1.decimals);
        // const userAddress = '0x...'; // actual user address

        // Get pool list to find a valid pool address (using WETH address for pool lookup)
        // const pools = await aggregator.getPoolList(test_token0.address, test_token1.address); // token0 is WMON
        // expect(pools.length).toBeGreaterThan(0);

        // Use the first pool for testing
        const testPool = {
            token0: test_token1.address,
            token1: test_token0.address,
            poolAddr: '0x7d148143b7033f150830ff9114797b54671dde2e',
            poolType: PoolType.OYSTER_NEW,
            fee: 3000n,
            swapType: SwapType.ADAPTER,
        };
        console.log('Testing USDC -> MON with pool:', testPool.poolAddr);

        // Step 1: Query single pool route
        const route = await aggregator.queryOnePoolRoute({
            fromToken: test_token1,
            toToken: test_token0,
            fromAmount: amount,
            poolAddress: testPool.poolAddr,
        });

        console.log('best amount:', route.bestAmount.toString());
        expect(route.bestAmount > ZERO_BI).toBe(true);
        expect(route.bestPathInfo.tokens.length).toBe(2);
        expect(route.bestPathInfo.tokens[0]).toBe(test_token1.address);
        expect(route.bestPathInfo.tokens[1]).toBe(test_token0.address); // Should be WETH address after conversion
        expect(route.bestPathInfo.oneHops.length).toBe(1);
        expect(route.bestPathInfo.oneHops[0].pools.length).toBe(1);

        const simulate_result = calculateSwapSlippage({
            inputAmount: amount,
            actualAmountOut: route.bestAmount,
            fromTokenDecimals: test_token1.decimals,
            toTokenDecimals: test_token0.decimals,
            midPrice: route.midPrice,
            slippageInBps: 100,
        });

        // Verify basic result structure
        console.log('simulate result:', simulate_result.minReceivedAmount.toString());
        console.log('simulate priceImpact:', simulate_result.priceImpact.toString());
        // expect(simulate_result.priceImpact).toBeGreaterThan(-1); // extreme price, priceImpact = 100%
        expect(simulate_result.minReceivedAmount > ZERO_BI).toBe(true);
        expect(route.bestPathInfo.oneHops.length).toBeGreaterThan(0);
        expect(route.bestPathInfo.tokens.length).toBe(2);

        // Step 2: Execute multiSwap
        const rawTx = await aggregator.encodeMultiSwapData({
            fromToken: test_token1,
            toToken: test_token0,
            fromTokenAmount: amount,
            bestPathInfo: route.bestPathInfo,
            bestAmount: route.bestAmount,
            broker: ZERO_ADDRESS,
            brokerFeeRate: 0n,
            userParams: {
                slippageInBps: 100, // 1%
                deadline: Math.floor(Date.now() / 1000) + 5 * 60, // 5 minutes from now,
            },
        });

        expect(rawTx).toBeDefined();
        expect(rawTx.to).toBeDefined();
        expect(rawTx.data).toBeDefined();
        expect(rawTx.value.toString()).toBe('0'); // No ETH value for USDC -> ETH

        console.log('WETH -> USDC transaction:', {
            to: rawTx.to,
            value: rawTx.value?.toString(),
            dataLength: rawTx.data?.length,
        });
    });
});
