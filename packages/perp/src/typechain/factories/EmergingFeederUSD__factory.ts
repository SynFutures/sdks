/* Autogenerated file. Do not edit manually. */
/* tslint:disable */

import { Contract, Signer, utils } from 'ethers';
import type { Provider } from '@ethersproject/providers';
import type { EmergingFeeder, EmergingFeederInterface } from '../EmergingFeeder';

const _abi = [
    {
        inputs: [
            {
                internalType: 'address',
                name: '_factory',
                type: 'address',
            },
        ],
        stateMutability: 'nonpayable',
        type: 'constructor',
    },
    {
        inputs: [],
        name: 'NotRegistry',
        type: 'error',
    },
    {
        anonymous: false,
        inputs: [
            {
                indexed: false,
                internalType: 'uint8',
                name: 'version',
                type: 'uint8',
            },
        ],
        name: 'Initialized',
        type: 'event',
    },
    {
        inputs: [],
        name: 'currentPrice',
        outputs: [
            {
                internalType: 'uint128',
                name: '',
                type: 'uint128',
            },
        ],
        stateMutability: 'view',
        type: 'function',
    },
    {
        inputs: [],
        name: 'decimals',
        outputs: [
            {
                internalType: 'uint8',
                name: '',
                type: 'uint8',
            },
        ],
        stateMutability: 'view',
        type: 'function',
    },
    {
        inputs: [],
        name: 'factory',
        outputs: [
            {
                internalType: 'address',
                name: '',
                type: 'address',
            },
        ],
        stateMutability: 'view',
        type: 'function',
    },
    {
        inputs: [
            {
                internalType: 'uint8',
                name: '_decimals',
                type: 'uint8',
            },
            {
                internalType: 'uint128',
                name: 'priceE8',
                type: 'uint128',
            },
        ],
        name: 'initialize',
        outputs: [],
        stateMutability: 'nonpayable',
        type: 'function',
    },
    {
        inputs: [],
        name: 'lastUpdatedTimestamp',
        outputs: [
            {
                internalType: 'uint64',
                name: '',
                type: 'uint64',
            },
        ],
        stateMutability: 'view',
        type: 'function',
    },
    {
        inputs: [],
        name: 'latestRoundData',
        outputs: [
            {
                internalType: 'uint80',
                name: '',
                type: 'uint80',
            },
            {
                internalType: 'int256',
                name: '',
                type: 'int256',
            },
            {
                internalType: 'uint256',
                name: '',
                type: 'uint256',
            },
            {
                internalType: 'uint256',
                name: '',
                type: 'uint256',
            },
            {
                internalType: 'uint80',
                name: '',
                type: 'uint80',
            },
        ],
        stateMutability: 'view',
        type: 'function',
    },
    {
        inputs: [
            {
                internalType: 'uint8',
                name: 'newDecimals',
                type: 'uint8',
            },
        ],
        name: 'setDeicmal',
        outputs: [],
        stateMutability: 'nonpayable',
        type: 'function',
    },
    {
        inputs: [
            {
                internalType: 'uint128',
                name: 'priceE8',
                type: 'uint128',
            },
        ],
        name: 'setRawPrice',
        outputs: [],
        stateMutability: 'nonpayable',
        type: 'function',
    },
] as const;

export class EmergingFeeder__factory {
    static readonly abi = _abi;
    static createInterface(): EmergingFeederInterface {
        return new utils.Interface(_abi) as EmergingFeederInterface;
    }
    static connect(address: string, signerOrProvider: Signer | Provider): EmergingFeeder {
        return new Contract(address, _abi, signerOrProvider) as EmergingFeeder;
    }
}
