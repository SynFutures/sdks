import { parseAbiParameters } from 'viem';
import { zeroAddress } from 'viem';
import { ChainKitRegistry } from '@derivation-tech/viem-kit';

export const ETH_ADDRESS = '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE';

export const ZERO_ADDRESS = zeroAddress;

const BASE_CHAIN_ID = ChainKitRegistry.for('base').chain.id;
const MONAD_TESTNET_CHAIN_ID = ChainKitRegistry.for('monadTestnet').chain.id;

export const CONFIG_ADDRESS: { [chainId: number]: string } = {
    [BASE_CHAIN_ID]: '0xA9A78c647561A3823F1E48b4e151318Ed42C4eC4',
    [MONAD_TESTNET_CHAIN_ID]: '0x619fae164701e536Be8e1D3A6aaEf35DC7A40fc7',
};

export const QUERY_SINGLE_ROUTE_ADDRESS: { [chainId: number]: string } = {
    [BASE_CHAIN_ID]: '0x57C2beA8e020af706f737836061F23ca1E9fd8a5',
    [MONAD_TESTNET_CHAIN_ID]: '0xB03bB95FAA5DC18D66FAd10A38529f1430bd32e0',
};

export const QUERY_SPLIT_ROUTE_ADDRESS: { [chainId: number]: string } = {
    [BASE_CHAIN_ID]: '0x0DE5690A91c559d520A075792DCa1405ebA9ED33',
    [MONAD_TESTNET_CHAIN_ID]: '0x7a7278dd84B5E63Ada2a4cE3F846b2FF66Fd3cf7',
};

export const OYSTER_AGGREGATOR_ADDRESS: { [chainId: number]: string } = {
    [BASE_CHAIN_ID]: '0x58d4adD76f2Ad83C2996f06fcd22b0f15FfBC725',
    [MONAD_TESTNET_CHAIN_ID]: '0xEf8DD29d887EcD977064Ce169366C95d53926B13',
};

export const BROKER_FEE_PARAMS = parseAbiParameters('address,uint256');

export const MULTISWAP_SEQUENCE_PARAMS = parseAbiParameters('address,address,uint256,bytes');

export const ZERO_BI = 0n;

export const ONE_BI = 1n;

export const WAD_BI = 10n ** 18n;

export const RATIO_BASE_BI = 10000n;
