import { CallOverrides, ethers } from 'ethers';
import { CHAIN_ID, Context } from '@derivation-tech/context';
import { ConfigInterface } from './config.interface';

export class ConfigModule implements ConfigInterface {
    context: Context;

    constructor(context: Context) {
        this.context = context;
    }

    async inWhiteListLps(quoteAddr: string, traders: string[], overrides?: CallOverrides): Promise<boolean[]> {
        let calls = [];
        let results: boolean[] = [];
        let configInterface: ethers.utils.Interface = this.context.perp.contracts.config.interface;
        if ((this.context.chainId === CHAIN_ID.BASE || this.context.chainId === CHAIN_ID.LOCAL) && quoteAddr) {
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
        }
        // legacy function for other networks
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

    async openLp(quoteAddr?: string, overrides?: CallOverrides): Promise<boolean> {
        if ((this.context.chainId === CHAIN_ID.BASE || this.context.chainId === CHAIN_ID.LOCAL) && quoteAddr) {
            try {
                const restricted = await this.context.perp.contracts.config.restrictLp(quoteAddr, overrides ?? {});
                return !restricted;
                // eslint-disable-next-line @typescript-eslint/no-unused-vars
            } catch (e) {
                // ignore error since the contract on some network may not have this function
            }
        }
        return this.context.perp.contracts.config.openLp(overrides ?? {});
    }
}
