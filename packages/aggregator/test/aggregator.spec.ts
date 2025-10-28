import { decodeFunctionResult, encodeFunctionData, parseAbi, parseUnits } from 'viem';
import { PoolType, SwapType, getDexFlag, AggregatorModule, calculateSwapSlippage } from '../src';
import { ChainKitRegistry, type Erc20TokenInfo } from '@derivation-tech/viem-kit';
import { tickToWad } from '../src/math/conversion';
import * as dotenv from 'dotenv';
dotenv.config();

const ZERO_BI = 0n;
const WAD_BI = 10n ** 18n;
const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';
const POOL_ABI = parseAbi([
    'function slot0() view returns (uint160 sqrtPriceX96, int24 tick, uint16 observationIndex, uint16 observationCardinality, uint16 observationCardinalityNext, uint8 feeProtocol, bool unlocked)',
    'function token0() view returns (address)',
    'function token1() view returns (address)',
]);
const ERC20_ABI = parseAbi(['function decimals() view returns (uint8)']);

const unwrapCallResult = (result: unknown): `0x${string}` => {
    const data = (result as any)?.data ?? result;
    if (!data || typeof data !== 'string') {
        throw new Error('Unexpected call result');
    }
    return data as `0x${string}`;
};

const decodeResult = <T>(result: unknown, abi: any, functionName: string): T => {
    const data = unwrapCallResult(result);
    if (data === '0x') {
        throw new Error(`Empty response from ${functionName}`);
    }
    return decodeFunctionResult({
        abi,
        functionName,
        data,
    }) as T;
};

const ETH_TOKEN: Erc20TokenInfo = {
    address: ZERO_ADDRESS,
    symbol: 'ETH',
    name: 'Ether',
    decimals: 18,
};

