import { ChainKitRegistry, type Erc20TokenInfo } from '@derivation-tech/viem-kit';
import { TradeToPrice, AggregatorModule } from '../src';
import * as dotenv from 'dotenv';
dotenv.config();

describe('TradeToPrice client', function () {
    let chainKit: ReturnType<typeof ChainKitRegistry['for']>;
    let aggregator: AggregatorModule;
    let tradeToPriceClient: TradeToPrice;

    const getTokenInfo = (symbolOrAddress: string): Erc20TokenInfo => {
        if (!chainKit) {
            throw new Error('ChainKit not initialized');
        }
        const isAddressInput = symbolOrAddress.startsWith('0x');
        const canonicalSymbol = !isAddressInput && symbolOrAddress === 'WETH' ? 'WMON' : symbolOrAddress;
        let info = chainKit.getErc20TokenInfo(canonicalSymbol);
        if (canonicalSymbol === 'WETH' || canonicalSymbol === 'WMON') info = chainKit.wrappedNativeTokenInfo;
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
        chainKit = ChainKitRegistry.for('monadTestnet');
        aggregator = new AggregatorModule({
            chainId: chainKit.chain.id,
            rpcUrl: process.env.MONAD_RPC!,
        });
        await aggregator.init();
        tradeToPriceClient = new TradeToPrice(aggregator);
    });

    it('should trade to price with default behavior (buy then sell)', async function () {
        const weth = getTokenInfo('WETH');
        const usdc = getTokenInfo('USDC');
        const pools = await aggregator.getPoolList(weth.address, usdc.address);
        expect(pools.length).toBeGreaterThan(0);
        const poolAddress = pools[0].poolAddr;
        const userAddress = '0x5a5ed56cff810e2cbdc105c5dc3044841564a564';

        const result = await tradeToPriceClient.trade({
            poolAddress: poolAddress,
            userAddress: userAddress,
        });

        expect(Array.isArray(result)).toBe(true);
        if (result.length > 0) {
            expect(result[0].data).toBeDefined();
            expect(result[0].to).toBeDefined();
        }
    });

    it('should initialize its own aggregator when given options', async function () {
        const poolAddress = ''; // base pool
        const userAddress = '0x5a5ed56cff810e2cbdc105c5dc3044841564a564';

        const autonomousTradeToPrice = new TradeToPrice({
            chainId: chainKit.chain.id,
            rpcUrl: process.env.BASE_RPC!,
        });

        const result = await autonomousTradeToPrice.trade({
            poolAddress,
            userAddress,
        });

        expect(Array.isArray(result)).toBe(true);
    });
});
