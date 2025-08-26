/**
 * Helper functions to determine which ABI version to use based on chain ID
 */

import { CHAIN_ID } from '@derivation-tech/context';

/**
 * Networks that use the legacy ABI version (with stabilityFeeRatioParam in QuoteParam)
 * These are networks that were deployed before the QuoteParam structure was updated
 */
const LEGACY_NETWORKS = [
    CHAIN_ID.BASE,   // Base network
    CHAIN_ID.BLAST,  // Blast network
];

/**
 * Check if a chain uses the legacy ABI version
 * @param chainId - The chain ID to check
 * @returns true if the chain uses legacy ABI, false for current ABI
 */
export function isLegacyChain(chainId: number): boolean {
    return LEGACY_NETWORKS.includes(chainId);
}

/**
 * Get the ABI version string for a given chain
 * @param chainId - The chain ID
 * @returns 'legacy' or 'current'
 */
export function getAbiVersion(chainId: number): 'legacy' | 'current' {
    return isLegacyChain(chainId) ? 'legacy' : 'current';
}