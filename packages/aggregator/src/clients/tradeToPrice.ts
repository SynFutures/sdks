import { tickToWad, tickToSqrtX96, wadToTick } from '../math';
import { formatUnits as formatUnitsViem, parseAbi, parseUnits } from 'viem';
import { ERC20_ABI, type Erc20TokenInfo } from '@derivation-tech/viem-kit';
import QuoterV2ABI from '../abis/QuoterV2.json';
import {
    ZERO_ADDRESS,
    ZERO_BI,
    RATIO_BASE_BI,
    toWrappedETH,
} from '../utils';
import { AggregatorModule, type AggregatorModuleOptions } from './aggregator';
import type { TradeToPriceInput } from '../types/frontEnd';
import type { TransactionRequest } from '../types/contract';
import { PoolType } from '../types/contract';

// these two abi won't be used outside this file.
const POOL_ABI = parseAbi([
    'function token0() view returns (address)',
    'function token1() view returns (address)',
    'function fee() view returns (uint24)',
    'function slot0() view returns (uint160 sqrtPriceX96, int24 tick, uint16 observationIndex, uint16 observationCardinality, uint16 observationCardinalityNext, uint8 feeProtocol, bool unlocked)',
]);

const ADAPTER_QUOTER_ABI = parseAbi(['function quoterV2() view returns (address)']);

export type TradeToPriceInit = AggregatorModule | AggregatorModuleOptions;

const createTokenInfo = (address: string, decimals: number, symbol = 'UNKNOWN', name = 'UNKNOWN'): Erc20TokenInfo => ({
    address,
    decimals,
    symbol,
    name,
}) as Erc20TokenInfo;

export class TradeToPrice {
    private readonly aggregator: AggregatorModule;
    private initialized = false;

    constructor(options: TradeToPriceInit) {
        this.aggregator = options instanceof AggregatorModule ? options : new AggregatorModule(options);
    }

    async init(): Promise<void> {
        await this.ensureInitialized();
    }

    private async ensureInitialized(): Promise<void> {
        if (!this.initialized) {
            await this.aggregator.init();
            this.initialized = true;
        }
    }