describe('Aggregator', function () {
    let chainKit: ReturnType<typeof ChainKitRegistry['for']>;
    let aggregator: AggregatorModule;
    let publicClient: any;

    const getTokenInfo = (symbolOrAddress: string): Erc20TokenInfo => {
        if (!chainKit) {
            throw new Error('ChainKit not initialized');
        }
        const isAddressInput = symbolOrAddress.startsWith('0x');
        const canonicalSymbol = !isAddressInput && symbolOrAddress === 'WETH' ? 'WMON' : symbolOrAddress;
        let info = chainKit.getErc20TokenInfo(canonicalSymbol);
        if(canonicalSymbol === 'WETH' || canonicalSymbol === 'WMON') info = chainKit.wrappedNativeTokenInfo;
        if (!info && isAddressInput) {
            info = chainKit.getErc20TokenInfo(symbolOrAddress);
        }
        if (!info) {
            throw new Error(`Token ${symbolOrAddress} not found on chain ${chainKit.chain.id}`);
        }
        if (!isAddressInput && canonicalSymbol !== symbolOrAddress) {
            return {
                address: info.address,
                symbol: symbolOrAddress,
                name: info.name,
                decimals: info.decimals,
            } as Erc20TokenInfo;
        }
        return info;
    };

    beforeEach(async function () {
        const baseChainId = 8453;
        aggregator = new AggregatorModule({
            chainId: baseChainId,
            rpcUrl: process.env.BASE_RPC!,
        });
        await aggregator.init();
        chainKit = ChainKitRegistry.for(baseChainId);
        publicClient = aggregator.getPublicClientInstance();
    });

    it('should init succeed', async function () {
        const middleTokens = await aggregator.config.getMiddleTokens();

        expect(middleTokens.length > 0);
    });

    it('should get dex flag succeed', async function () {
        let dexFlag = getDexFlag([PoolType.PANCAKE_V3]);
        expect(dexFlag).toBe(BigInt(1 << PoolType.PANCAKE_V3));
        dexFlag = getDexFlag([PoolType.PANCAKE_V3, PoolType.UNISWAP_V3]);
        expect(dexFlag).toBe(
            BigInt((1 << PoolType.PANCAKE_V3) | (1 << PoolType.UNISWAP_V3)),
        );
        dexFlag = getDexFlag([PoolType.PANCAKE_V3, PoolType.UNISWAP_V3, PoolType.ALB_V3]);
        expect(dexFlag).toBe(
            BigInt((1 << PoolType.PANCAKE_V3) | (1 << PoolType.UNISWAP_V3) | (1 << PoolType.ALB_V3)),
        );
        dexFlag = getDexFlag([
            PoolType.PANCAKE_V3,
            PoolType.UNISWAP_V3,
            PoolType.ALB_V3,
            PoolType.PANCAKE_V3,
            PoolType.UNISWAP_V3,
            PoolType.ALB_V3,
        ]);
        expect(dexFlag).toBe(
            BigInt((1 << PoolType.PANCAKE_V3) | (1 << PoolType.UNISWAP_V3) | (1 << PoolType.ALB_V3)),
        );
    });

    it('should get pool list succeed 1', async function () {
        const usdc = getTokenInfo('USDC');
        const weth = getTokenInfo('WETH');
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

    it('should get pool list succeed, 2', async function () {
        // VIRTUAL-WETH pools, VIRTUAL is not set in the config contract
        const virtualAddress = '0x0b3e328455c4059EEb9e3f84b5543F74E24e7E1b';
        const weth = getTokenInfo('WETH');
        const result = await aggregator.getPoolList(virtualAddress, weth.address);
        expect(result.length).toBeGreaterThan(0);
        for (const pool of result) {
            expect(pool.token0).toBe(virtualAddress);
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
        const weth = getTokenInfo('WETH');
        const usdc = getTokenInfo('USDC');
        const fromAmount = parseUnits('10', usdc.decimals);
        const routeResult = await 
            aggregator.querySingleRoute({
                fromToken: usdc,
                toToken: weth,
                fromAmount,
                excludePoolTypes: [],
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
        const route = routeResult.bestPoolPath.map((pool) => pool.poolType);
        expect(route.length).toBeGreaterThan(0);
    });

    it('should query single route succeed', async function () {
        const usdc = getTokenInfo('USDC');
        const weth = getTokenInfo('WETH');
        const result = await 
            aggregator.querySingleRoute({
                fromToken: usdc,
                toToken: weth,
                fromAmount: parseUnits('1000', usdc.decimals),
                excludePoolTypes: [],
            });

        expect(result.bestAmount > ZERO_BI).toBe(true);
        expect(result.bestPoolPath.length > 0).toBe(true);
        expect(result.bestPath.length > 0).toBe(true);

        expect(result.bestPath[0]).toBe(usdc.address);
        expect(result.bestPath[result.bestPath.length - 1]).toBe(weth.address);
    });

    it('should simulate multi swap succeed', async function () {
        const weth = getTokenInfo('WETH');
        const toToken: Erc20TokenInfo = {
            name: 'well',
            address: '0xa88594d404727625a9437c3f886c7643872296ae',
            symbol: 'well',
            decimals: 18,
        } as Erc20TokenInfo;

        const fromAmount = parseUnits('0.0005', weth.decimals);
        const routeResult = await 
            aggregator.querySplitRoute({
                fromToken: weth,
                toToken,
                fromAmount,
                excludePoolTypes: [],
                isDirect: false,
            });

        const metrics = calculateSwapSlippage({
            inputAmount: fromAmount,
            actualAmountOut: routeResult.bestAmount,
            fromTokenDecimals: weth.decimals,
            toTokenDecimals: toToken.decimals,
            midPrice: routeResult.midPrice,
            slippageInBps: 100,
        });

        expect(metrics.priceImpact).toBeGreaterThan(-1);
        expect(metrics.minReceivedAmount > ZERO_BI).toBe(true);
        expect(routeResult.bestPathInfo.oneHops.length).toBeGreaterThan(0);
        for (const hop of routeResult.bestPathInfo.oneHops) {
            for (const pool of hop.pools) {
                expect(pool.poolAddr).toBeDefined();
                expect(Object.values(PoolType).includes(pool.poolType)).toBe(true);
            }
            for (const weight of hop.weights) {
                expect(weight > ZERO_BI).toBe(true);
            }
        }
    });

    it('should simulate mix swap succeed, eth-usdc', async function () {
        const usdc = getTokenInfo('USDC');

        // USDC -> ETH
        const usdcAmount = parseUnits('10', usdc.decimals);
        const routeUsdcToEth = await aggregator.querySingleRoute({
            fromToken: usdc,
            toToken: ETH_TOKEN,
            fromAmount: usdcAmount,
            excludePoolTypes: [],
        });
        const metricsUsdcToEth = calculateSwapSlippage({
            inputAmount: usdcAmount,
            actualAmountOut: routeUsdcToEth.bestAmount,
            fromTokenDecimals: usdc.decimals,
            toTokenDecimals: ETH_TOKEN.decimals,
            midPrice: routeUsdcToEth.midPrice,
            slippageInBps: 100,
        });
        expect(metricsUsdcToEth.priceImpact).toBeGreaterThan(-1);
        expect(metricsUsdcToEth.minReceivedAmount > ZERO_BI).toBe(true);
        expect(routeUsdcToEth.bestPoolPath.length).toBeGreaterThan(0);

        // ETH -> USDC
        const ethAmount = parseUnits('0.01', ETH_TOKEN.decimals);
        const routeEthToUsdc = await aggregator.querySingleRoute({
            fromToken: ETH_TOKEN,
            toToken: usdc,
            fromAmount: ethAmount,
            excludePoolTypes: [],
        });
        const metricsEthToUsdc = calculateSwapSlippage({
            inputAmount: ethAmount,
            actualAmountOut: routeEthToUsdc.bestAmount,
            fromTokenDecimals: ETH_TOKEN.decimals,
            toTokenDecimals: usdc.decimals,
            midPrice: routeEthToUsdc.midPrice,
            slippageInBps: 100,
        });
        expect(metricsEthToUsdc.priceImpact).toBeGreaterThan(-1);
        expect(metricsEthToUsdc.minReceivedAmount > ZERO_BI).toBe(true);
        expect(routeEthToUsdc.bestPoolPath.length).toBeGreaterThan(0);
    });

    it('should query single route succeed, eth-usdc', async function () {
        const usdc = getTokenInfo('USDC');
        const weth = getTokenInfo('WETH');

        // USDC -> ETH
        const result1 = await aggregator.querySingleRoute({
            fromToken: usdc,
            toToken: ETH_TOKEN,
            fromAmount: parseUnits('100', usdc.decimals),
            excludePoolTypes: [8],
        });

        expect(result1.bestAmount > ZERO_BI).toBe(true);
        expect(result1.bestPoolPath.length > 0).toBe(true);
        expect(result1.bestPath.length > 0).toBe(true);
        expect(result1.bestPath[0]).toBe(usdc.address);
        expect(result1.bestPath[result1.bestPath.length - 1]).toBe(weth.address);

        // ETH -> USDC
        const result2 = await aggregator.querySingleRoute({
            fromToken: ETH_TOKEN,
            toToken: usdc,
            fromAmount: parseUnits('0.1', ETH_TOKEN.decimals),
            excludePoolTypes: [8],
        });

        expect(result2.bestAmount > ZERO_BI).toBe(true);
        expect(result2.bestPoolPath.length > 0).toBe(true);
        expect(result2.bestPath.length > 0).toBe(true);
        expect(result2.bestPath[0]).toBe(weth.address);
        expect(result2.bestPath[result2.bestPath.length - 1]).toBe(usdc.address);
    });

    it('should simulate multi swap succeed, eth-usdc', async function () {
        const usdc = getTokenInfo('USDC');

        // USDC -> ETH
        const usdcAmount = parseUnits('100', usdc.decimals);
        const routeUsdcToEth = await 
            aggregator.querySplitRoute({
                fromToken: usdc,
                toToken: ETH_TOKEN,
                fromAmount: usdcAmount,
                excludePoolTypes: [],
                isDirect: true,
            });
        const metricsUsdcToEth = calculateSwapSlippage({
            inputAmount: usdcAmount,
            actualAmountOut: routeUsdcToEth.bestAmount,
            fromTokenDecimals: usdc.decimals,
            toTokenDecimals: ETH_TOKEN.decimals,
            midPrice: routeUsdcToEth.midPrice,
            slippageInBps: 100,
        });
        expect(metricsUsdcToEth.priceImpact).toBeGreaterThan(-1);
        expect(metricsUsdcToEth.minReceivedAmount > ZERO_BI).toBe(true);
        for (const hop of routeUsdcToEth.bestPathInfo.oneHops) {
            for (const pool of hop.pools) {
                expect(pool.poolAddr).toBeDefined();
                expect(Object.values(PoolType).includes(pool.poolType)).toBe(true);
            }
            for (const weight of hop.weights) {
                expect(weight > ZERO_BI).toBe(true);
            }
        }

        // ETH -> USDC
        const ethAmount = parseUnits('0.01', ETH_TOKEN.decimals);
        const routeEthToUsdc = await aggregator.querySplitRoute({
            fromToken: ETH_TOKEN,
            toToken: usdc,
            fromAmount: ethAmount,
            excludePoolTypes: [],
            isDirect: true,
        });
        const metricsEthToUsdc = calculateSwapSlippage({
            inputAmount: ethAmount,
            actualAmountOut: routeEthToUsdc.bestAmount,
            fromTokenDecimals: ETH_TOKEN.decimals,
            toTokenDecimals: usdc.decimals,
            midPrice: routeEthToUsdc.midPrice,
            slippageInBps: 100,
        });
        expect(metricsEthToUsdc.priceImpact).toBeGreaterThan(-1);
        expect(metricsEthToUsdc.minReceivedAmount > ZERO_BI).toBe(true);
        for (const hop of routeEthToUsdc.bestPathInfo.oneHops) {
            for (const pool of hop.pools) {
                expect(pool.poolAddr).toBeDefined();
                expect(Object.values(PoolType).includes(pool.poolType)).toBe(true);
            }
            for (const weight of hop.weights) {
                expect(weight > ZERO_BI).toBe(true);
            }
        }
    });

    it('should simulate multi swap succeed, eth-usdc, two hops', async function () {
        const usdc = getTokenInfo('USDC');
        const virtualAddress = '0x0b3e328455c4059EEb9e3f84b5543F74E24e7E1b';
        const virtualToken: Erc20TokenInfo = {
            address: virtualAddress,
            symbol: 'VIRTUAL',
            name: 'Virtual Token',
            decimals: 18,
        };

        // USDC -> VIRTUAL
        const usdcAmount = parseUnits('100', usdc.decimals);
        const routeUsdcToVirtual = await aggregator.querySplitRoute({
            fromToken: usdc,
            toToken: virtualToken,
            fromAmount: usdcAmount,
            excludePoolTypes: [],
            isDirect: false,
        });

        const metricsUsdcToVirtual = calculateSwapSlippage({
            inputAmount: usdcAmount,
            actualAmountOut: routeUsdcToVirtual.bestAmount,
            fromTokenDecimals: usdc.decimals,
            toTokenDecimals: virtualToken.decimals,
            midPrice: routeUsdcToVirtual.midPrice,
            slippageInBps: 100,
        });

        expect(metricsUsdcToVirtual.priceImpact).toBeGreaterThan(-1);
        expect(metricsUsdcToVirtual.minReceivedAmount > ZERO_BI).toBe(true);
        expect(routeUsdcToVirtual.bestPathInfo.tokens.length > 1).toBe(true);
        expect(routeUsdcToVirtual.bestPathInfo.tokens[0]).toBe(usdc.address);
        expect(routeUsdcToVirtual.bestPathInfo.tokens[routeUsdcToVirtual.bestPathInfo.tokens.length - 1]).toBe(
            virtualAddress,
        );
        for (const hop of routeUsdcToVirtual.bestPathInfo.oneHops) {
            for (const pool of hop.pools) {
                expect(routeUsdcToVirtual.bestPathInfo.tokens.includes(pool.token0)).toBe(true);
                expect(routeUsdcToVirtual.bestPathInfo.tokens.includes(pool.token1)).toBe(true);
            }
            for (const weight of hop.weights) {
                expect(weight > ZERO_BI).toBe(true);
            }
        }

        // VIRTUAL -> USDC
        const virtualAmount = parseUnits('1', virtualToken.decimals);
        const routeVirtualToUsdc = await aggregator.querySplitRoute({
            fromToken: virtualToken,
            toToken: usdc,
            fromAmount: virtualAmount,
            excludePoolTypes: [],
            isDirect: false,
        });

        const metricsVirtualToUsdc = calculateSwapSlippage({
            inputAmount: virtualAmount,
            actualAmountOut: routeVirtualToUsdc.bestAmount,
            fromTokenDecimals: virtualToken.decimals,
            toTokenDecimals: usdc.decimals,
            midPrice: routeVirtualToUsdc.midPrice,
            slippageInBps: 100,
        });

        expect(metricsVirtualToUsdc.priceImpact).toBeGreaterThan(-1);
        expect(metricsVirtualToUsdc.minReceivedAmount > ZERO_BI).toBe(true);
        expect(routeVirtualToUsdc.bestPathInfo.tokens[0]).toBe(virtualAddress);
        expect(routeVirtualToUsdc.bestPathInfo.tokens[routeVirtualToUsdc.bestPathInfo.tokens.length - 1]).toBe(
            usdc.address,
        );
        for (const hop of routeVirtualToUsdc.bestPathInfo.oneHops) {
            for (const pool of hop.pools) {
                expect(routeVirtualToUsdc.bestPathInfo.tokens.includes(pool.token0)).toBe(true);
                expect(routeVirtualToUsdc.bestPathInfo.tokens.includes(pool.token1)).toBe(true);
            }
            for (const weight of hop.weights) {
                expect(weight > ZERO_BI).toBe(true);
            }
        }
    });

    it.only('should query split route succeed, eth-usdc', async function () {
        const usdc = getTokenInfo('USDC');
        const weth = getTokenInfo('WETH');

        // USDC -> ETH
        const result1 = await aggregator.querySplitRoute({
            fromToken: usdc,
            toToken: ETH_TOKEN,
            fromAmount: parseUnits('100', usdc.decimals),
            excludePoolTypes: [],
            isDirect: true,
        });

        console.log("out:", result1);

        expect(result1.bestAmount > ZERO_BI).toBe(true);
        expect(result1.bestPathInfo.tokens.length).toBe(2);
        expect(result1.bestPathInfo.tokens[0]).toBe(usdc.address);
        expect(result1.bestPathInfo.tokens[1]).toBe(weth.address);
        expect(result1.bestPathInfo.oneHops.length).toBe(1);
        expect(result1.bestAmount === result1.bestPathInfo.finalAmountOut).toBe(true);
        expect(result1.bestPathInfo.isValid).toBe(true);

        for (const hop of result1.bestPathInfo.oneHops) {
            for (const pool of hop.pools) {
                expect(result1.bestPathInfo.tokens.includes(pool.token0)).toBe(true);
                expect(result1.bestPathInfo.tokens.includes(pool.token1)).toBe(true);
            }
            for (const weight of hop.weights) {
                expect(weight > ZERO_BI).toBe(true);
            }
            const totalWeight = hop.weights.reduce((a, b) => a + b, ZERO_BI);
            expect(totalWeight > ZERO_BI).toBe(true);
            expect(totalWeight <= WAD_BI).toBe(true);
        }

        // ETH -> USDC
        const result2 = await aggregator.querySplitRoute({
            fromToken: ETH_TOKEN,
            toToken: usdc,
            fromAmount: parseUnits('0.1', ETH_TOKEN.decimals),
            excludePoolTypes: [],
            isDirect: true,
        });

        expect(result2.bestAmount > ZERO_BI).toBe(true);
        expect(result2.bestPathInfo.tokens.length).toBe(2);
        expect(result2.bestPathInfo.tokens[0]).toBe(weth.address);
        expect(result2.bestPathInfo.tokens[1]).toBe(usdc.address);
        expect(result2.bestPathInfo.oneHops.length).toBe(1);
        expect(result2.bestAmount === result2.bestPathInfo.finalAmountOut).toBe(true);
        expect(result2.bestPathInfo.isValid).toBe(true);

        for (const hop of result2.bestPathInfo.oneHops) {
            for (const pool of hop.pools) {
                expect(result2.bestPathInfo.tokens.includes(pool.token0)).toBe(true);
                expect(result2.bestPathInfo.tokens.includes(pool.token1)).toBe(true);
            }
            for (const weight of hop.weights) {
                expect(weight > ZERO_BI).toBe(true);
            }
            const totalWeight = hop.weights.reduce((a, b) => a + b, ZERO_BI);
            expect(totalWeight > ZERO_BI).toBe(true);
            expect(totalWeight <= WAD_BI).toBe(true);
        }
    });

    it('should query split route succeed, eth-usdc, two hops', async function () {
        const usdc = getTokenInfo('USDC');
        const virtualAddress = '0x0b3e328455c4059EEb9e3f84b5543F74E24e7E1b';
        const weth = getTokenInfo('WETH');
        const virtualToken: Erc20TokenInfo = {
            address: virtualAddress,
            symbol: 'VIRTUAL',
            name: 'Virtual Token',
            decimals: 18,
        };

        // USDC -> virtual
        const result1 = await aggregator.querySplitRoute({
            fromToken: usdc,
            toToken: virtualToken,
            fromAmount: parseUnits('1000', usdc.decimals),
            excludePoolTypes: [],
            isDirect: false,
            specifiedMiddleToken: weth.address
        });

        expect(result1.bestAmount > ZERO_BI).toBe(true);
        expect(result1.bestPathInfo.tokens.length).toBe(3);
        expect(result1.bestPathInfo.tokens[0]).toBe(usdc.address);
        expect(result1.bestPathInfo.tokens[1]).toBe(weth.address);
        expect(result1.bestPathInfo.tokens[2]).toBe(virtualAddress);
        expect(result1.bestPathInfo.oneHops.length).toBe(2);
        expect(result1.bestAmount === result1.bestPathInfo.finalAmountOut).toBe(true);
        expect(result1.bestPathInfo.isValid).toBe(true);

        for (const hop of result1.bestPathInfo.oneHops) {
            for (const pool of hop.pools) {
                expect(result1.bestPathInfo.tokens.includes(pool.token0)).toBe(true);
                expect(result1.bestPathInfo.tokens.includes(pool.token1)).toBe(true);
            }
            for (const weight of hop.weights) {
                expect(weight > ZERO_BI).toBe(true);
            }
            const totalWeight = hop.weights.reduce((a, b) => a + b, ZERO_BI);
            expect(totalWeight > ZERO_BI).toBe(true);
            expect(totalWeight <= WAD_BI).toBe(true);
        }

        // virtual -> USDC
        const result2 = await aggregator.querySplitRoute({
            fromToken: virtualToken,
            toToken: usdc,
            fromAmount: parseUnits('1000', virtualToken.decimals),
            excludePoolTypes: [],
            isDirect: false,
            specifiedMiddleToken: weth.address
        });

        expect(result2.bestAmount > ZERO_BI).toBe(true);
        expect(result2.bestPathInfo.tokens.length).toBe(3);
        expect(result2.bestPathInfo.tokens[0]).toBe(virtualAddress);
        expect(result2.bestPathInfo.tokens[2]).toBe(usdc.address);
        expect(result2.bestPathInfo.oneHops.length).toBe(2);
        expect(result2.bestAmount === result2.bestPathInfo.finalAmountOut).toBe(true);
        expect(result2.bestPathInfo.isValid).toBe(true);

        for (const hop of result2.bestPathInfo.oneHops) {
            for (const pool of hop.pools) {
                expect(result2.bestPathInfo.tokens.includes(pool.token0)).toBe(true);
                expect(result2.bestPathInfo.tokens.includes(pool.token1)).toBe(true);
            }
            for (const weight of hop.weights) {
                expect(weight > ZERO_BI).toBe(true);
            }
            const totalWeight = hop.weights.reduce((a, b) => a + b, ZERO_BI);
            expect(totalWeight > ZERO_BI).toBe(true);
            expect(totalWeight <= WAD_BI).toBe(true);
        }
    });

    it.only('should query split route succeed 1', async function () {
        const usdc = getTokenInfo('USDC');
        const weth = getTokenInfo('WETH');
        const result = await aggregator.querySplitRoute({
            fromToken: usdc,
            toToken: weth,
            fromAmount: parseUnits('100', usdc.decimals),
            excludePoolTypes: [],
            isDirect: true,
        });

        expect(result.bestAmount > ZERO_BI).toBe(true);
        expect(result.bestPathInfo.tokens.length).toBe(2);
        expect(result.bestPathInfo.tokens[0]).toBe(usdc.address);
        expect(result.bestPathInfo.tokens[1]).toBe(weth.address);
        expect(result.bestPathInfo.oneHops.length).toBe(1);

        expect(result.bestPathInfo.tokens.length > 0).toBe(true);
        expect(result.bestPathInfo.tokens[0]).toBe(usdc.address);
        expect(result.bestPathInfo.tokens[result.bestPathInfo.tokens.length - 1]).toBe(weth.address);
        expect(result.bestAmount === result.bestPathInfo.finalAmountOut).toBe(true);
        expect(result.bestPathInfo.isValid).toBe(true);

        for (const hop of result.bestPathInfo.oneHops) {
            for (const pool of hop.pools) {
                // token0 and token1 should be in the bestPathInfo.tokens array
                expect(result.bestPathInfo.tokens.includes(pool.token0)).toBe(true);
                expect(result.bestPathInfo.tokens.includes(pool.token1)).toBe(true);
            }
            for (const weight of hop.weights) {
                expect(weight > ZERO_BI).toBe(true);
            }
            const totalWeight = hop.weights.reduce((a, b) => a + b, ZERO_BI);
            expect(totalWeight > ZERO_BI).toBe(true);
            expect(totalWeight <= WAD_BI).toBe(true);
        }
    });

    it.only('should query split route succeed 2', async function () {
        const usdc = getTokenInfo('USDC');
        const weth = getTokenInfo('WETH');
        const result = await aggregator.querySplitRoute({
            fromToken: usdc,
            toToken: weth,
            fromAmount: parseUnits('100', usdc.decimals),
            excludePoolTypes: [PoolType.OYSTER],
            isDirect: false,
        });

        expect(result.bestAmount > ZERO_BI).toBe(true);
        expect(result.bestPathInfo.tokens.length > 0).toBe(true);
        expect(result.bestPathInfo.tokens[0]).toBe(usdc.address);
        expect(result.bestPathInfo.tokens[result.bestPathInfo.tokens.length - 1]).toBe(weth.address);
        expect(result.bestAmount === result.bestPathInfo.finalAmountOut).toBe(true);
        expect(result.bestPathInfo.isValid).toBe(true);

        for (const hop of result.bestPathInfo.oneHops) {
            for (const pool of hop.pools) {
                // token0 and token1 should be in the bestPathInfo.tokens array
                expect(result.bestPathInfo.tokens.includes(pool.token0)).toBe(true);
                expect(result.bestPathInfo.tokens.includes(pool.token1)).toBe(true);
            }
            for (const weight of hop.weights) {
                expect(weight > ZERO_BI).toBe(true);
            }
            const totalWeight = hop.weights.reduce((a, b) => a + b, ZERO_BI);
            expect(totalWeight > ZERO_BI).toBe(true);
            expect(totalWeight <= WAD_BI).toBe(true);
        }
    });

    it('should get pool liquidity succeed', async function () {
        const token0 = getTokenInfo('WETH');
        // console.log(token0);
        /*
        const token1 = {
            name: 'Oliver',
            address: '0x0bd9158d09c31ad794fa1ba7c05d50e27c29de60',
            symbol: 'OLI',
            decimals: 18,
        };
        */
        const token1 = getTokenInfo('USDC');
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
        const usdc = getTokenInfo('USDC');
        const weth = getTokenInfo('WETH');
        // {
        //     name: 'USDT',
        //     address: '0xfde4C96c8593536E31F229EA8f37b2ADa2699bb2',
        //     symbol: 'USDT',
        //     decimals: 6,
        // };
        
        const amount = parseUnits('1000', usdc.decimals);

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
            brokerFeeRate: ZERO_BI,
            userParams: {
                slippageInBps: 100, // 1%
                deadline: Math.floor(Date.now() / 1000) + 5 * 60, // 5 minutes from now,
            },
        });

        expect(rawTx).toBeDefined();
        expect(rawTx?.to).toBeDefined();
        expect(rawTx?.data).toBeDefined();
    });

    it('should trade to price succeed', async function () {
        const weth = getTokenInfo('WETH');
        const usdc = getTokenInfo('USDC');
        const pools = await aggregator.getPoolList(weth.address, usdc.address);
        expect(pools.length).toBeGreaterThan(0);
        const poolAddress = pools[0].poolAddr;

        const slot0Result = await publicClient.call({
            to: poolAddress,
            data: encodeFunctionData({
                abi: POOL_ABI,
                functionName: 'slot0',
            }),
        });
        const slot0Decoded = decodeResult<
            readonly [bigint, number, number, number, number, number, boolean]
        >(slot0Result, POOL_ABI, 'slot0');
        const currentTick = Number(slot0Decoded[1]);

        // Calculate current price from tick using tickToWad
        const currentPriceWad = tickToWad(currentTick);

        // get token0 and token1 decimals
        const token0Result = await publicClient.call({
            to: poolAddress,
            data: encodeFunctionData({
                abi: POOL_ABI,
                functionName: 'token0',
            }),
        });
        const token0 = decodeResult<string>(token0Result, POOL_ABI, 'token0');
        const token1Result = await publicClient.call({
            to: poolAddress,
            data: encodeFunctionData({
                abi: POOL_ABI,
                functionName: 'token1',
            }),
        });
        const token1 = decodeResult<string>(token1Result, POOL_ABI, 'token1');
        const token0DecimalsResult = await publicClient.call({
            to: token0,
            data: encodeFunctionData({
                abi: ERC20_ABI,
                functionName: 'decimals',
            }),
        });
        const token0Decimals = Number(
            decodeResult<number | bigint>(token0DecimalsResult, ERC20_ABI, 'decimals'),
        );
        const token1DecimalsResult = await publicClient.call({
            to: token1,
            data: encodeFunctionData({
                abi: ERC20_ABI,
                functionName: 'decimals',
            }),
        });
        const token1Decimals = Number(
            decodeResult<number | bigint>(token1DecimalsResult, ERC20_ABI, 'decimals'),
        );

        // Adjust price by 2% upward (buying token1/USDC with token0/WMON)
        const token0Scale = 10n ** BigInt(token0Decimals);
        const token1Scale = 10n ** BigInt(token1Decimals);
        const targetPriceWad = (((currentPriceWad * token0Scale) / token1Scale) * 998n) / 1000n; // +0.5%
        console.log('targetPriceWad', targetPriceWad.toString());

        // targetPriceWad is already in 18 decimal format (WAD)
        const targetPrice = targetPriceWad;

        console.log('Price calculation:', {
            currentTick,
            currentPriceWad: currentPriceWad.toString(),
            targetPriceWad: targetPriceWad.toString(),
            targetPrice: targetPrice.toString(),
            poolAddress,
        });
    });

});
