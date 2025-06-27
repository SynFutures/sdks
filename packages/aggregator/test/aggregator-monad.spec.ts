import { perpPlugin } from '@synfutures/sdks-perp';
import { parseUnits } from 'ethers/lib/utils';
import { ZERO, Context, ONE } from '@derivation-tech/context';
import { DefaultEthGasEstimator, txPlugin } from '@derivation-tech/tx-plugin';
import { PopulatedTransaction, BigNumber, ethers } from 'ethers';
import { aggregatorPlugin, PoolType, SwapType, getDexFlag } from '../src';
import * as dotenv from 'dotenv';
dotenv.config();

describe('Aggregator', function () {
    let ctx: Context;
    let token0 = {
        name: 'WMON',
        address: '0x760AfE86e5de5fa0Ee542fc7B7B713e1c5425701',
        symbol: 'WMON',
        decimals: 18,
    };
    let token1 = {
        name: 'USDC',
        address: '0xf817257fed379853cDe0fa4F97AB987181B1E5Ea',
        symbol: 'USDT',
        decimals: 6,
    };


    beforeEach(async function () {
        ctx = new Context('monad-testnet', { providerOps: { url: process.env.MONAD_RPC! }});
        ctx.use(perpPlugin({ configuration: 'local' }));
        ctx.use(aggregatorPlugin());
        ctx.use(txPlugin({ gasEstimator: new DefaultEthGasEstimator() }));
        await ctx.init();
    });

    it('should init succeed', async function () {
        const middleTokens = await ctx.aggregator.config.getMiddleTokens();

        expect(middleTokens.length > 0);
    });

    it('should get dex flag succeed', async function () {
        let dexFlag = getDexFlag([PoolType.OYSTER]);
        expect(dexFlag).toStrictEqual(BigNumber.from(1 << PoolType.OYSTER));
    });

    it('should get pool list succeed 1', async function () {
        const usdc = token0;
        const weth = token1;
        const result = await ctx.aggregator.getPoolList(usdc.address, weth.address);
        expect(result.length).toBeGreaterThan(0);
        for (const pool of result) {
            expect(pool.token0).toBe(usdc.address);
            expect(pool.token1).toBe(weth.address);
            expect(pool.fee.gt(ZERO)).toBe(true);
            expect(Object.values(PoolType).includes(pool.poolType)).toBe(true);
            expect(pool.poolAddr).toBeDefined();
            expect(Object.values(SwapType).includes(pool.swapType)).toBe(true);
        }
    });

    it('should not get pool list', async function () {
        const aixbtAddress = '0x4F9Fd6Be4a90f2620860d680c0d4d5Fb53d1A825';
        const cbbtcAddress = '0xcbB7C0000aB88B473b1f5aFd9ef808440eed33Bf';
        const result = await ctx.aggregator.getPoolList(aixbtAddress, cbbtcAddress);
        expect(result.length).toBe(0);
    });

    it('should simulate mix swap succeed', async function () {
        const weth = token1;
        const usdc = token0;
        const result = await ctx.aggregator.simulateMixSwap({
            fromTokenAddress: usdc.address,
            toTokenAddress: weth.address,
            fromTokenDecimals: usdc.decimals,
            toTokenDecimals: weth.decimals,
            fromAmount: parseUnits('0.0015', usdc.decimals),
            excludePoolTypes: [8],
            slippageInBps: 100, // 1%
        });

        expect(result.priceImpact).toBeGreaterThan(-1);
        expect(result.minReceivedAmount.gt(ZERO)).toBe(true);
        console.log("out amount:", result.minReceivedAmount.toString());
        console.log("path:", result.route);
        expect(result.route.length).toBeGreaterThan(0);
    });

    it('should query single route succeed', async function () {
        const weth = token0;
        const usdc = token1;
        const result = await ctx.aggregator.querySingleRoute({
            fromTokenAddress: usdc.address,
            toTokenAddress: weth.address,
            fromAmount: parseUnits('0.001', usdc.decimals),
            excludePoolTypes: [],
        });

        expect(result.bestAmount.gt(ZERO)).toBe(true);
        expect(result.bestPoolPath.length > 0).toBe(true);
        expect(result.bestPath.length > 0).toBe(true);

        expect(result.bestPath[0]).toBe(usdc.address);
        expect(result.bestPath[result.bestPath.length - 1]).toBe(weth.address);
    });

    it('should simulate multi swap succeed, mon-usdt', async function () {
        const weth = token0;
        const usdc = token1;

        const result = await ctx.aggregator.simulateMultiSwap({
            fromTokenAddress: '0x0000000000000000000000000000000000000000',//weth.address,
            toTokenAddress: usdc.address,
            fromTokenDecimals: weth.decimals,
            toTokenDecimals: usdc.decimals,
            fromAmount: parseUnits('0.01', weth.decimals),
            excludePoolTypes: [],
            isDirect: false,
            slippageInBps: 100, // 1%
        });

        //console.log(JSON.stringify(result, null, 2));
        expect(result.priceImpact).toBeGreaterThan(-1);
        expect(result.minReceivedAmount.gt(ZERO)).toBe(true);
        expect(result.route.length).toBeGreaterThan(0);
        for (const routeList of result.route) {
            for (const route of routeList) {
                expect(route.poolAddr).toBeDefined();
                expect(Object.values(PoolType).includes(route.poolType)).toBe(true);
                //console.log("ratio:", route.ratio.toString());
                expect(route.ratio.gt(ZERO)).toBe(true);
                expect(route.fee.gt(ZERO)).toBe(true);
            }
        }
    });

    it('should simulate multi swap succeed, usdt - mon', async function () {
        const weth = token0;
        const usdc = token1;

        const result = await ctx.aggregator.simulateMultiSwap({
            fromTokenAddress: usdc.address,
            toTokenAddress: weth.address, //'0x0000000000000000000000000000000000000000',
            fromTokenDecimals: usdc.decimals,
            toTokenDecimals: weth.decimals,
            fromAmount: parseUnits('0.01', usdc.decimals),
            excludePoolTypes: [],
            isDirect: false,
            slippageInBps: 100, // 1%
        });

        console.log(JSON.stringify(result, null, 2));
        expect(result.priceImpact).toBeGreaterThan(-1);
        expect(result.minReceivedAmount.gt(ZERO)).toBe(true);
        expect(result.route.length).toBeGreaterThan(0);
        for (const routeList of result.route) {
            for (const route of routeList) {
                expect(route.poolAddr).toBeDefined();
                expect(Object.values(PoolType).includes(route.poolType)).toBe(true);
                console.log("ratio:", route.ratio.toString());
                expect(route.ratio.gt(ZERO)).toBe(true);
                expect(route.fee.gt(ZERO)).toBe(true);
            }
        }
    });

    it('should convert between ETH and WETH succeed', async function () {
        if (!ctx) {
            console.warn('ctx is not initialized');
            return;
        }

        const weth = {
            name: 'WMON',
            address: '0x760AfE86e5de5fa0Ee542fc7B7B713e1c5425701',
            symbol: 'WMON',
            decimals: 18,
        };;
        const ETH_ADDRESS = '0x0000000000000000000000000000000000000000';
        const testAmount = parseUnits('1', 18); // 1 ETH/WETH

        // Test ETH -> WETH (deposit)
        type PopulatedTx = PopulatedTransaction;
        const depositTx = (await ctx.aggregator.wethConvert(
            {
                fromTokenAddress: ETH_ADDRESS,
                toTokenAddress: weth.address,
                amount: testAmount,
            },
            {}, // empty TxOptions，ensure return PopulatedTransaction
        )) as PopulatedTx;

        expect(depositTx).toBeDefined();
        expect(depositTx.to).toBe(weth.address);
        expect(depositTx.value).toEqual(testAmount);
        expect(depositTx.data).toBeDefined();

        // Test WETH -> ETH (withdraw)
        const withdrawTx = (await ctx.aggregator.wethConvert(
            {
                fromTokenAddress: weth.address,
                toTokenAddress: ETH_ADDRESS,
                amount: testAmount,
            },
            {}, // empty TxOptions，ensure return PopulatedTransaction
        )) as PopulatedTx;

        expect(withdrawTx).toBeDefined();
        expect(withdrawTx.to).toBe(weth.address);
        expect(withdrawTx.value).toEqual(ZERO);
        expect(withdrawTx.data).toBeDefined();

        // Test invalid conversion (WETH -> WETH)
        await expect(
            ctx.aggregator.wethConvert({
                fromTokenAddress: weth.address,
                toTokenAddress: weth.address,
                amount: testAmount,
            }),
        ).rejects.toThrow('At least one token must be ETH for WETH conversion');

        // Test invalid conversion (ETH -> ETH)
        await expect(
            ctx.aggregator.wethConvert({
                fromTokenAddress: ETH_ADDRESS,
                toTokenAddress: ETH_ADDRESS,
                amount: testAmount,
            }),
        ).rejects.toThrow('At least one token must be ETH for WETH conversion');
    });

    it('should get pool liquidity succeed', async function () {
        const pools = await ctx.aggregator.getPoolList(token0.address, token1.address);
        const priceMultipliers = [
            0.996, 0.9965, 0.997, 0.9975, 0.998, 0.9985, 0.999, 0.9995, 1.0005, 1.001, 1.0015, 1.002, 1.0025, 1.003,
            1.0035, 1.004,
        ];
        //console.log("pools:", JSON.stringify(pools,null, 2));
        const results = await ctx.aggregator.getPoolLiquidity({
            pools,
            token0Decimal: token0.decimals,
            token1Decimal: token1.decimals,
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
        const usdc = await ctx.getTokenInfo('USDC');
        const weth = {
            name: 'USDT',
            address: '0xfde4C96c8593536E31F229EA8f37b2ADa2699bb2',
            symbol: 'USDT',
            decimals: 6,
        };
        //await ctx.getTokenInfo('WETH');
        const amount = parseUnits('1000', usdc.decimals);
        const userAddress = '0x...'; // actual user address

        // Step 1: Query split route
        const route = await ctx.aggregator.querySplitRoute({
            fromTokenAddress: usdc.address,
            toTokenAddress: weth.address,
            fromAmount: amount,
            excludePoolTypes: [],
            isDirect: false,
        });

        expect(route.bestAmount.gt(ZERO)).toBe(true);
        expect(route.bestPathInfo.tokens.length).toBeGreaterThan(0);
        expect(route.bestPathInfo.tokens[0]).toBe(usdc.address);
        expect(route.bestPathInfo.tokens[route.bestPathInfo.tokens.length - 1]).toBe(weth.address);

        // Step 2: Execute multiSwap
        const rawTx = await ctx.aggregator.multiSwap(
            {
                fromTokenAddress: usdc.address,
                toTokenAddress: weth.address,
                fromTokenAmount: amount,
                bestPathInfo: route.bestPathInfo,
                bestAmount: route.bestAmount,
                slippageInBps: 100, // 1%
                broker: ethers.constants.AddressZero,
                brokerFeeRate: BigNumber.from(0),
                deadline: Math.floor(Date.now() / 1000) + 5 * 60, // 5 minutes from now
            },
            {
                from: userAddress, // user address
            },
        );

        expect(rawTx).toBeDefined();
        expect(rawTx.to).toBeDefined();
        expect(rawTx.data).toBeDefined();
        expect(rawTx.value).toBeDefined();
    });

    it('should simulate MT single pool succeed', async function () {
        const weth = token0;
        const usdc = token1;
        
        // Get pool list to find a valid pool address
        const pools = await ctx.aggregator.getPoolList(weth.address, usdc.address);
        expect(pools.length).toBeGreaterThan(0);
        
        // Use the first pool for testing
        const testPool = pools[0];
        console.log("Testing with pool:", testPool.poolAddr);
        console.log("Pool type:", testPool.poolType);
        
        const result = await ctx.aggregator.simulateMTSinglePool({
            fromTokenAddress: usdc.address,
            toTokenAddress: weth.address,
            fromTokenDecimals: usdc.decimals,
            toTokenDecimals: weth.decimals,
            fromAmount: parseUnits('0.0015', usdc.decimals),
            poolAddress: testPool.poolAddr,
            slippageInBps: 100, // 1%
        });

        // Verify basic result structure
        expect(result.priceImpact).toBeGreaterThan(-1);
        expect(result.minReceivedAmount.gt(ZERO)).toBe(true);
        expect(result.route.length).toBeGreaterThan(0);
        expect(result.tokens.length).toBe(2);
        
        // Verify tokens are in correct order
        expect(result.tokens[0]).toBe(usdc.address);
        expect(result.tokens[1]).toBe(weth.address);
        
        // Verify route structure (should be single pool)
        expect(result.route.length).toBe(1); // Single hop
        expect(result.route[0].length).toBe(1); // Single pool in the hop
        
        const routeInfo = result.route[0][0];
        expect(routeInfo.poolAddr).toBe(testPool.poolAddr);
        expect(routeInfo.poolType).toBe(PoolType.OYSTER_NEW);
        expect(routeInfo.ratio.gt(ZERO)).toBe(true);
        expect(routeInfo.fee.gte(ZERO)).toBe(true);
        
        console.log("Price impact:", result.priceImpact);
        console.log("Min received amount:", result.minReceivedAmount.toString());
        console.log("Route:", JSON.stringify(result.route, null, 2));
        console.log("Tokens:", result.tokens);
    });

    it('should simulate MT single pool with custom adapter succeed', async function () {
        const weth = token0;
        const usdc = token1;
        
        // Get pool list to find a valid pool address
        const pools = await ctx.aggregator.getPoolList(weth.address, usdc.address);
        expect(pools.length).toBeGreaterThan(0);
        
        // Use the first pool for testing
        const testPool = pools[0];
        
        // Get default adapter address for comparison
        const defaultAdapter = await ctx.aggregator.getPoolAdapter(PoolType.OYSTER_NEW);
        
        const result = await ctx.aggregator.simulateMTSinglePool({
            fromTokenAddress: usdc.address,
            toTokenAddress: weth.address,
            fromTokenDecimals: usdc.decimals,
            toTokenDecimals: weth.decimals,
            fromAmount: parseUnits('0.0015', usdc.decimals),
            poolAddress: testPool.poolAddr,
            adapterAddress: defaultAdapter, // Use custom adapter address
            slippageInBps: 100, // 1%
        });

        // Verify result is valid
        expect(result.priceImpact).toBeGreaterThan(-1);
        expect(result.minReceivedAmount.gt(ZERO)).toBe(true);
        expect(result.route.length).toBe(1);
        expect(result.route[0].length).toBe(1);
        
        console.log("Custom adapter test - Price impact:", result.priceImpact);
        console.log("Custom adapter test - Min received amount:", result.minReceivedAmount.toString());
    });

    it('should query single pool route succeed', async function () {
        const weth = token0;
        const usdc = token1;
        
        // Get pool list to find a valid pool address
        const pools = await ctx.aggregator.getPoolList(weth.address, usdc.address);
        expect(pools.length).toBeGreaterThan(0);
        
        // Use the first pool for testing
        const testPool = pools[0];
        
        const result = await ctx.aggregator.querySinglePoolRoute({
            fromTokenAddress: usdc.address,
            toTokenAddress: weth.address,
            fromAmount: parseUnits('0.0015', usdc.decimals),
            poolAddress: testPool.poolAddr,
        });

        // Verify result structure
        expect(result.bestAmount.gt(ZERO)).toBe(true);
        expect(result.midPrice.gt(ZERO)).toBe(true);
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
        expect(result.bestPathInfo.oneHops[0].weights[0].eq(ONE)).toBe(true);
        
        console.log("Query single pool route - Best amount:", result.bestAmount.toString());
        console.log("Query single pool route - Mid price:", result.midPrice.toString());
        console.log("Query single pool route - Final amount out:", result.bestPathInfo.finalAmountOut.toString());
    });

    it.skip('should query single pool route and execute multiSwap with WMON as toToken succeed', async function () {
        const usdc = token1; // USDC
        const wmon = token0; // WMON
        const amount = parseUnits('10', usdc.decimals);
        const userAddress = '0x...'; // actual user address

        // Get pool list to find a valid pool address
        const pools = await ctx.aggregator.getPoolList(wmon.address, usdc.address);
        expect(pools.length).toBeGreaterThan(0);
        
        // Use the first pool for testing
        const testPool = pools[2];
        console.log("Testing USDC -> WMON with pool:", testPool.poolAddr);

        // Step 1: Query single pool route
        const route = await ctx.aggregator.querySinglePoolRoute({
            fromTokenAddress: usdc.address,
            toTokenAddress: wmon.address,
            fromAmount: amount,
            poolAddress: testPool.poolAddr,
        });

        expect(route.bestAmount.gt(ZERO)).toBe(true);
        expect(route.bestPathInfo.tokens.length).toBe(2);
        expect(route.bestPathInfo.tokens[0]).toBe(usdc.address);
        expect(route.bestPathInfo.tokens[1]).toBe(wmon.address);
        expect(route.bestPathInfo.oneHops.length).toBe(1);
        expect(route.bestPathInfo.oneHops[0].pools.length).toBe(1);

        // Step 2: Execute multiSwap
        const rawTx = await ctx.aggregator.multiSwap(
            {
                fromTokenAddress: usdc.address,
                toTokenAddress: wmon.address,
                fromTokenAmount: amount,
                bestPathInfo: route.bestPathInfo,
                bestAmount: route.bestAmount,
                slippageInBps: 100, // 1%
                broker: ethers.constants.AddressZero,
                brokerFeeRate: BigNumber.from(0),
                deadline: Math.floor(Date.now() / 1000) + 5 * 60, // 5 minutes from now
            },
            {
                from: userAddress, // user address
            },
        );

        expect(rawTx).toBeDefined();
        expect(rawTx.to).toBeDefined();
        expect(rawTx.data).toBeDefined();
        expect(rawTx.value).toBeDefined();
        
        console.log("USDC -> WMON transaction:", {
            to: rawTx.to,
            value: rawTx.value?.toString(),
            dataLength: rawTx.data?.length
        });
    });

    it.skip('should query single pool route and execute multiSwap with WMON as fromToken succeed', async function () {
        const wmon = token0; // WMON
        const usdc = token1; // USDC
        const amount = parseUnits('0.1', wmon.decimals); // Smaller amount for WMON
        const userAddress = '0x...'; // actual user address

        // Get pool list to find a valid pool address
        const pools = await ctx.aggregator.getPoolList(wmon.address, usdc.address);
        expect(pools.length).toBeGreaterThan(0);
        
        // Use the first pool for testing
        const testPool = pools[1];
        console.log("Testing WMON -> USDC with pool:", testPool.poolAddr);

        // Step 1: Query single pool route
        const route = await ctx.aggregator.querySinglePoolRoute({
            fromTokenAddress: wmon.address,
            toTokenAddress: usdc.address,
            fromAmount: amount,
            poolAddress: testPool.poolAddr,
        });

        expect(route.bestAmount.gt(ZERO)).toBe(true);
        expect(route.bestPathInfo.tokens.length).toBe(2);
        expect(route.bestPathInfo.tokens[0]).toBe(wmon.address);
        expect(route.bestPathInfo.tokens[1]).toBe(usdc.address);
        expect(route.bestPathInfo.oneHops.length).toBe(1);
        expect(route.bestPathInfo.oneHops[0].pools.length).toBe(1);

        // Step 2: Execute multiSwap
        const rawTx = await ctx.aggregator.multiSwap(
            {
                fromTokenAddress: wmon.address,
                toTokenAddress: usdc.address,
                fromTokenAmount: amount,
                bestPathInfo: route.bestPathInfo,
                bestAmount: route.bestAmount,
                slippageInBps: 100, // 1%
                broker: ethers.constants.AddressZero,
                brokerFeeRate: BigNumber.from(0),
                deadline: Math.floor(Date.now() / 1000) + 5 * 60, // 5 minutes from now
            },
            {
                from: userAddress, // user address
            },
        );

        expect(rawTx).toBeDefined();
        expect(rawTx.to).toBeDefined();
        expect(rawTx.data).toBeDefined();
        expect(rawTx.value).toBeDefined();
        
        console.log("WMON -> USDC transaction:", {
            to: rawTx.to,
            value: rawTx.value?.toString(),
            dataLength: rawTx.data?.length
        });
    });

    it.skip('should query single pool route and execute multiSwap with Native MON as fromToken succeed', async function () {
        const ethAddress = '0x0000000000000000000000000000000000000000';
        const usdc = token1; // USDC
        const amount = parseUnits('0.01', 18); // 0.01 ETH
        const userAddress = '0x...'; // actual user address

        // Get pool list to find a valid pool address (using WETH address for pool lookup)
        const pools = await ctx.aggregator.getPoolList(token0.address, usdc.address); // token0 is WMON
        expect(pools.length).toBeGreaterThan(0);
        
        // Use the first pool for testing
        const testPool = pools[0];
        console.log("Testing ETH -> USDC with pool:", testPool.poolAddr);

        // Step 1: Query single pool route
        const route = await ctx.aggregator.querySinglePoolRoute({
            fromTokenAddress: ethAddress,
            toTokenAddress: usdc.address,
            fromAmount: amount,
            poolAddress: testPool.poolAddr,
        });

        expect(route.bestAmount.gt(ZERO)).toBe(true);
        expect(route.bestPathInfo.tokens.length).toBe(2);
        expect(route.bestPathInfo.tokens[0]).toBe(token0.address); // Should be WETH address after conversion
        expect(route.bestPathInfo.tokens[1]).toBe(usdc.address);
        expect(route.bestPathInfo.oneHops.length).toBe(1);
        expect(route.bestPathInfo.oneHops[0].pools.length).toBe(1);

        // Step 2: Execute multiSwap
        const rawTx = await ctx.aggregator.multiSwap(
            {
                fromTokenAddress: ethAddress,
                toTokenAddress: usdc.address,
                fromTokenAmount: amount,
                bestPathInfo: route.bestPathInfo,
                bestAmount: route.bestAmount,
                slippageInBps: 100, // 1%
                broker: ethers.constants.AddressZero,
                brokerFeeRate: BigNumber.from(0),
                deadline: Math.floor(Date.now() / 1000) + 5 * 60, // 5 minutes from now
            },
            {
                from: userAddress, // user address
            },
        );

        expect(rawTx).toBeDefined();
        expect(rawTx.to).toBeDefined();
        expect(rawTx.data).toBeDefined();
        expect(rawTx.value).toBe(amount); // Should include ETH value
        
        console.log("ETH -> USDC transaction:", {
            to: rawTx.to,
            value: rawTx.value?.toString(),
            dataLength: rawTx.data?.length
        });
    });

    it.skip('should query single pool route and execute multiSwap with Native MON as toToken succeed', async function () {
        const usdc = token1; // USDC
        const ethAddress = '0x0000000000000000000000000000000000000000';
        const amount = parseUnits('1000', usdc.decimals);
        const userAddress = '0x...'; // actual user address

        // Get pool list to find a valid pool address (using WETH address for pool lookup)
        const pools = await ctx.aggregator.getPoolList(token0.address, usdc.address); // token0 is WMON
        expect(pools.length).toBeGreaterThan(0);
        
        // Use the first pool for testing
        const testPool = pools[0];
        console.log("Testing USDC -> ETH with pool:", testPool.poolAddr);

        // Step 1: Query single pool route
        const route = await ctx.aggregator.querySinglePoolRoute({
            fromTokenAddress: usdc.address,
            toTokenAddress: ethAddress,
            fromAmount: amount,
            poolAddress: testPool.poolAddr,
        });

        expect(route.bestAmount.gt(ZERO)).toBe(true);
        expect(route.bestPathInfo.tokens.length).toBe(2);
        expect(route.bestPathInfo.tokens[0]).toBe(usdc.address);
        expect(route.bestPathInfo.tokens[1]).toBe(token0.address); // Should be WETH address after conversion
        expect(route.bestPathInfo.oneHops.length).toBe(1);
        expect(route.bestPathInfo.oneHops[0].pools.length).toBe(1);

        // Step 2: Execute multiSwap
        const rawTx = await ctx.aggregator.multiSwap(
            {
                fromTokenAddress: usdc.address,
                toTokenAddress: ethAddress,
                fromTokenAmount: amount,
                bestPathInfo: route.bestPathInfo,
                bestAmount: route.bestAmount,
                slippageInBps: 100, // 1%
                broker: ethers.constants.AddressZero,
                brokerFeeRate: BigNumber.from(0),
                deadline: Math.floor(Date.now() / 1000) + 5 * 60, // 5 minutes from now
            },
            {
                from: userAddress, // user address
            },
        );

        expect(rawTx).toBeDefined();
        expect(rawTx.to).toBeDefined();
        expect(rawTx.data).toBeDefined();
        expect(rawTx.value.toString()).toBe('0'); // No ETH value for USDC -> ETH
        
        console.log("USDC -> ETH transaction:", {
            to: rawTx.to,
            value: rawTx.value?.toString(),
            dataLength: rawTx.data?.length
        });
    });
});
