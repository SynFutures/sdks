import { CallOverrides, ethers } from 'ethers';
import { CHAIN_ID, Context } from '@derivation-tech/context';
import { ConfigInterface } from './config.interface';
import { Config as LegacyConfig } from 'src/typechain';

export class ConfigModule implements ConfigInterface {
    context: Context;

    LEGACY_NETWORKS = [
        CHAIN_ID.ARBITRUM,
        CHAIN_ID.BLAST,
        CHAIN_ID.BLASTSEPOLIA,
        CHAIN_ID.GOERLI,
        CHAIN_ID.LINEA,
        CHAIN_ID.POLYGON,
        CHAIN_ID.SCROLL,
    ];

    constructor(context: Context) {
        this.context = context;
    }

    async inWhiteListLps(quoteAddr: string, traders: string[], overrides?: CallOverrides): Promise<boolean[]> {
        let calls = [];
        let results: boolean[] = [];
        let configInterface: ethers.utils.Interface = this.context.perp.contracts.config.interface;

        // legacy function for networks that use the legacy ABI version
        if (this.LEGACY_NETWORKS.includes(this.context.chainId)) {
            calls = [];
            results = [];
            configInterface = new ethers.utils.Interface([
                'function lpWhitelist(address user) external view returns (bool)',
            ]);

            for (const trader of traders) {
                calls.push({
                    target: this.context.perp.contracts.config.address,
                    callData: configInterface.encodeFunctionData('lpWhitelist', [trader]),
                });
            }
            const rawData = await this.context.multiCall3.callStatic.aggregate(calls, overrides ?? {});
            for (const data of rawData.returnData) {
                results.push(configInterface.decodeFunctionResult('lpWhitelist', data)[0]);
            }
            return results;
        }

        for (const trader of traders) {
            calls.push({
                target: this.context.perp.contracts.config.address,
                callData: configInterface.encodeFunctionData('lpWhitelist', [quoteAddr, trader]),
            });
        }
        try {
            const rawData = await this.context.multiCall3.callStatic.aggregate(calls, overrides ?? {});
            for (const data of rawData.returnData) {
                results.push(configInterface.decodeFunctionResult('lpWhitelist', data)[0]);
            }
            return results;
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
        } catch (e) {
            // ignore error since the contract on some network may not have this function
        }
        return [];
    }

    async openLp(quoteAddr?: string, overrides?: CallOverrides): Promise<boolean> {
        if (this.LEGACY_NETWORKS.includes(this.context.chainId)) {
            return (this.context.perp.contracts.config as LegacyConfig).openLp(overrides ?? {});
        }

        if (quoteAddr) {
            try {
                const restricted = await this.context.perp.contracts.config.restrictLp(quoteAddr, overrides ?? {});
                return !restricted;
                // eslint-disable-next-line @typescript-eslint/no-unused-vars
            } catch (e) {
                // ignore error since the contract on some network may not have this function
            }
        }
        return false;
    }
}
