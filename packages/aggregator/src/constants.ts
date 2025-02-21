import { CHAIN_ID } from '@derivation-tech/context';

export const ETH_ADDRESS = '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE';

export const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';

export const CONFIG_ADDRESS: { [chainId: number]: string } = {
    [CHAIN_ID.BASE]: '0xA9A78c647561A3823F1E48b4e151318Ed42C4eC4',
};

export const QUERY_SINGLE_ROUTE_ADDRESS: { [chainId: number]: string } = {
    [CHAIN_ID.BASE]: '0x57C2beA8e020af706f737836061F23ca1E9fd8a5',
};

export const QUERY_SPLIT_ROUTE_ADDRESS: { [chainId: number]: string } = {
    [CHAIN_ID.BASE]: '0x7920151b7C326072b2Ad2e466CeE3Bc389D15aa6',
};

export const OYSTER_AGGREGATOR_ADDRESS: { [chainId: number]: string } = {
    [CHAIN_ID.BASE]: '0x58d4adD76f2Ad83C2996f06fcd22b0f15FfBC725',
};