    async trade(params: TradeToPriceInput): Promise<TransactionRequest[]> {
        await this.ensureInitialized();

        const { poolAddress, targetPrice, userAddress } = params;

        const slippageInBps = 200; // 2%
        const broker = ZERO_ADDRESS;
        const brokerFeeRate = ZERO_BI;
        const deadline = Math.floor(Date.now() / 1000) + 300; // Current time + 300 seconds

        const publicClient = this.aggregator.getPublicClientInstance();
        const poolAddr = poolAddress as `0x${string}`;

        const [poolToken0Address, poolToken1Address, poolFeeRaw, slot0Raw] = await Promise.all([
            publicClient.readContract({ address: poolAddr, abi: POOL_ABI, functionName: 'token0' } as any),
            publicClient.readContract({ address: poolAddr, abi: POOL_ABI, functionName: 'token1' } as any),
            publicClient.readContract({ address: poolAddr, abi: POOL_ABI, functionName: 'fee' } as any),
            publicClient.readContract({ address: poolAddr, abi: POOL_ABI, functionName: 'slot0' } as any),
        ]);

        const slot0Data = slot0Raw as any;
        const currentTick = Number(slot0Data.tick ?? slot0Data[1]);
        const poolFee = Number(poolFeeRaw);

        let token0Address = poolToken0Address as string;
        let token1Address = poolToken1Address as string;

        const wrappedNativeTokenAddress = this.aggregator.getWrappedNativeTokenAddress();

        if (token0Address.toLowerCase() === wrappedNativeTokenAddress.toLowerCase()) {
            token0Address = ZERO_ADDRESS;
        }
        if (token1Address.toLowerCase() === wrappedNativeTokenAddress.toLowerCase()) {
            token1Address = ZERO_ADDRESS;
        }

        const [token0DecimalsRaw, token1DecimalsRaw] = await Promise.all([
            publicClient.readContract({
                address: poolToken0Address as `0x${string}`,
                abi: ERC20_ABI as any,
                functionName: 'decimals',
            } as any),
            publicClient.readContract({
                address: poolToken1Address as `0x${string}`,
                abi: ERC20_ABI as any,
                functionName: 'decimals',
            } as any),
        ]);

        const token0Decimals = Number(token0DecimalsRaw);
        const token1Decimals = Number(token1DecimalsRaw);

        const adapterAddress = await this.aggregator.getPoolAdapter(PoolType.OYSTER_NEW);
        const quoterAddress = await publicClient.readContract({
            address: adapterAddress as `0x${string}`,
            abi: ADAPTER_QUOTER_ABI,
            functionName: 'quoterV2',
        } as any);

        if (!quoterAddress || quoterAddress === ZERO_ADDRESS) {
            throw new Error('Invalid quoterV2 address from adapter');
        }

        const quoter = quoterAddress as `0x${string}`;
        const aggregatorAddress = this.aggregator.getOysterAggregatorAddress();
        const transactions: TransactionRequest[] = [];

        const currentPrice = tickToWad(currentTick);
        const wrappedToken0 = toWrappedETH(wrappedNativeTokenAddress, token0Address);
        const wrappedToken1 = toWrappedETH(wrappedNativeTokenAddress, token1Address);

        const simulateQuote = async (paramsStruct: {
            tokenIn: `0x${string}`;
            tokenOut: `0x${string}`;
            amount: bigint;
            fee: number;
            sqrtPriceLimitX96: bigint;
        }) => {
            const simulation = await publicClient.simulateContract({
                address: quoter,
                abi: QuoterV2ABI as any,
                functionName: 'quoteExactOutputSingle',
                args: [paramsStruct],
                account: ZERO_ADDRESS as `0x${string}`,
            } as any);
            return simulation.result as any;
        };

        if (typeof targetPrice === 'bigint') {
            const scaleToken1 = 10n ** BigInt(token1Decimals);
            const scaleToken0 = 10n ** BigInt(token0Decimals);
            const poolFormatTargetPrice = (targetPrice * scaleToken1) / scaleToken0;
            if (poolFormatTargetPrice <= 0n) {
                throw new Error('Target price must be greater than zero');
            }

            const isBuyingToken1 = poolFormatTargetPrice > currentPrice;
            const fromToken = isBuyingToken1 ? wrappedToken1 : wrappedToken0;
            const toToken = isBuyingToken1 ? wrappedToken0 : wrappedToken1;

            const targetTick = wadToTick(poolFormatTargetPrice);
            const sqrtPriceLimitX96 = tickToSqrtX96(targetTick);

            const quoteResult = await simulateQuote({
                tokenIn: fromToken as `0x${string}`,
                tokenOut: toToken as `0x${string}`,
                amount: parseUnits('1000000', 18),
                fee: poolFee,
                sqrtPriceLimitX96,
            });

            const requiredAmountIn = BigInt(quoteResult?.amountIn ?? quoteResult?.[0] ?? 0n);
            if (requiredAmountIn <= 0n) {
                throw new Error('Invalid required amount from quoterV2');
            }

            const originalFromToken = isBuyingToken1 ? token1Address : token0Address;
            const originalToToken = isBuyingToken1 ? token0Address : token1Address;

            if (originalFromToken.toLowerCase() !== ZERO_ADDRESS.toLowerCase()) {
                const allowance = (await publicClient.readContract({
                    address: fromToken as `0x${string}`,
                    abi: ERC20_ABI as any,
                    functionName: 'allowance',
                    args: [userAddress as `0x${string}`, aggregatorAddress as `0x${string}`],
                } as any)) as bigint;

                if (allowance < requiredAmountIn) {
                    throw new Error(
                        `Insufficient allowance for ${fromToken}. Required: ${formatUnitsViem(requiredAmountIn, 18)}, Available: ${formatUnitsViem(allowance, 18)}. Please approve first.`,
                    );
                }
            }

            const fromTokenInfo = createTokenInfo(fromToken, isBuyingToken1 ? token1Decimals : token0Decimals);
            const toTokenInfo = createTokenInfo(toToken, isBuyingToken1 ? token0Decimals : token1Decimals);
            const originalFromTokenInfo = createTokenInfo(
                originalFromToken,
                isBuyingToken1 ? token1Decimals : token0Decimals,
            );
            const originalToTokenInfo = createTokenInfo(originalToToken, isBuyingToken1 ? token0Decimals : token1Decimals);

        const routeResult = await this.aggregator.queryOnePoolRoute({
            fromToken: fromTokenInfo,
            toToken: toTokenInfo,
            fromAmount: requiredAmountIn,
            poolAddress,
        });

        const tx = await this.aggregator.encodeMultiSwapData({
            fromToken: originalFromTokenInfo,
            toToken: originalToTokenInfo,
            fromTokenAmount: requiredAmountIn,
            bestPathInfo: routeResult.bestPathInfo,
            bestAmount: routeResult.bestAmount,
            broker,
            brokerFeeRate,
            userParams: {
                slippageInBps,
                deadline,
            },
        });

            transactions.push(tx);
        } else {
            const token0Balance =
                token0Address === ZERO_ADDRESS
                    ? await publicClient.getBalance({ address: userAddress as `0x${string}` })
                    : ((await publicClient.readContract({
                          address: poolToken0Address as `0x${string}`,
                          abi: ERC20_ABI as any,
                          functionName: 'balanceOf',
                          args: [userAddress as `0x${string}`],
                      } as any)) as bigint);

            const token1Balance =
                token1Address === ZERO_ADDRESS
                    ? await publicClient.getBalance({ address: userAddress as `0x${string}` })
                    : ((await publicClient.readContract({
                          address: poolToken1Address as `0x${string}`,
                          abi: ERC20_ABI as any,
                          functionName: 'balanceOf',
                          args: [userAddress as `0x${string}`],
                      } as any)) as bigint);

            const useToken0First = token0Balance > token1Balance;
            const firstToken = useToken0First ? wrappedToken0 : wrappedToken1;
            const secondToken = useToken0First ? wrappedToken1 : wrappedToken0;
            const firstTokenDecimals = useToken0First ? token0Decimals : token1Decimals;
            const secondTokenDecimals = useToken0First ? token1Decimals : token0Decimals;
            const firstTokenBalance = useToken0First ? token0Balance : token1Balance;
            const firstTokenInfo = createTokenInfo(firstToken, firstTokenDecimals);
            const secondTokenInfo = createTokenInfo(secondToken, secondTokenDecimals);

            const priceImpactBps = 20n;
            const targetPriceForImpact = useToken0First
                ? (currentPrice * (RATIO_BASE_BI - priceImpactBps)) / RATIO_BASE_BI
                : (currentPrice * (RATIO_BASE_BI + priceImpactBps)) / RATIO_BASE_BI;

            const targetTick = wadToTick(targetPriceForImpact);
            const sqrtPriceLimitX96 = tickToSqrtX96(targetTick);

            let requiredAmountForPriceImpact = 0n;
            try {
                const quoteResult = await simulateQuote({
                    tokenIn: firstToken as `0x${string}`,
                    tokenOut: secondToken as `0x${string}`,
                    amount: parseUnits('1000000', 18),
                    fee: poolFee,
                    sqrtPriceLimitX96,
                });
                requiredAmountForPriceImpact = BigInt(quoteResult?.amountIn ?? quoteResult?.[0] ?? 0n);
            } catch (error) {
                console.warn('Failed to calculate price impact amount, using fallback:', (error as Error).message);
            }

            if (requiredAmountForPriceImpact === 0n) {
                const minAmount = parseUnits('0.01', firstTokenDecimals);
                const onePercent = firstTokenBalance / 100n;
                requiredAmountForPriceImpact = onePercent > minAmount ? onePercent : minAmount;
            }

            const reservedBalance =
                token0Address.toLowerCase() === ZERO_ADDRESS.toLowerCase() ||
                token1Address.toLowerCase() === ZERO_ADDRESS.toLowerCase()
                    ? parseUnits('0.01', 18)
                    : 0n;

            const availableBalance = firstTokenBalance > reservedBalance ? firstTokenBalance - reservedBalance : 0n;
            const tradeAmount =
                availableBalance < requiredAmountForPriceImpact ? availableBalance : requiredAmountForPriceImpact;

            if (tradeAmount === 0n) {
                return transactions;
            }

            const originalFirstToken = useToken0First ? token0Address : token1Address;
            const originalSecondToken = useToken0First ? token1Address : token0Address;
            const originalFirstTokenInfo = createTokenInfo(originalFirstToken, firstTokenDecimals);
            const originalSecondTokenInfo = createTokenInfo(originalSecondToken, secondTokenDecimals);
            const isFirstTokenNative = originalFirstToken.toLowerCase() === ZERO_ADDRESS.toLowerCase();

            if (!isFirstTokenNative) {
                const allowance = (await publicClient.readContract({
                    address: firstToken as `0x${string}`,
                    abi: ERC20_ABI as any,
                    functionName: 'allowance',
                    args: [userAddress as `0x${string}`, aggregatorAddress as `0x${string}`],
                } as any)) as bigint;

                if (allowance < tradeAmount) {
                    throw new Error(
                        `Insufficient allowance for ${firstToken}. Required: ${formatUnitsViem(tradeAmount, firstTokenDecimals)}, Available: ${formatUnitsViem(allowance, firstTokenDecimals)}. Please approve first.`,
                    );
                }
            }

        const firstRoute = await this.aggregator.queryOnePoolRoute({
                fromToken: firstTokenInfo,
                toToken: secondTokenInfo,
                fromAmount: tradeAmount,
                poolAddress,
            });

        const firstTx = await this.aggregator.encodeMultiSwapData({
            fromToken: originalFirstTokenInfo,
            toToken: originalSecondTokenInfo,
            fromTokenAmount: tradeAmount,
            bestPathInfo: firstRoute.bestPathInfo,
            bestAmount: firstRoute.bestAmount,
            broker,
            brokerFeeRate,
            userParams: {
                slippageInBps,
                deadline,
            },
        });
            transactions.push(firstTx);

        const secondRoute = await this.aggregator.queryOnePoolRoute({
                fromToken: secondTokenInfo,
                toToken: firstTokenInfo,
                fromAmount: firstRoute.bestAmount,
                poolAddress,
            });

        const secondTx = await this.aggregator.encodeMultiSwapData({
            fromToken: originalSecondTokenInfo,
            toToken: originalFirstTokenInfo,
            fromTokenAmount: firstRoute.bestAmount,
            bestPathInfo: secondRoute.bestPathInfo,
            bestAmount: secondRoute.bestAmount,
            broker,
            brokerFeeRate,
            userParams: {
                slippageInBps,
                deadline,
            },
        });
            transactions.push(secondTx);
        }

        return transactions;
    }
}
