/**
 * ABI Selector - Selects the correct ABI based on chain ID
 *
 * This module handles the selection of appropriate ABI versions for different networks.
 * - Legacy networks (Base, Blast): Use ABIs with stabilityFeeRatioParam in QuoteParam
 * - Current networks (others): Use ABIs without stabilityFeeRatioParam in QuoteParam
 */

import { isLegacyChain } from './versionHelper';

// Import legacy ABIs (with stabilityFeeRatioParam)
import LegacyGateABI from '../abis/Gate.json';
import LegacyObserverABI from '../abis/Observer.json';
import LegacyConfigABI from '../abis/Config.json';
import LegacyInstrumentABI from '../abis/Instrument.json';

// Import current ABIs (without stabilityFeeRatioParam)
import CurrentGateABI from '../abis/current/Gate.json';
import CurrentObserverABI from '../abis/current/Observer.json';
import CurrentConfigABI from '../abis/current/Config.json';
import CurrentInstrumentABI from '../abis/current/Instrument.json';

// Import common ABIs (unchanged between versions)
import CexMarketABI from '../abis/CexMarket.json';
import DexV2MarketABI from '../abis/DexV2Market.json';

export interface ABISet {
    Gate: any;
    Observer: any;
    Config: any;
    Instrument: any;
    CexMarket: any;
    DexV2Market: any;
}

/**
 * Get the appropriate ABI set for a given chain ID
 * @param chainId - The chain ID
 * @returns The ABI set for the chain
 */
export function getABISet(chainId: number): ABISet {
    const useLegacy = isLegacyChain(chainId);

    return {
        Gate: useLegacy ? LegacyGateABI : CurrentGateABI,
        Observer: useLegacy ? LegacyObserverABI : CurrentObserverABI,
        Config: useLegacy ? LegacyConfigABI : CurrentConfigABI,
        Instrument: useLegacy ? LegacyInstrumentABI : CurrentInstrumentABI,
        // These ABIs are the same for both versions
        CexMarket: CexMarketABI,
        DexV2Market: DexV2MarketABI,
    };
}

/**
 * Get a specific ABI for a given chain ID
 * @param chainId - The chain ID
 * @param contractName - The contract name
 * @returns The ABI for the contract on the specified chain
 */
export function getABI(chainId: number, contractName: keyof ABISet): any {
    const abiSet = getABISet(chainId);
    return abiSet[contractName];
}