/* Autogenerated file. Do not edit manually. */
/* tslint:disable */

import { Contract, Signer, utils } from 'ethers';
import type { Provider } from '@ethersproject/providers';
import type { Config, ConfigInterface } from '../Config';

const _abi = [
    {
        type: 'constructor',
        inputs: [],
        stateMutability: 'nonpayable',
    },
    {
        type: 'function',
        name: 'acceptBot',
        inputs: [],
        outputs: [],
        stateMutability: 'nonpayable',
    },
    {
        type: 'function',
        name: 'addMiddleTokens',
        inputs: [
            {
                name: 'tokens',
                type: 'address[]',
                internalType: 'address[]',
            },
            {
                name: 'limits',
                type: 'uint256[]',
                internalType: 'uint256[]',
            },
        ],
        outputs: [],
        stateMutability: 'nonpayable',
    },
    {
        type: 'function',
        name: 'addPools',
        inputs: [
            {
                name: 'pools',
                type: 'tuple[]',
                internalType: 'struct Config.PoolInput[]',
                components: [
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
                ],
            },
        ],
        outputs: [],
        stateMutability: 'nonpayable',
    },
    {
        type: 'function',
        name: 'bot',
        inputs: [],
        outputs: [
            {
                name: '',
                type: 'address',
                internalType: 'address',
            },
        ],
        stateMutability: 'view',
    },
    {
        type: 'function',
        name: 'changeSplits',
        inputs: [
            {
                name: 'newComplex',
                type: 'uint256',
                internalType: 'uint256',
            },
            {
                name: 'newSimple',
                type: 'uint256',
                internalType: 'uint256',
            },
        ],
        outputs: [],
        stateMutability: 'nonpayable',
    },
    {
        type: 'function',
        name: 'complexSplits',
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
    {
        type: 'function',
        name: 'getAmountsOut',
        inputs: [
            {
                name: 'pool',
                type: 'address',
                internalType: 'address',
            },
            {
                name: 'poolType',
                type: 'uint24',
                internalType: 'uint24',
            },
            {
                name: 'isToken0',
                type: 'bool',
                internalType: 'bool',
            },
            {
                name: 'amountsIn',
                type: 'uint256[]',
                internalType: 'uint256[]',
            },
        ],
        outputs: [
            {
                name: 'amountsOut',
                type: 'uint256[]',
                internalType: 'uint256[]',
            },
        ],
        stateMutability: 'nonpayable',
    },
    {
        type: 'function',
        name: 'getMidPrices',
        inputs: [
            {
                name: 'pools',
                type: 'address[]',
                internalType: 'address[]',
            },
            {
                name: 'poolTypes',
                type: 'uint24[]',
                internalType: 'uint24[]',
            },
            {
                name: 'isBuy',
                type: 'bool',
                internalType: 'bool',
            },
        ],
        outputs: [
            {
                name: 'prices',
                type: 'uint256[]',
                internalType: 'uint256[]',
            },
            {
                name: 'token0bals',
                type: 'uint256[]',
                internalType: 'uint256[]',
            },
            {
                name: 'token1bals',
                type: 'uint256[]',
                internalType: 'uint256[]',
            },
        ],
        stateMutability: 'view',
    },
    {
        type: 'function',
        name: 'getMiddleTokens',
        inputs: [],
        outputs: [
            {
                name: '',
                type: 'address[]',
                internalType: 'address[]',
            },
        ],
        stateMutability: 'view',
    },
    {
        type: 'function',
        name: 'getPoolAdapter',
        inputs: [
            {
                name: 'poolType',
                type: 'uint24',
                internalType: 'uint24',
            },
        ],
        outputs: [
            {
                name: '',
                type: 'address',
                internalType: 'address',
            },
        ],
        stateMutability: 'view',
    },
    {
        type: 'function',
        name: 'getPoolsWithFlag',
        inputs: [
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
                name: 'dexFlag',
                type: 'uint256',
                internalType: 'uint256',
            },
        ],
        outputs: [
            {
                name: '',
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
        stateMutability: 'view',
    },
    {
        type: 'function',
        name: 'getSplits',
        inputs: [
            {
                name: 'poolLength',
                type: 'uint256',
                internalType: 'uint256',
            },
        ],
        outputs: [
            {
                name: '',
                type: 'uint256',
                internalType: 'uint256',
            },
        ],
        stateMutability: 'view',
    },
    {
        type: 'function',
        name: 'initialize',
        inputs: [
            {
                name: '_owner',
                type: 'address',
                internalType: 'address',
            },
            {
                name: '_bot',
                type: 'address',
                internalType: 'address',
            },
        ],
        outputs: [],
        stateMutability: 'nonpayable',
    },
    {
        type: 'function',
        name: 'isMiddleToken',
        inputs: [
            {
                name: '',
                type: 'address',
                internalType: 'address',
            },
        ],
        outputs: [
            {
                name: '',
                type: 'bool',
                internalType: 'bool',
            },
        ],
        stateMutability: 'view',
    },
    {
        type: 'function',
        name: 'isPoolExist',
        inputs: [
            {
                name: '',
                type: 'address',
                internalType: 'address',
            },
            {
                name: '',
                type: 'address',
                internalType: 'address',
            },
            {
                name: '',
                type: 'address',
                internalType: 'address',
            },
        ],
        outputs: [
            {
                name: '',
                type: 'bool',
                internalType: 'bool',
            },
        ],
        stateMutability: 'view',
    },
    {
        type: 'function',
        name: 'middleTokenConstraints',
        inputs: [
            {
                name: '',
                type: 'address',
                internalType: 'address',
            },
        ],
        outputs: [
            {
                name: '',
                type: 'uint256',
                internalType: 'uint256',
            },
        ],
        stateMutability: 'view',
    },
    {
        type: 'function',
        name: 'middleTokenList',
        inputs: [
            {
                name: '',
                type: 'uint256',
                internalType: 'uint256',
            },
        ],
        outputs: [
            {
                name: '',
                type: 'address',
                internalType: 'address',
            },
        ],
        stateMutability: 'view',
    },
    {
        type: 'function',
        name: 'owner',
        inputs: [],
        outputs: [
            {
                name: '',
                type: 'address',
                internalType: 'address',
            },
        ],
        stateMutability: 'view',
    },
    {
        type: 'function',
        name: 'pendingBot',
        inputs: [],
        outputs: [
            {
                name: '',
                type: 'address',
                internalType: 'address',
            },
        ],
        stateMutability: 'view',
    },
    {
        type: 'function',
        name: 'poolAdapter',
        inputs: [
            {
                name: '',
                type: 'uint24',
                internalType: 'uint24',
            },
        ],
        outputs: [
            {
                name: '',
                type: 'address',
                internalType: 'address',
            },
        ],
        stateMutability: 'view',
    },
    {
        type: 'function',
        name: 'poolList',
        inputs: [
            {
                name: '',
                type: 'address',
                internalType: 'address',
            },
            {
                name: '',
                type: 'address',
                internalType: 'address',
            },
            {
                name: '',
                type: 'uint256',
                internalType: 'uint256',
            },
        ],
        outputs: [
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
        stateMutability: 'view',
    },
    {
        type: 'function',
        name: 'poolTypeCount',
        inputs: [],
        outputs: [
            {
                name: '',
                type: 'uint24',
                internalType: 'uint24',
            },
        ],
        stateMutability: 'view',
    },
    {
        type: 'function',
        name: 'removeMiddleTokens',
        inputs: [
            {
                name: 'tokens',
                type: 'address[]',
                internalType: 'address[]',
            },
        ],
        outputs: [],
        stateMutability: 'nonpayable',
    },
    {
        type: 'function',
        name: 'removePoolsWithTokens',
        inputs: [
            {
                name: 'poolInputs',
                type: 'tuple[]',
                internalType: 'struct Config.PoolRemoveInput[]',
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
                ],
            },
        ],
        outputs: [],
        stateMutability: 'nonpayable',
    },
    {
        type: 'function',
        name: 'renounceOwnership',
        inputs: [],
        outputs: [],
        stateMutability: 'nonpayable',
    },
    {
        type: 'function',
        name: 'resetPoolAdapter',
        inputs: [
            {
                name: 'poolType',
                type: 'uint24',
                internalType: 'uint24',
            },
            {
                name: 'newAdapter',
                type: 'address',
                internalType: 'address',
            },
        ],
        outputs: [],
        stateMutability: 'nonpayable',
    },
    {
        type: 'function',
        name: 'setMiddleTokenConstraints',
        inputs: [
            {
                name: 'token',
                type: 'address',
                internalType: 'address',
            },
            {
                name: 'limit',
                type: 'uint256',
                internalType: 'uint256',
            },
        ],
        outputs: [],
        stateMutability: 'nonpayable',
    },
    {
        type: 'function',
        name: 'setPoolAdapter',
        inputs: [
            {
                name: 'poolType',
                type: 'uint24',
                internalType: 'uint24',
            },
            {
                name: 'adapter',
                type: 'address',
                internalType: 'address',
            },
        ],
        outputs: [],
        stateMutability: 'nonpayable',
    },
    {
        type: 'function',
        name: 'setPoolAdapters',
        inputs: [
            {
                name: 'poolTypes',
                type: 'uint24[]',
                internalType: 'uint24[]',
            },
            {
                name: 'adapters',
                type: 'address[]',
                internalType: 'address[]',
            },
        ],
        outputs: [],
        stateMutability: 'nonpayable',
    },
    {
        type: 'function',
        name: 'simpleSplits',
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
    {
        type: 'function',
        name: 'transferBot',
        inputs: [
            {
                name: 'newBot',
                type: 'address',
                internalType: 'address',
            },
        ],
        outputs: [],
        stateMutability: 'nonpayable',
    },
    {
        type: 'function',
        name: 'transferOwnership',
        inputs: [
            {
                name: 'newOwner',
                type: 'address',
                internalType: 'address',
            },
        ],
        outputs: [],
        stateMutability: 'nonpayable',
    },
    {
        type: 'event',
        name: 'BotTransferCompleted',
        inputs: [
            {
                name: 'oldBot',
                type: 'address',
                indexed: true,
                internalType: 'address',
            },
            {
                name: 'newBot',
                type: 'address',
                indexed: true,
                internalType: 'address',
            },
        ],
        anonymous: false,
    },
    {
        type: 'event',
        name: 'BotTransferInitiated',
        inputs: [
            {
                name: 'currentBot',
                type: 'address',
                indexed: true,
                internalType: 'address',
            },
            {
                name: 'newBot',
                type: 'address',
                indexed: true,
                internalType: 'address',
            },
        ],
        anonymous: false,
    },
    {
        type: 'event',
        name: 'Initialized',
        inputs: [
            {
                name: 'version',
                type: 'uint8',
                indexed: false,
                internalType: 'uint8',
            },
        ],
        anonymous: false,
    },
    {
        type: 'event',
        name: 'MiddleTokensAdded',
        inputs: [
            {
                name: 'tokens',
                type: 'address[]',
                indexed: false,
                internalType: 'address[]',
            },
        ],
        anonymous: false,
    },
    {
        type: 'event',
        name: 'MiddleTokensRemoved',
        inputs: [
            {
                name: 'tokens',
                type: 'address[]',
                indexed: false,
                internalType: 'address[]',
            },
        ],
        anonymous: false,
    },
    {
        type: 'event',
        name: 'OwnershipTransferred',
        inputs: [
            {
                name: 'previousOwner',
                type: 'address',
                indexed: true,
                internalType: 'address',
            },
            {
                name: 'newOwner',
                type: 'address',
                indexed: true,
                internalType: 'address',
            },
        ],
        anonymous: false,
    },
    {
        type: 'event',
        name: 'PoolAdapterNotSet',
        inputs: [
            {
                name: 'pool',
                type: 'address',
                indexed: true,
                internalType: 'address',
            },
            {
                name: 'poolType',
                type: 'uint24',
                indexed: true,
                internalType: 'uint24',
            },
        ],
        anonymous: false,
    },
    {
        type: 'event',
        name: 'PoolAdapterReset',
        inputs: [
            {
                name: 'poolType',
                type: 'uint24',
                indexed: true,
                internalType: 'uint24',
            },
            {
                name: 'newAdapter',
                type: 'address',
                indexed: true,
                internalType: 'address',
            },
        ],
        anonymous: false,
    },
    {
        type: 'event',
        name: 'PoolAdapterSet',
        inputs: [
            {
                name: 'poolType',
                type: 'uint24',
                indexed: true,
                internalType: 'uint24',
            },
            {
                name: 'adapter',
                type: 'address',
                indexed: true,
                internalType: 'address',
            },
        ],
        anonymous: false,
    },
    {
        type: 'event',
        name: 'PoolAdded',
        inputs: [
            {
                name: 'token0',
                type: 'address',
                indexed: true,
                internalType: 'address',
            },
            {
                name: 'token1',
                type: 'address',
                indexed: true,
                internalType: 'address',
            },
            {
                name: 'pool',
                type: 'address',
                indexed: false,
                internalType: 'address',
            },
        ],
        anonymous: false,
    },
    {
        type: 'event',
        name: 'PoolsRemoved',
        inputs: [
            {
                name: 'pools',
                type: 'address[]',
                indexed: false,
                internalType: 'address[]',
            },
        ],
        anonymous: false,
    },
    {
        type: 'event',
        name: 'ResetSplitNumber',
        inputs: [
            {
                name: 'newComplex',
                type: 'uint256',
                indexed: false,
                internalType: 'uint256',
            },
            {
                name: 'newSimple',
                type: 'uint256',
                indexed: false,
                internalType: 'uint256',
            },
        ],
        anonymous: false,
    },
    {
        type: 'error',
        name: 'AdapterNotFound',
        inputs: [],
    },
    {
        type: 'error',
        name: 'InvalidTokenAddress',
        inputs: [],
    },
    {
        type: 'error',
        name: 'LengthMismatch',
        inputs: [],
    },
    {
        type: 'error',
        name: 'OnlyBotCanCall',
        inputs: [],
    },
    {
        type: 'error',
        name: 'OnlyPendingBotCanAccept',
        inputs: [],
    },
    {
        type: 'error',
        name: 'PoolAdapterAlreadySet',
        inputs: [],
    },
    {
        type: 'error',
        name: 'PoolAdapterNotSet',
        inputs: [],
    },
    {
        type: 'error',
        name: 'SplitNumberError',
        inputs: [],
    },
] as const;

export class Config__factory {
    static readonly abi = _abi;
    static createInterface(): ConfigInterface {
        return new utils.Interface(_abi) as ConfigInterface;
    }
    static connect(address: string, signerOrProvider: Signer | Provider): Config {
        return new Contract(address, _abi, signerOrProvider) as Config;
    }
}
