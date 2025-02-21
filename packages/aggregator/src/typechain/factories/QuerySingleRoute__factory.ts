/* Autogenerated file. Do not edit manually. */
/* tslint:disable */

import { Contract, Signer, utils } from 'ethers';
import type { Provider } from '@ethersproject/providers';
import type { QuerySingleRoute, QuerySingleRouteInterface } from '../QuerySingleRoute';

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
        name: 'queryDirectRoute',
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
                name: 'dexFlag',
                type: 'uint256',
                internalType: 'uint256',
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
                name: 'bestPath',
                type: 'address[]',
                internalType: 'address[]',
            },
            {
                name: 'bestPoolPath',
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
        ],
        stateMutability: 'nonpayable',
    },
    {
        type: 'function',
        name: 'querySingleRoute',
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
                name: 'dexFlag',
                type: 'uint256',
                internalType: 'uint256',
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
                name: 'bestPath',
                type: 'address[]',
                internalType: 'address[]',
            },
            {
                name: 'bestPoolPath',
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
        ],
        stateMutability: 'nonpayable',
    },
    {
        type: 'error',
        name: 'InvalidPathLength',
        inputs: [],
    },
] as const;

export class QuerySingleRoute__factory {
    static readonly abi = _abi;
    static createInterface(): QuerySingleRouteInterface {
        return new utils.Interface(_abi) as QuerySingleRouteInterface;
    }
    static connect(address: string, signerOrProvider: Signer | Provider): QuerySingleRoute {
        return new Contract(address, _abi, signerOrProvider) as QuerySingleRoute;
    }
}
