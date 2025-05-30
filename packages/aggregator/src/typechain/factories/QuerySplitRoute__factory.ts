/* Autogenerated file. Do not edit manually. */
/* tslint:disable */

import { Contract, Signer, utils } from 'ethers';
import type { Provider } from '@ethersproject/providers';
import type { QuerySplitRoute, QuerySplitRouteInterface } from '../QuerySplitRoute';

const _abi = [
    {
        type: 'constructor',
        inputs: [
            {
                name: '_config',
                type: 'address',
                internalType: 'contract Config',
            },
        ],
        stateMutability: 'nonpayable',
    },
    {
        type: 'function',
        name: 'config',
        inputs: [],
        outputs: [
            {
                name: '',
                type: 'address',
                internalType: 'contract Config',
            },
        ],
        stateMutability: 'view',
    },
    {
        type: 'function',
        name: 'querySplitRoute',
        inputs: [
            {
                name: 'fromToken',
                type: 'address',
                internalType: 'address',
            },
            {
                name: 'toToken',
                type: 'address',
                internalType: 'address',
            },
            {
                name: 'fromAmount',
                type: 'uint256',
                internalType: 'uint256',
            },
            {
                name: 'isDirect',
                type: 'bool',
                internalType: 'bool',
            },
            {
                name: 'dexFlagAndSplits',
                type: 'uint256',
                internalType: 'uint256',
            },
            {
                name: 'specifiedMiddleToken',
                type: 'address',
                internalType: 'address',
            },
        ],
        outputs: [
            {
                name: 'resAmount',
                type: 'tuple',
                internalType: 'struct LibTypes.ResultAmount',
                components: [
                    {
                        name: 'bestAmount',
                        type: 'uint256',
                        internalType: 'uint256',
                    },
                    {
                        name: 'midPrice',
                        type: 'uint256',
                        internalType: 'uint256',
                    },
                ],
            },
            {
                name: 'bestPathInfo',
                type: 'tuple',
                internalType: 'struct LibTypes.SplitPathInfo',
                components: [
                    {
                        name: 'tokens',
                        type: 'address[]',
                        internalType: 'address[]',
                    },
                    {
                        name: 'oneHops',
                        type: 'tuple[]',
                        internalType: 'struct LibTypes.OneHop[]',
                        components: [
                            {
                                name: 'pools',
                                type: 'tuple[]',
                                internalType: 'struct LibTypes.Pair[]',
                                components: [
                                    {
                                        name: 'token0',
                                        type: 'address',
                                        internalType: 'address',
                                    },
                                    {
                                        name: 'token1',
                                        type: 'address',
                                        internalType: 'address',
                                    },
                                    {
                                        name: 'poolAddr',
                                        type: 'address',
                                        internalType: 'address',
                                    },
                                    {
                                        name: 'poolType',
                                        type: 'uint24',
                                        internalType: 'uint24',
                                    },
                                    {
                                        name: 'fee',
                                        type: 'uint128',
                                        internalType: 'uint128',
                                    },
                                    {
                                        name: 'swapType',
                                        type: 'uint8',
                                        internalType: 'enum LibTypes.SwapType',
                                    },
                                ],
                            },
                            {
                                name: 'weights',
                                type: 'uint256[]',
                                internalType: 'uint256[]',
                            },
                        ],
                    },
                    {
                        name: 'finalAmountOut',
                        type: 'uint256',
                        internalType: 'uint256',
                    },
                    {
                        name: 'isValid',
                        type: 'bool',
                        internalType: 'bool',
                    },
                ],
            },
        ],
        stateMutability: 'nonpayable',
    },
    {
        type: 'function',
        name: 'splits',
        inputs: [],
        outputs: [
            {
                name: '',
                type: 'uint256',
                internalType: 'uint256',
            },
        ],
        stateMutability: 'view',
    },
] as const;

export class QuerySplitRoute__factory {
    static readonly abi = _abi;
    static createInterface(): QuerySplitRouteInterface {
        return new utils.Interface(_abi) as QuerySplitRouteInterface;
    }
    static connect(address: string, signerOrProvider: Signer | Provider): QuerySplitRoute {
        return new Contract(address, _abi, signerOrProvider) as QuerySplitRoute;
    }
}
