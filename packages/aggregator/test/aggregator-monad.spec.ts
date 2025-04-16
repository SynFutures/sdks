import { perpPlugin } from '@synfutures/sdks-perp';
import { parseUnits } from 'ethers/lib/utils';
import { ZERO, Context } from '@derivation-tech/context';
import { DefaultEthGasEstimator, txPlugin } from '@derivation-tech/tx-plugin';
import { PopulatedTransaction, BigNumber, ethers } from 'ethers';
import { aggregatorPlugin, PoolType, SwapType, getDexFlag } from '../src';
import * as dotenv from 'dotenv';
dotenv.config();

describe('Aggregator', function () {
    let ctx: Context;
    let token0 = {
        name: 'TOKEN0',
        address: '0xB50EFdFc4C9346c046F223E18BF09aBB7dD3B71f',
        symbol: 'TOKEN0',
        decimals: 18,
    };
    let token1 = {
        name: 'TOKEN1',
        address: '0xF8fa3e75264A4d3f04a146C99eF5984c97FaeE3B',
        symbol: 'TOKEN1',
        decimals: 18,
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
        const weth = token0;
        const usdc = token1;
        const result = await ctx.aggregator.simulateMixSwap({
            fromTokenAddress: usdc.address,
            toTokenAddress: weth.address,
            fromTokenDecimals: usdc.decimals,
            toTokenDecimals: weth.decimals,
            fromAmount: parseUnits('0.0001', usdc.decimals),
            excludePoolTypes: [],
            slippageInBps: 100, // 1%
        });

        expect(result.priceImpact).toBeGreaterThan(-1);
        expect(result.minReceivedAmount.gt(ZERO)).toBe(true);
        expect(result.route.length).toBeGreaterThan(0);
    });

    it('should query single route succeed', async function () {
        const weth = token0;
        const usdc = token1;
        const result = await ctx.aggregator.querySingleRoute({
            fromTokenAddress: usdc.address,
            toTokenAddress: weth.address,
            fromAmount: parseUnits('0.0001', usdc.decimals),
            excludePoolTypes: [],
        });

        expect(result.bestAmount.gt(ZERO)).toBe(true);
        expect(result.bestPoolPath.length > 0).toBe(true);
        expect(result.bestPath.length > 0).toBe(true);

        expect(result.bestPath[0]).toBe(usdc.address);
        expect(result.bestPath[result.bestPath.length - 1]).toBe(weth.address);
    });

    it('should simulate multi swap succeed', async function () {
        const weth = token0;
        const usdc = token1;

        const result = await ctx.aggregator.simulateMultiSwap({
            fromTokenAddress: weth.address,
            toTokenAddress: usdc.address,
            fromTokenDecimals: weth.decimals,
            toTokenDecimals: weth.decimals,
            fromAmount: parseUnits('0.0001', weth.decimals),
            excludePoolTypes: [],
            isDirect: false,
            slippageInBps: 100, // 1%
        });

        expect(result.priceImpact).toBeGreaterThan(-1);
        expect(result.minReceivedAmount.gt(ZERO)).toBe(true);
        expect(result.route.length).toBeGreaterThan(0);
        for (const routeList of result.route) {
            for (const route of routeList) {
                expect(route.poolAddr).toBeDefined();
                expect(Object.values(PoolType).includes(route.poolType)).toBe(true);
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
            ratio: 0.8,
            steps: 10,
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
                expect(poolAmount.amount0).toBeGreaterThanOrEqual(0);
                expect(poolAmount.amount1).toBeGreaterThanOrEqual(0);
                // console.log(
                //     'pool',
                //     poolAmount.pool,
                //     'poolAmount.amount0',
                //     poolAmount.amount0,
                //     'poolAmount.amount1',
                //     poolAmount.amount1,
                // );
            }
        }
        expect(results.sellLiquidityResults.length).toBe(8);
        for (const result of results.sellLiquidityResults) {
            //console.log(JSON.stringify(result, null, 2));
            // console.log('result.price', result.price, 'result.poolAmounts', result.poolAmounts.length);
            expect(result.price).toBeGreaterThan(0);
            expect(result.poolAmounts.length).toBe(pools.length);
            for (const poolAmount of result.poolAmounts) {
                expect(poolAmount.amount0).toBeGreaterThanOrEqual(0);
                expect(poolAmount.amount1).toBeGreaterThanOrEqual(0);
                // console.log(
                //     'pool',
                //     poolAmount.pool,
                //     'poolAmount.amount0',
                //     poolAmount.amount0,
                //     'poolAmount.amount1',
                //     poolAmount.amount1,
                // );
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
});
