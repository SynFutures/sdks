import { perpPlugin } from '@synfutures/sdks-perp';
import { parseUnits } from 'ethers/lib/utils';
import { ZERO, WAD, Context } from '@derivation-tech/context';
import { DefaultEthGasEstimator, txPlugin } from '@derivation-tech/tx-plugin';
import { PopulatedTransaction, BigNumber, ethers } from 'ethers';
import { aggregatorPlugin, PoolType, SwapType, getDexFlag } from '../src';
import * as dotenv from 'dotenv';
dotenv.config();

describe('Aggregator', function () {
    let ctx: Context;

    beforeEach(async function () {
        ctx = new Context('base', { providerOps: { url: process.env.BASE_RPC! } });
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
        let dexFlag = getDexFlag([PoolType.PANCAKE_V3]);
        expect(dexFlag).toStrictEqual(BigNumber.from(2));
        dexFlag = getDexFlag([PoolType.PANCAKE_V3, PoolType.UNISWAP_V3]);
        expect(dexFlag).toStrictEqual(BigNumber.from(6));
        dexFlag = getDexFlag([PoolType.PANCAKE_V3, PoolType.UNISWAP_V3, PoolType.ALB_V3]);
        expect(dexFlag).toStrictEqual(
            BigNumber.from((1 << PoolType.PANCAKE_V3) | (1 << PoolType.UNISWAP_V3) | (1 << PoolType.ALB_V3)),
        );
        dexFlag = getDexFlag([
            PoolType.PANCAKE_V3,
            PoolType.UNISWAP_V3,
            PoolType.ALB_V3,
            PoolType.PANCAKE_V3,
            PoolType.UNISWAP_V3,
            PoolType.ALB_V3,
        ]);
        expect(dexFlag).toStrictEqual(
            BigNumber.from((1 << PoolType.PANCAKE_V3) | (1 << PoolType.UNISWAP_V3) | (1 << PoolType.ALB_V3)),
        );
    });

    it('should get pool list succeed 1', async function () {
        const usdc = await ctx.getTokenInfo('USDC');
        const weth = await ctx.getTokenInfo('WETH');
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

    it('should get pool list succeed, 2', async function () {
        // VIRTUAL-WETH pools, VIRTUAL is not set in the config contract
        const virtualAddress = '0x0b3e328455c4059EEb9e3f84b5543F74E24e7E1b';
        const weth = await ctx.getTokenInfo('WETH');
        const result = await ctx.aggregator.getPoolList(virtualAddress, weth.address);
        expect(result.length).toBeGreaterThan(0);
        for (const pool of result) {
            expect(pool.token0).toBe(virtualAddress);
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
        const weth = await ctx.getTokenInfo('WETH');
        const usdc = await ctx.getTokenInfo('USDC');
        const result = await ctx.aggregator.simulateMixSwap({
            fromTokenAddress: usdc.address,
            toTokenAddress: weth.address,
            fromTokenDecimals: usdc.decimals,
            toTokenDecimals: weth.decimals,
            fromAmount: parseUnits('10000', usdc.decimals),
            excludePoolTypes: [],
            slippageInBps: 100, // 1%
        });

        expect(result.priceImpact).toBeGreaterThan(-1);
        expect(result.minReceivedAmount.gt(ZERO)).toBe(true);
        expect(result.route.length).toBeGreaterThan(0);
    });

    it('should query single route succeed', async function () {
        const usdc = await ctx.getTokenInfo('USDC');
        const weth = await ctx.getTokenInfo('WETH');
        const result = await ctx.aggregator.querySingleRoute({
            fromTokenAddress: usdc.address,
            toTokenAddress: weth.address,
            fromAmount: parseUnits('10000', usdc.decimals),
            excludePoolTypes: [],
        });

        expect(result.bestAmount.gt(ZERO)).toBe(true);
        expect(result.bestPoolPath.length > 0).toBe(true);
        expect(result.bestPath.length > 0).toBe(true);

        expect(result.bestPath[0]).toBe(usdc.address);
        expect(result.bestPath[result.bestPath.length - 1]).toBe(weth.address);
    });

    it('should simulate multi swap succeed', async function () {
        //const usdc = await ctx.getTokenInfo('USDC');
        const weth = await ctx.getTokenInfo('WETH');
        const toToken = {
            name: 'well',
            address: '0xa88594d404727625a9437c3f886c7643872296ae',
            symbol: 'well',
            decimals: 18,
        };

        const result = await ctx.aggregator.simulateMultiSwap({
            fromTokenAddress: weth.address,
            toTokenAddress: toToken.address,
            fromTokenDecimals: weth.decimals,
            toTokenDecimals: weth.decimals,
            fromAmount: parseUnits('0.01', weth.decimals),
            excludePoolTypes: [],
            isDirect: false,
            slippageInBps: 100, // 1%
        });

        //console.log(bestAmount, numberFromTokenAmount, midPrice, querySplitRouteResult.midPrice.toString(), numberFromTokenAmount * midPrice);
        //console.log(Number(formatUnits(priceImpactBN, 18)) - 1);
        //console.log(result.priceImpact);
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

    it('should simulate mix swap succeed, eth-usdc', async function () {
        const usdc = await ctx.getTokenInfo('USDC');
        const ETH_ADDRESS = '0x0000000000000000000000000000000000000000';

        // USDC -> ETH
        const result1 = await ctx.aggregator.simulateMixSwap({
            fromTokenAddress: usdc.address,
            toTokenAddress: ETH_ADDRESS,
            fromTokenDecimals: usdc.decimals,
            toTokenDecimals: 18,
            fromAmount: parseUnits('10000', usdc.decimals),
            excludePoolTypes: [],
            slippageInBps: 100,
        });

        expect(result1.priceImpact).toBeGreaterThan(-1);
        expect(result1.minReceivedAmount.gt(ZERO)).toBe(true);
        expect(result1.route.length).toBeGreaterThan(0);

        // ETH -> USDC
        const result2 = await ctx.aggregator.simulateMixSwap({
            fromTokenAddress: ETH_ADDRESS,
            toTokenAddress: usdc.address,
            fromTokenDecimals: 18,
            toTokenDecimals: usdc.decimals,
            fromAmount: parseUnits('10', 18),
            excludePoolTypes: [],
            slippageInBps: 100,
        });

        expect(result2.priceImpact).toBeGreaterThan(-1);
        expect(result2.minReceivedAmount.gt(ZERO)).toBe(true);
        expect(result2.route.length).toBeGreaterThan(0);
    });

    it('should query single route succeed, eth-usdc', async function () {
        const usdc = await ctx.getTokenInfo('USDC');
        const ETH_ADDRESS = '0x0000000000000000000000000000000000000000';
        const weth = await ctx.getTokenInfo('WETH');

        // USDC -> ETH
        const result1 = await ctx.aggregator.querySingleRoute({
            fromTokenAddress: usdc.address,
            toTokenAddress: ETH_ADDRESS,
            fromAmount: parseUnits('10000', usdc.decimals),
            excludePoolTypes: [],
        });

        expect(result1.bestAmount.gt(ZERO)).toBe(true);
        expect(result1.bestPoolPath.length > 0).toBe(true);
        expect(result1.bestPath.length > 0).toBe(true);
        expect(result1.bestPath[0]).toBe(usdc.address);
        expect(result1.bestPath[result1.bestPath.length - 1]).toBe(weth.address);

        // ETH -> USDC
        const result2 = await ctx.aggregator.querySingleRoute({
            fromTokenAddress: ETH_ADDRESS,
            toTokenAddress: usdc.address,
            fromAmount: parseUnits('10', 18),
            excludePoolTypes: [],
        });

        expect(result2.bestAmount.gt(ZERO)).toBe(true);
        expect(result2.bestPoolPath.length > 0).toBe(true);
        expect(result2.bestPath.length > 0).toBe(true);
        expect(result2.bestPath[0]).toBe(weth.address);
        expect(result2.bestPath[result2.bestPath.length - 1]).toBe(usdc.address);
    });

    it('should simulate multi swap succeed, eth-usdc', async function () {
        const usdc = await ctx.getTokenInfo('USDC');
        const ETH_ADDRESS = '0x0000000000000000000000000000000000000000';

        // USDC -> ETH
        const result1 = await ctx.aggregator.simulateMultiSwap({
            fromTokenAddress: usdc.address,
            toTokenAddress: ETH_ADDRESS,
            fromTokenDecimals: usdc.decimals,
            toTokenDecimals: 18,
            fromAmount: parseUnits('10000', usdc.decimals),
            excludePoolTypes: [],
            isDirect: true,
            slippageInBps: 100, // 1%
        });

        expect(result1.priceImpact).toBeGreaterThan(-1);
        expect(result1.minReceivedAmount.gt(ZERO)).toBe(true);
        expect(result1.route.length).toBeGreaterThan(0);
        for (const routeList of result1.route) {
            for (const route of routeList) {
                expect(route.poolAddr).toBeDefined();
                expect(Object.values(PoolType).includes(route.poolType)).toBe(true);
                expect(route.ratio.gt(ZERO)).toBe(true);
                expect(route.fee.gt(ZERO)).toBe(true);
            }
        }

        // ETH -> USDC
        const result2 = await ctx.aggregator.simulateMultiSwap({
            fromTokenAddress: ETH_ADDRESS,
            toTokenAddress: usdc.address,
            fromTokenDecimals: 18,
            toTokenDecimals: usdc.decimals,
            fromAmount: parseUnits('10', 18),
            excludePoolTypes: [],
            isDirect: true,
            slippageInBps: 100, // 1%
        });

        expect(result2.priceImpact).toBeGreaterThan(-1);
        expect(result2.minReceivedAmount.gt(ZERO)).toBe(true);
        expect(result2.route.length).toBeGreaterThan(0);
        for (const routeList of result2.route) {
            for (const route of routeList) {
                expect(route.poolAddr).toBeDefined();
                expect(Object.values(PoolType).includes(route.poolType)).toBe(true);
                expect(route.ratio.gt(ZERO)).toBe(true);
                expect(route.fee.gt(ZERO)).toBe(true);
            }
        }
    });

    it('should simulate multi swap succeed, eth-usdc, two hops', async function () {
        const usdc = await ctx.getTokenInfo('USDC');
        const virtualAddress = '0x0b3e328455c4059EEb9e3f84b5543F74E24e7E1b';

        // USDC -> VIRTUAL
        const result1 = await ctx.aggregator.simulateMultiSwap({
            fromTokenAddress: usdc.address,
            toTokenAddress: virtualAddress,
            fromTokenDecimals: usdc.decimals,
            toTokenDecimals: 18,
            fromAmount: parseUnits('10000', usdc.decimals),
            excludePoolTypes: [],
            isDirect: false,
            slippageInBps: 100, // 1%
        });

        expect(result1.priceImpact).toBeGreaterThan(-1);
        expect(result1.minReceivedAmount.gt(ZERO)).toBe(true);
        expect(result1.route.length).toBeGreaterThan(0);
        for (const routeList of result1.route) {
            for (const route of routeList) {
                expect(route.poolAddr).toBeDefined();
                expect(Object.values(PoolType).includes(route.poolType)).toBe(true);
                expect(route.ratio.gt(ZERO)).toBe(true);
                expect(route.fee.gt(ZERO)).toBe(true);
            }
        }
        expect(result1.tokens.length).toBe(3);
        expect(result1.tokens[0]).toBe(usdc.address);
        expect(result1.tokens[2]).toBe(virtualAddress);

        // VIRTUAL -> USDC
        const result2 = await ctx.aggregator.simulateMultiSwap({
            fromTokenAddress: virtualAddress,
            toTokenAddress: usdc.address,
            fromTokenDecimals: 18,
            toTokenDecimals: usdc.decimals,
            fromAmount: parseUnits('10', 18),
            excludePoolTypes: [],
            isDirect: false,
            slippageInBps: 100, // 1%
        });

        expect(result2.priceImpact).toBeGreaterThan(-1);
        expect(result2.minReceivedAmount.gt(ZERO)).toBe(true);
        expect(result2.route.length).toBeGreaterThan(0);
        for (const routeList of result2.route) {
            for (const route of routeList) {
                expect(route.poolAddr).toBeDefined();
                expect(Object.values(PoolType).includes(route.poolType)).toBe(true);
                expect(route.ratio.gt(ZERO)).toBe(true);
                expect(route.fee.gt(ZERO)).toBe(true);
            }
        }
        expect(result2.tokens.length).toBe(3);
        expect(result2.tokens[0]).toBe(virtualAddress);
        expect(result2.tokens[2]).toBe(usdc.address);
    });

    it('should query split route succeed, eth-usdc', async function () {
        const usdc = await ctx.getTokenInfo('USDC');
        const ETH_ADDRESS = '0x0000000000000000000000000000000000000000';
        const weth = await ctx.getTokenInfo('WETH');

        // USDC -> ETH
        const result1 = await ctx.aggregator.querySplitRoute({
            fromTokenAddress: usdc.address,
            toTokenAddress: ETH_ADDRESS,
            fromAmount: parseUnits('10000', usdc.decimals),
            excludePoolTypes: [],
            isDirect: true,
        });

        expect(result1.bestAmount.gt(ZERO)).toBe(true);
        expect(result1.bestPathInfo.tokens.length).toBe(2);
        expect(result1.bestPathInfo.tokens[0]).toBe(usdc.address);
        expect(result1.bestPathInfo.tokens[1]).toBe(weth.address);
        expect(result1.bestPathInfo.oneHops.length).toBe(1);
        expect(result1.bestAmount.eq(result1.bestPathInfo.finalAmountOut)).toBe(true);
        expect(result1.bestPathInfo.isValid).toBe(true);

        for (const hop of result1.bestPathInfo.oneHops) {
            for (const pool of hop.pools) {
                expect(result1.bestPathInfo.tokens.includes(pool.token0)).toBe(true);
                expect(result1.bestPathInfo.tokens.includes(pool.token1)).toBe(true);
            }
            for (const weight of hop.weights) {
                expect(weight.gt(ZERO)).toBe(true);
            }
            expect(hop.weights.reduce((a, b) => a.add(b), ZERO).eq(WAD)).toBe(true);
        }

        // ETH -> USDC
        const result2 = await ctx.aggregator.querySplitRoute({
            fromTokenAddress: ETH_ADDRESS,
            toTokenAddress: usdc.address,
            fromAmount: parseUnits('10', 18),
            excludePoolTypes: [],
            isDirect: true,
        });

        expect(result2.bestAmount.gt(ZERO)).toBe(true);
        expect(result2.bestPathInfo.tokens.length).toBe(2);
        expect(result2.bestPathInfo.tokens[0]).toBe(weth.address);
        expect(result2.bestPathInfo.tokens[1]).toBe(usdc.address);
        expect(result2.bestPathInfo.oneHops.length).toBe(1);
        expect(result2.bestAmount.eq(result2.bestPathInfo.finalAmountOut)).toBe(true);
        expect(result2.bestPathInfo.isValid).toBe(true);

        for (const hop of result2.bestPathInfo.oneHops) {
            for (const pool of hop.pools) {
                expect(result2.bestPathInfo.tokens.includes(pool.token0)).toBe(true);
                expect(result2.bestPathInfo.tokens.includes(pool.token1)).toBe(true);
            }
            for (const weight of hop.weights) {
                expect(weight.gt(ZERO)).toBe(true);
            }
            expect(hop.weights.reduce((a, b) => a.add(b), ZERO).eq(WAD)).toBe(true);
        }
    });

    it('should query split route succeed, eth-usdc, two hops', async function () {
        const usdc = await ctx.getTokenInfo('USDC');
        const virtualAddress = '0x0b3e328455c4059EEb9e3f84b5543F74E24e7E1b';
        const weth = await ctx.getTokenInfo('WETH');

        // USDC -> ETH
        const result1 = await ctx.aggregator.querySplitRoute({
            fromTokenAddress: usdc.address,
            toTokenAddress: virtualAddress,
            fromAmount: parseUnits('10000', usdc.decimals),
            excludePoolTypes: [],
            isDirect: false,
        });

        expect(result1.bestAmount.gt(ZERO)).toBe(true);
        expect(result1.bestPathInfo.tokens.length).toBe(3);
        expect(result1.bestPathInfo.tokens[0]).toBe(usdc.address);
        expect(result1.bestPathInfo.tokens[1]).toBe(weth.address);
        expect(result1.bestPathInfo.tokens[2]).toBe(virtualAddress);
        expect(result1.bestPathInfo.oneHops.length).toBe(2);
        expect(result1.bestAmount.eq(result1.bestPathInfo.finalAmountOut)).toBe(true);
        expect(result1.bestPathInfo.isValid).toBe(true);

        for (const hop of result1.bestPathInfo.oneHops) {
            for (const pool of hop.pools) {
                expect(result1.bestPathInfo.tokens.includes(pool.token0)).toBe(true);
                expect(result1.bestPathInfo.tokens.includes(pool.token1)).toBe(true);
            }
            for (const weight of hop.weights) {
                expect(weight.gt(ZERO)).toBe(true);
            }
            expect(hop.weights.reduce((a, b) => a.add(b), ZERO).eq(WAD)).toBe(true);
        }

        // ETH -> USDC
        const result2 = await ctx.aggregator.querySplitRoute({
            fromTokenAddress: virtualAddress,
            toTokenAddress: usdc.address,
            fromAmount: parseUnits('10', 18),
            excludePoolTypes: [],
            isDirect: false,
        });

        expect(result2.bestAmount.gt(ZERO)).toBe(true);
        expect(result2.bestPathInfo.tokens.length).toBe(3);
        expect(result2.bestPathInfo.tokens[0]).toBe(virtualAddress);
        expect(result2.bestPathInfo.tokens[2]).toBe(usdc.address);
        expect(result2.bestPathInfo.oneHops.length).toBe(2);
        expect(result2.bestAmount.eq(result2.bestPathInfo.finalAmountOut)).toBe(true);
        expect(result2.bestPathInfo.isValid).toBe(true);

        for (const hop of result2.bestPathInfo.oneHops) {
            for (const pool of hop.pools) {
                expect(result2.bestPathInfo.tokens.includes(pool.token0)).toBe(true);
                expect(result2.bestPathInfo.tokens.includes(pool.token1)).toBe(true);
            }
            for (const weight of hop.weights) {
                expect(weight.gt(ZERO)).toBe(true);
            }
            expect(hop.weights.reduce((a, b) => a.add(b), ZERO).eq(WAD)).toBe(true);
        }
    });

    it('should query split route succeed 1', async function () {
        const usdc = await ctx.getTokenInfo('USDC');
        const weth = await ctx.getTokenInfo('WETH');
        const result = await ctx.aggregator.querySplitRoute({
            fromTokenAddress: usdc.address,
            toTokenAddress: weth.address,
            fromAmount: parseUnits('10000', usdc.decimals),
            excludePoolTypes: [],
            isDirect: true,
        });

        expect(result.bestAmount.gt(ZERO)).toBe(true);
        expect(result.bestPathInfo.tokens.length).toBe(2);
        expect(result.bestPathInfo.tokens[0]).toBe(usdc.address);
        expect(result.bestPathInfo.tokens[1]).toBe(weth.address);
        expect(result.bestPathInfo.oneHops.length).toBe(1);

        expect(result.bestPathInfo.tokens.length > 0).toBe(true);
        expect(result.bestPathInfo.tokens[0]).toBe(usdc.address);
        expect(result.bestPathInfo.tokens[result.bestPathInfo.tokens.length - 1]).toBe(weth.address);
        expect(result.bestAmount.eq(result.bestPathInfo.finalAmountOut)).toBe(true);
        expect(result.bestPathInfo.isValid).toBe(true);

        for (const hop of result.bestPathInfo.oneHops) {
            for (const pool of hop.pools) {
                // token0 and token1 should be in the bestPathInfo.tokens array
                expect(result.bestPathInfo.tokens.includes(pool.token0)).toBe(true);
                expect(result.bestPathInfo.tokens.includes(pool.token1)).toBe(true);
            }
            for (const weight of hop.weights) {
                expect(weight.gt(ZERO)).toBe(true);
            }
            expect(hop.weights.reduce((a, b) => a.add(b), ZERO).eq(WAD)).toBe(true);
        }
    });

    it('should query split route succeed 2', async function () {
        const usdc = await ctx.getTokenInfo('USDC');
        const weth = await ctx.getTokenInfo('WETH');
        const result = await ctx.aggregator.querySplitRoute({
            fromTokenAddress: usdc.address,
            toTokenAddress: weth.address,
            fromAmount: parseUnits('10000', usdc.decimals),
            excludePoolTypes: [],
            isDirect: false,
        });

        expect(result.bestAmount.gt(ZERO)).toBe(true);
        expect(result.bestPathInfo.tokens.length > 0).toBe(true);
        expect(result.bestPathInfo.tokens[0]).toBe(usdc.address);
        expect(result.bestPathInfo.tokens[result.bestPathInfo.tokens.length - 1]).toBe(weth.address);
        expect(result.bestAmount.eq(result.bestPathInfo.finalAmountOut)).toBe(true);
        expect(result.bestPathInfo.isValid).toBe(true);

        for (const hop of result.bestPathInfo.oneHops) {
            for (const pool of hop.pools) {
                // token0 and token1 should be in the bestPathInfo.tokens array
                expect(result.bestPathInfo.tokens.includes(pool.token0)).toBe(true);
                expect(result.bestPathInfo.tokens.includes(pool.token1)).toBe(true);
            }
            for (const weight of hop.weights) {
                expect(weight.gt(ZERO)).toBe(true);
            }
            expect(hop.weights.reduce((a, b) => a.add(b), ZERO).eq(WAD)).toBe(true);
        }
    });

    it('should convert between ETH and WETH succeed', async function () {
        if (!ctx) {
            console.warn('ctx is not initialized');
            return;
        }

        const weth = await ctx.getTokenInfo('WETH');
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
        const token0 = await ctx.getTokenInfo('WETH');
        // console.log(token0);
        /*
        const token1 = {
            name: 'Oliver',
            address: '0x0bd9158d09c31ad794fa1ba7c05d50e27c29de60',
            symbol: 'OLI',
            decimals: 18,
        };
        */
        const token1 = await ctx.getTokenInfo('USDC');
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
            // console.log(JSON.stringify(result, null, 2));
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
            // console.log(JSON.stringify(result, null, 2));
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
