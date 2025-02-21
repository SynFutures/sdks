/* Autogenerated file. Do not edit manually. */
/* tslint:disable */
/* eslint-disable */
import type {
    BaseContract,
    BigNumber,
    BigNumberish,
    BytesLike,
    CallOverrides,
    ContractTransaction,
    Overrides,
    PopulatedTransaction,
    Signer,
    utils,
} from 'ethers';
import type { FunctionFragment, Result, EventFragment } from '@ethersproject/abi';
import type { Listener, Provider } from '@ethersproject/providers';
import type { TypedEventFilter, TypedEvent, TypedListener, OnEvent } from './common';

export declare namespace Config {
    export type PoolInputStruct = { poolAddr: string; poolType: BigNumberish };

    export type PoolInputStructOutput = [string, number] & {
        poolAddr: string;
        poolType: number;
    };

    export type PoolRemoveInputStruct = {
        token0: string;
        token1: string;
        poolAddr: string;
    };

    export type PoolRemoveInputStructOutput = [string, string, string] & {
        token0: string;
        token1: string;
        poolAddr: string;
    };
}

export declare namespace LibTypes {
    export type PairStruct = {
        token0: string;
        token1: string;
        poolAddr: string;
        poolType: BigNumberish;
        fee: BigNumberish;
        swapType: BigNumberish;
    };

    export type PairStructOutput = [string, string, string, number, BigNumber, number] & {
        token0: string;
        token1: string;
        poolAddr: string;
        poolType: number;
        fee: BigNumber;
        swapType: number;
    };
}

export interface ConfigInterface extends utils.Interface {
    functions: {
        'acceptBot()': FunctionFragment;
        'addMiddleTokens(address[],uint256[])': FunctionFragment;
        'addPools((address,uint24)[])': FunctionFragment;
        'bot()': FunctionFragment;
        'changeSplits(uint256,uint256)': FunctionFragment;
        'complexSplits()': FunctionFragment;
        'getAmountsOut(address,uint24,bool,uint256[])': FunctionFragment;
        'getMidPrices(address[],uint24[],bool)': FunctionFragment;
        'getMiddleTokens()': FunctionFragment;
        'getPoolAdapter(uint24)': FunctionFragment;
        'getPoolsWithFlag(address,address,uint256)': FunctionFragment;
        'getSplits(uint256)': FunctionFragment;
        'initialize(address,address)': FunctionFragment;
        'isMiddleToken(address)': FunctionFragment;
        'isPoolExist(address,address,address)': FunctionFragment;
        'middleTokenConstraints(address)': FunctionFragment;
        'middleTokenList(uint256)': FunctionFragment;
        'owner()': FunctionFragment;
        'pendingBot()': FunctionFragment;
        'poolAdapter(uint24)': FunctionFragment;
        'poolList(address,address,uint256)': FunctionFragment;
        'poolTypeCount()': FunctionFragment;
        'removeMiddleTokens(address[])': FunctionFragment;
        'removePoolsWithTokens((address,address,address)[])': FunctionFragment;
        'renounceOwnership()': FunctionFragment;
        'resetPoolAdapter(uint24,address)': FunctionFragment;
        'setMiddleTokenConstraints(address,uint256)': FunctionFragment;
        'setPoolAdapter(uint24,address)': FunctionFragment;
        'setPoolAdapters(uint24[],address[])': FunctionFragment;
        'simpleSplits()': FunctionFragment;
        'transferBot(address)': FunctionFragment;
        'transferOwnership(address)': FunctionFragment;
    };

    getFunction(
        nameOrSignatureOrTopic:
            | 'acceptBot'
            | 'addMiddleTokens'
            | 'addPools'
            | 'bot'
            | 'changeSplits'
            | 'complexSplits'
            | 'getAmountsOut'
            | 'getMidPrices'
            | 'getMiddleTokens'
            | 'getPoolAdapter'
            | 'getPoolsWithFlag'
            | 'getSplits'
            | 'initialize'
            | 'isMiddleToken'
            | 'isPoolExist'
            | 'middleTokenConstraints'
            | 'middleTokenList'
            | 'owner'
            | 'pendingBot'
            | 'poolAdapter'
            | 'poolList'
            | 'poolTypeCount'
            | 'removeMiddleTokens'
            | 'removePoolsWithTokens'
            | 'renounceOwnership'
            | 'resetPoolAdapter'
            | 'setMiddleTokenConstraints'
            | 'setPoolAdapter'
            | 'setPoolAdapters'
            | 'simpleSplits'
            | 'transferBot'
            | 'transferOwnership',
    ): FunctionFragment;

    encodeFunctionData(functionFragment: 'acceptBot', values?: undefined): string;
    encodeFunctionData(functionFragment: 'addMiddleTokens', values: [string[], BigNumberish[]]): string;
    encodeFunctionData(functionFragment: 'addPools', values: [Config.PoolInputStruct[]]): string;
    encodeFunctionData(functionFragment: 'bot', values?: undefined): string;
    encodeFunctionData(functionFragment: 'changeSplits', values: [BigNumberish, BigNumberish]): string;
    encodeFunctionData(functionFragment: 'complexSplits', values?: undefined): string;
    encodeFunctionData(
        functionFragment: 'getAmountsOut',
        values: [string, BigNumberish, boolean, BigNumberish[]],
    ): string;
    encodeFunctionData(functionFragment: 'getMidPrices', values: [string[], BigNumberish[], boolean]): string;
    encodeFunctionData(functionFragment: 'getMiddleTokens', values?: undefined): string;
    encodeFunctionData(functionFragment: 'getPoolAdapter', values: [BigNumberish]): string;
    encodeFunctionData(functionFragment: 'getPoolsWithFlag', values: [string, string, BigNumberish]): string;
    encodeFunctionData(functionFragment: 'getSplits', values: [BigNumberish]): string;
    encodeFunctionData(functionFragment: 'initialize', values: [string, string]): string;
    encodeFunctionData(functionFragment: 'isMiddleToken', values: [string]): string;
    encodeFunctionData(functionFragment: 'isPoolExist', values: [string, string, string]): string;
    encodeFunctionData(functionFragment: 'middleTokenConstraints', values: [string]): string;
    encodeFunctionData(functionFragment: 'middleTokenList', values: [BigNumberish]): string;
    encodeFunctionData(functionFragment: 'owner', values?: undefined): string;
    encodeFunctionData(functionFragment: 'pendingBot', values?: undefined): string;
    encodeFunctionData(functionFragment: 'poolAdapter', values: [BigNumberish]): string;
    encodeFunctionData(functionFragment: 'poolList', values: [string, string, BigNumberish]): string;
    encodeFunctionData(functionFragment: 'poolTypeCount', values?: undefined): string;
    encodeFunctionData(functionFragment: 'removeMiddleTokens', values: [string[]]): string;
    encodeFunctionData(functionFragment: 'removePoolsWithTokens', values: [Config.PoolRemoveInputStruct[]]): string;
    encodeFunctionData(functionFragment: 'renounceOwnership', values?: undefined): string;
    encodeFunctionData(functionFragment: 'resetPoolAdapter', values: [BigNumberish, string]): string;
    encodeFunctionData(functionFragment: 'setMiddleTokenConstraints', values: [string, BigNumberish]): string;
    encodeFunctionData(functionFragment: 'setPoolAdapter', values: [BigNumberish, string]): string;
    encodeFunctionData(functionFragment: 'setPoolAdapters', values: [BigNumberish[], string[]]): string;
    encodeFunctionData(functionFragment: 'simpleSplits', values?: undefined): string;
    encodeFunctionData(functionFragment: 'transferBot', values: [string]): string;
    encodeFunctionData(functionFragment: 'transferOwnership', values: [string]): string;

    decodeFunctionResult(functionFragment: 'acceptBot', data: BytesLike): Result;
    decodeFunctionResult(functionFragment: 'addMiddleTokens', data: BytesLike): Result;
    decodeFunctionResult(functionFragment: 'addPools', data: BytesLike): Result;
    decodeFunctionResult(functionFragment: 'bot', data: BytesLike): Result;
    decodeFunctionResult(functionFragment: 'changeSplits', data: BytesLike): Result;
    decodeFunctionResult(functionFragment: 'complexSplits', data: BytesLike): Result;
    decodeFunctionResult(functionFragment: 'getAmountsOut', data: BytesLike): Result;
    decodeFunctionResult(functionFragment: 'getMidPrices', data: BytesLike): Result;
    decodeFunctionResult(functionFragment: 'getMiddleTokens', data: BytesLike): Result;
    decodeFunctionResult(functionFragment: 'getPoolAdapter', data: BytesLike): Result;
    decodeFunctionResult(functionFragment: 'getPoolsWithFlag', data: BytesLike): Result;
    decodeFunctionResult(functionFragment: 'getSplits', data: BytesLike): Result;
    decodeFunctionResult(functionFragment: 'initialize', data: BytesLike): Result;
    decodeFunctionResult(functionFragment: 'isMiddleToken', data: BytesLike): Result;
    decodeFunctionResult(functionFragment: 'isPoolExist', data: BytesLike): Result;
    decodeFunctionResult(functionFragment: 'middleTokenConstraints', data: BytesLike): Result;
    decodeFunctionResult(functionFragment: 'middleTokenList', data: BytesLike): Result;
    decodeFunctionResult(functionFragment: 'owner', data: BytesLike): Result;
    decodeFunctionResult(functionFragment: 'pendingBot', data: BytesLike): Result;
    decodeFunctionResult(functionFragment: 'poolAdapter', data: BytesLike): Result;
    decodeFunctionResult(functionFragment: 'poolList', data: BytesLike): Result;
    decodeFunctionResult(functionFragment: 'poolTypeCount', data: BytesLike): Result;
    decodeFunctionResult(functionFragment: 'removeMiddleTokens', data: BytesLike): Result;
    decodeFunctionResult(functionFragment: 'removePoolsWithTokens', data: BytesLike): Result;
    decodeFunctionResult(functionFragment: 'renounceOwnership', data: BytesLike): Result;
    decodeFunctionResult(functionFragment: 'resetPoolAdapter', data: BytesLike): Result;
    decodeFunctionResult(functionFragment: 'setMiddleTokenConstraints', data: BytesLike): Result;
    decodeFunctionResult(functionFragment: 'setPoolAdapter', data: BytesLike): Result;
    decodeFunctionResult(functionFragment: 'setPoolAdapters', data: BytesLike): Result;
    decodeFunctionResult(functionFragment: 'simpleSplits', data: BytesLike): Result;
    decodeFunctionResult(functionFragment: 'transferBot', data: BytesLike): Result;
    decodeFunctionResult(functionFragment: 'transferOwnership', data: BytesLike): Result;

    events: {
        'BotTransferCompleted(address,address)': EventFragment;
        'BotTransferInitiated(address,address)': EventFragment;
        'Initialized(uint8)': EventFragment;
        'MiddleTokensAdded(address[])': EventFragment;
        'MiddleTokensRemoved(address[])': EventFragment;
        'OwnershipTransferred(address,address)': EventFragment;
        'PoolAdapterNotSet(address,uint24)': EventFragment;
        'PoolAdapterReset(uint24,address)': EventFragment;
        'PoolAdapterSet(uint24,address)': EventFragment;
        'PoolAdded(address,address,address)': EventFragment;
        'PoolsRemoved(address[])': EventFragment;
        'ResetSplitNumber(uint256,uint256)': EventFragment;
    };

    getEvent(nameOrSignatureOrTopic: 'BotTransferCompleted'): EventFragment;
    getEvent(nameOrSignatureOrTopic: 'BotTransferInitiated'): EventFragment;
    getEvent(nameOrSignatureOrTopic: 'Initialized'): EventFragment;
    getEvent(nameOrSignatureOrTopic: 'MiddleTokensAdded'): EventFragment;
    getEvent(nameOrSignatureOrTopic: 'MiddleTokensRemoved'): EventFragment;
    getEvent(nameOrSignatureOrTopic: 'OwnershipTransferred'): EventFragment;
    getEvent(nameOrSignatureOrTopic: 'PoolAdapterNotSet'): EventFragment;
    getEvent(nameOrSignatureOrTopic: 'PoolAdapterReset'): EventFragment;
    getEvent(nameOrSignatureOrTopic: 'PoolAdapterSet'): EventFragment;
    getEvent(nameOrSignatureOrTopic: 'PoolAdded'): EventFragment;
    getEvent(nameOrSignatureOrTopic: 'PoolsRemoved'): EventFragment;
    getEvent(nameOrSignatureOrTopic: 'ResetSplitNumber'): EventFragment;
}

export interface BotTransferCompletedEventObject {
    oldBot: string;
    newBot: string;
}
export type BotTransferCompletedEvent = TypedEvent<[string, string], BotTransferCompletedEventObject>;

export type BotTransferCompletedEventFilter = TypedEventFilter<BotTransferCompletedEvent>;

export interface BotTransferInitiatedEventObject {
    currentBot: string;
    newBot: string;
}
export type BotTransferInitiatedEvent = TypedEvent<[string, string], BotTransferInitiatedEventObject>;

export type BotTransferInitiatedEventFilter = TypedEventFilter<BotTransferInitiatedEvent>;

export interface InitializedEventObject {
    version: number;
}
export type InitializedEvent = TypedEvent<[number], InitializedEventObject>;

export type InitializedEventFilter = TypedEventFilter<InitializedEvent>;

export interface MiddleTokensAddedEventObject {
    tokens: string[];
}
export type MiddleTokensAddedEvent = TypedEvent<[string[]], MiddleTokensAddedEventObject>;

export type MiddleTokensAddedEventFilter = TypedEventFilter<MiddleTokensAddedEvent>;

export interface MiddleTokensRemovedEventObject {
    tokens: string[];
}
export type MiddleTokensRemovedEvent = TypedEvent<[string[]], MiddleTokensRemovedEventObject>;

export type MiddleTokensRemovedEventFilter = TypedEventFilter<MiddleTokensRemovedEvent>;

export interface OwnershipTransferredEventObject {
    previousOwner: string;
    newOwner: string;
}
export type OwnershipTransferredEvent = TypedEvent<[string, string], OwnershipTransferredEventObject>;

export type OwnershipTransferredEventFilter = TypedEventFilter<OwnershipTransferredEvent>;

export interface PoolAdapterNotSetEventObject {
    pool: string;
    poolType: number;
}
export type PoolAdapterNotSetEvent = TypedEvent<[string, number], PoolAdapterNotSetEventObject>;

export type PoolAdapterNotSetEventFilter = TypedEventFilter<PoolAdapterNotSetEvent>;

export interface PoolAdapterResetEventObject {
    poolType: number;
    newAdapter: string;
}
export type PoolAdapterResetEvent = TypedEvent<[number, string], PoolAdapterResetEventObject>;

export type PoolAdapterResetEventFilter = TypedEventFilter<PoolAdapterResetEvent>;

export interface PoolAdapterSetEventObject {
    poolType: number;
    adapter: string;
}
export type PoolAdapterSetEvent = TypedEvent<[number, string], PoolAdapterSetEventObject>;

export type PoolAdapterSetEventFilter = TypedEventFilter<PoolAdapterSetEvent>;

export interface PoolAddedEventObject {
    token0: string;
    token1: string;
    pool: string;
}
export type PoolAddedEvent = TypedEvent<[string, string, string], PoolAddedEventObject>;

export type PoolAddedEventFilter = TypedEventFilter<PoolAddedEvent>;

export interface PoolsRemovedEventObject {
    pools: string[];
}
export type PoolsRemovedEvent = TypedEvent<[string[]], PoolsRemovedEventObject>;

export type PoolsRemovedEventFilter = TypedEventFilter<PoolsRemovedEvent>;

export interface ResetSplitNumberEventObject {
    newComplex: BigNumber;
    newSimple: BigNumber;
}
export type ResetSplitNumberEvent = TypedEvent<[BigNumber, BigNumber], ResetSplitNumberEventObject>;

export type ResetSplitNumberEventFilter = TypedEventFilter<ResetSplitNumberEvent>;

export interface Config extends BaseContract {
    connect(signerOrProvider: Signer | Provider | string): this;
    attach(addressOrName: string): this;
    deployed(): Promise<this>;

    interface: ConfigInterface;

    queryFilter<TEvent extends TypedEvent>(
        event: TypedEventFilter<TEvent>,
        fromBlockOrBlockhash?: string | number | undefined,
        toBlock?: string | number | undefined,
    ): Promise<Array<TEvent>>;

    listeners<TEvent extends TypedEvent>(eventFilter?: TypedEventFilter<TEvent>): Array<TypedListener<TEvent>>;
    listeners(eventName?: string): Array<Listener>;
    removeAllListeners<TEvent extends TypedEvent>(eventFilter: TypedEventFilter<TEvent>): this;
    removeAllListeners(eventName?: string): this;
    off: OnEvent<this>;
    on: OnEvent<this>;
    once: OnEvent<this>;
    removeListener: OnEvent<this>;

    functions: {
        acceptBot(overrides?: Overrides & { from?: string }): Promise<ContractTransaction>;

        addMiddleTokens(
            tokens: string[],
            limits: BigNumberish[],
            overrides?: Overrides & { from?: string },
        ): Promise<ContractTransaction>;

        addPools(
            pools: Config.PoolInputStruct[],
            overrides?: Overrides & { from?: string },
        ): Promise<ContractTransaction>;

        bot(overrides?: CallOverrides): Promise<[string]>;

        changeSplits(
            newComplex: BigNumberish,
            newSimple: BigNumberish,
            overrides?: Overrides & { from?: string },
        ): Promise<ContractTransaction>;

        complexSplits(overrides?: CallOverrides): Promise<[BigNumber]>;

        getAmountsOut(
            pool: string,
            poolType: BigNumberish,
            isToken0: boolean,
            amountsIn: BigNumberish[],
            overrides?: Overrides & { from?: string },
        ): Promise<ContractTransaction>;

        getMidPrices(
            pools: string[],
            poolTypes: BigNumberish[],
            isBuy: boolean,
            overrides?: CallOverrides,
        ): Promise<
            [BigNumber[], BigNumber[], BigNumber[]] & {
                prices: BigNumber[];
                token0bals: BigNumber[];
                token1bals: BigNumber[];
            }
        >;

        getMiddleTokens(overrides?: CallOverrides): Promise<[string[]]>;

        getPoolAdapter(poolType: BigNumberish, overrides?: CallOverrides): Promise<[string]>;

        getPoolsWithFlag(
            token0: string,
            token1: string,
            dexFlag: BigNumberish,
            overrides?: CallOverrides,
        ): Promise<[LibTypes.PairStructOutput[]]>;

        getSplits(poolLength: BigNumberish, overrides?: CallOverrides): Promise<[BigNumber]>;

        initialize(
            _owner: string,
            _bot: string,
            overrides?: Overrides & { from?: string },
        ): Promise<ContractTransaction>;

        isMiddleToken(arg0: string, overrides?: CallOverrides): Promise<[boolean]>;

        isPoolExist(arg0: string, arg1: string, arg2: string, overrides?: CallOverrides): Promise<[boolean]>;

        middleTokenConstraints(arg0: string, overrides?: CallOverrides): Promise<[BigNumber]>;

        middleTokenList(arg0: BigNumberish, overrides?: CallOverrides): Promise<[string]>;

        owner(overrides?: CallOverrides): Promise<[string]>;

        pendingBot(overrides?: CallOverrides): Promise<[string]>;

        poolAdapter(arg0: BigNumberish, overrides?: CallOverrides): Promise<[string]>;

        poolList(
            arg0: string,
            arg1: string,
            arg2: BigNumberish,
            overrides?: CallOverrides,
        ): Promise<
            [string, string, string, number, BigNumber, number] & {
                token0: string;
                token1: string;
                poolAddr: string;
                poolType: number;
                fee: BigNumber;
                swapType: number;
            }
        >;

        poolTypeCount(overrides?: CallOverrides): Promise<[number]>;

        removeMiddleTokens(tokens: string[], overrides?: Overrides & { from?: string }): Promise<ContractTransaction>;

        removePoolsWithTokens(
            poolInputs: Config.PoolRemoveInputStruct[],
            overrides?: Overrides & { from?: string },
        ): Promise<ContractTransaction>;

        renounceOwnership(overrides?: Overrides & { from?: string }): Promise<ContractTransaction>;

        resetPoolAdapter(
            poolType: BigNumberish,
            newAdapter: string,
            overrides?: Overrides & { from?: string },
        ): Promise<ContractTransaction>;

        setMiddleTokenConstraints(
            token: string,
            limit: BigNumberish,
            overrides?: Overrides & { from?: string },
        ): Promise<ContractTransaction>;

        setPoolAdapter(
            poolType: BigNumberish,
            adapter: string,
            overrides?: Overrides & { from?: string },
        ): Promise<ContractTransaction>;

        setPoolAdapters(
            poolTypes: BigNumberish[],
            adapters: string[],
            overrides?: Overrides & { from?: string },
        ): Promise<ContractTransaction>;

        simpleSplits(overrides?: CallOverrides): Promise<[BigNumber]>;

        transferBot(newBot: string, overrides?: Overrides & { from?: string }): Promise<ContractTransaction>;

        transferOwnership(newOwner: string, overrides?: Overrides & { from?: string }): Promise<ContractTransaction>;
    };

    acceptBot(overrides?: Overrides & { from?: string }): Promise<ContractTransaction>;

    addMiddleTokens(
        tokens: string[],
        limits: BigNumberish[],
        overrides?: Overrides & { from?: string },
    ): Promise<ContractTransaction>;

    addPools(pools: Config.PoolInputStruct[], overrides?: Overrides & { from?: string }): Promise<ContractTransaction>;

    bot(overrides?: CallOverrides): Promise<string>;

    changeSplits(
        newComplex: BigNumberish,
        newSimple: BigNumberish,
        overrides?: Overrides & { from?: string },
    ): Promise<ContractTransaction>;

    complexSplits(overrides?: CallOverrides): Promise<BigNumber>;

    getAmountsOut(
        pool: string,
        poolType: BigNumberish,
        isToken0: boolean,
        amountsIn: BigNumberish[],
        overrides?: Overrides & { from?: string },
    ): Promise<ContractTransaction>;

    getMidPrices(
        pools: string[],
        poolTypes: BigNumberish[],
        isBuy: boolean,
        overrides?: CallOverrides,
    ): Promise<
        [BigNumber[], BigNumber[], BigNumber[]] & {
            prices: BigNumber[];
            token0bals: BigNumber[];
            token1bals: BigNumber[];
        }
    >;

    getMiddleTokens(overrides?: CallOverrides): Promise<string[]>;

    getPoolAdapter(poolType: BigNumberish, overrides?: CallOverrides): Promise<string>;

    getPoolsWithFlag(
        token0: string,
        token1: string,
        dexFlag: BigNumberish,
        overrides?: CallOverrides,
    ): Promise<LibTypes.PairStructOutput[]>;

    getSplits(poolLength: BigNumberish, overrides?: CallOverrides): Promise<BigNumber>;

    initialize(_owner: string, _bot: string, overrides?: Overrides & { from?: string }): Promise<ContractTransaction>;

    isMiddleToken(arg0: string, overrides?: CallOverrides): Promise<boolean>;

    isPoolExist(arg0: string, arg1: string, arg2: string, overrides?: CallOverrides): Promise<boolean>;

    middleTokenConstraints(arg0: string, overrides?: CallOverrides): Promise<BigNumber>;

    middleTokenList(arg0: BigNumberish, overrides?: CallOverrides): Promise<string>;

    owner(overrides?: CallOverrides): Promise<string>;

    pendingBot(overrides?: CallOverrides): Promise<string>;

    poolAdapter(arg0: BigNumberish, overrides?: CallOverrides): Promise<string>;

    poolList(
        arg0: string,
        arg1: string,
        arg2: BigNumberish,
        overrides?: CallOverrides,
    ): Promise<
        [string, string, string, number, BigNumber, number] & {
            token0: string;
            token1: string;
            poolAddr: string;
            poolType: number;
            fee: BigNumber;
            swapType: number;
        }
    >;

    poolTypeCount(overrides?: CallOverrides): Promise<number>;

    removeMiddleTokens(tokens: string[], overrides?: Overrides & { from?: string }): Promise<ContractTransaction>;

    removePoolsWithTokens(
        poolInputs: Config.PoolRemoveInputStruct[],
        overrides?: Overrides & { from?: string },
    ): Promise<ContractTransaction>;

    renounceOwnership(overrides?: Overrides & { from?: string }): Promise<ContractTransaction>;

    resetPoolAdapter(
        poolType: BigNumberish,
        newAdapter: string,
        overrides?: Overrides & { from?: string },
    ): Promise<ContractTransaction>;

    setMiddleTokenConstraints(
        token: string,
        limit: BigNumberish,
        overrides?: Overrides & { from?: string },
    ): Promise<ContractTransaction>;

    setPoolAdapter(
        poolType: BigNumberish,
        adapter: string,
        overrides?: Overrides & { from?: string },
    ): Promise<ContractTransaction>;

    setPoolAdapters(
        poolTypes: BigNumberish[],
        adapters: string[],
        overrides?: Overrides & { from?: string },
    ): Promise<ContractTransaction>;

    simpleSplits(overrides?: CallOverrides): Promise<BigNumber>;

    transferBot(newBot: string, overrides?: Overrides & { from?: string }): Promise<ContractTransaction>;

    transferOwnership(newOwner: string, overrides?: Overrides & { from?: string }): Promise<ContractTransaction>;

    callStatic: {
        acceptBot(overrides?: CallOverrides): Promise<void>;

        addMiddleTokens(tokens: string[], limits: BigNumberish[], overrides?: CallOverrides): Promise<void>;

        addPools(pools: Config.PoolInputStruct[], overrides?: CallOverrides): Promise<void>;

        bot(overrides?: CallOverrides): Promise<string>;

        changeSplits(newComplex: BigNumberish, newSimple: BigNumberish, overrides?: CallOverrides): Promise<void>;

        complexSplits(overrides?: CallOverrides): Promise<BigNumber>;

        getAmountsOut(
            pool: string,
            poolType: BigNumberish,
            isToken0: boolean,
            amountsIn: BigNumberish[],
            overrides?: CallOverrides,
        ): Promise<BigNumber[]>;

        getMidPrices(
            pools: string[],
            poolTypes: BigNumberish[],
            isBuy: boolean,
            overrides?: CallOverrides,
        ): Promise<
            [BigNumber[], BigNumber[], BigNumber[]] & {
                prices: BigNumber[];
                token0bals: BigNumber[];
                token1bals: BigNumber[];
            }
        >;

        getMiddleTokens(overrides?: CallOverrides): Promise<string[]>;

        getPoolAdapter(poolType: BigNumberish, overrides?: CallOverrides): Promise<string>;

        getPoolsWithFlag(
            token0: string,
            token1: string,
            dexFlag: BigNumberish,
            overrides?: CallOverrides,
        ): Promise<LibTypes.PairStructOutput[]>;

        getSplits(poolLength: BigNumberish, overrides?: CallOverrides): Promise<BigNumber>;

        initialize(_owner: string, _bot: string, overrides?: CallOverrides): Promise<void>;

        isMiddleToken(arg0: string, overrides?: CallOverrides): Promise<boolean>;

        isPoolExist(arg0: string, arg1: string, arg2: string, overrides?: CallOverrides): Promise<boolean>;

        middleTokenConstraints(arg0: string, overrides?: CallOverrides): Promise<BigNumber>;

        middleTokenList(arg0: BigNumberish, overrides?: CallOverrides): Promise<string>;

        owner(overrides?: CallOverrides): Promise<string>;

        pendingBot(overrides?: CallOverrides): Promise<string>;

        poolAdapter(arg0: BigNumberish, overrides?: CallOverrides): Promise<string>;

        poolList(
            arg0: string,
            arg1: string,
            arg2: BigNumberish,
            overrides?: CallOverrides,
        ): Promise<
            [string, string, string, number, BigNumber, number] & {
                token0: string;
                token1: string;
                poolAddr: string;
                poolType: number;
                fee: BigNumber;
                swapType: number;
            }
        >;

        poolTypeCount(overrides?: CallOverrides): Promise<number>;

        removeMiddleTokens(tokens: string[], overrides?: CallOverrides): Promise<void>;

        removePoolsWithTokens(poolInputs: Config.PoolRemoveInputStruct[], overrides?: CallOverrides): Promise<void>;

        renounceOwnership(overrides?: CallOverrides): Promise<void>;

        resetPoolAdapter(poolType: BigNumberish, newAdapter: string, overrides?: CallOverrides): Promise<void>;

        setMiddleTokenConstraints(token: string, limit: BigNumberish, overrides?: CallOverrides): Promise<void>;

        setPoolAdapter(poolType: BigNumberish, adapter: string, overrides?: CallOverrides): Promise<void>;

        setPoolAdapters(poolTypes: BigNumberish[], adapters: string[], overrides?: CallOverrides): Promise<void>;

        simpleSplits(overrides?: CallOverrides): Promise<BigNumber>;

        transferBot(newBot: string, overrides?: CallOverrides): Promise<void>;

        transferOwnership(newOwner: string, overrides?: CallOverrides): Promise<void>;
    };

    filters: {
        'BotTransferCompleted(address,address)'(
            oldBot?: string | null,
            newBot?: string | null,
        ): BotTransferCompletedEventFilter;
        BotTransferCompleted(oldBot?: string | null, newBot?: string | null): BotTransferCompletedEventFilter;

        'BotTransferInitiated(address,address)'(
            currentBot?: string | null,
            newBot?: string | null,
        ): BotTransferInitiatedEventFilter;
        BotTransferInitiated(currentBot?: string | null, newBot?: string | null): BotTransferInitiatedEventFilter;

        'Initialized(uint8)'(version?: null): InitializedEventFilter;
        Initialized(version?: null): InitializedEventFilter;

        'MiddleTokensAdded(address[])'(tokens?: null): MiddleTokensAddedEventFilter;
        MiddleTokensAdded(tokens?: null): MiddleTokensAddedEventFilter;

        'MiddleTokensRemoved(address[])'(tokens?: null): MiddleTokensRemovedEventFilter;
        MiddleTokensRemoved(tokens?: null): MiddleTokensRemovedEventFilter;

        'OwnershipTransferred(address,address)'(
            previousOwner?: string | null,
            newOwner?: string | null,
        ): OwnershipTransferredEventFilter;
        OwnershipTransferred(previousOwner?: string | null, newOwner?: string | null): OwnershipTransferredEventFilter;

        'PoolAdapterNotSet(address,uint24)'(
            pool?: string | null,
            poolType?: BigNumberish | null,
        ): PoolAdapterNotSetEventFilter;
        PoolAdapterNotSet(pool?: string | null, poolType?: BigNumberish | null): PoolAdapterNotSetEventFilter;

        'PoolAdapterReset(uint24,address)'(
            poolType?: BigNumberish | null,
            newAdapter?: string | null,
        ): PoolAdapterResetEventFilter;
        PoolAdapterReset(poolType?: BigNumberish | null, newAdapter?: string | null): PoolAdapterResetEventFilter;

        'PoolAdapterSet(uint24,address)'(
            poolType?: BigNumberish | null,
            adapter?: string | null,
        ): PoolAdapterSetEventFilter;
        PoolAdapterSet(poolType?: BigNumberish | null, adapter?: string | null): PoolAdapterSetEventFilter;

        'PoolAdded(address,address,address)'(
            token0?: string | null,
            token1?: string | null,
            pool?: null,
        ): PoolAddedEventFilter;
        PoolAdded(token0?: string | null, token1?: string | null, pool?: null): PoolAddedEventFilter;

        'PoolsRemoved(address[])'(pools?: null): PoolsRemovedEventFilter;
        PoolsRemoved(pools?: null): PoolsRemovedEventFilter;

        'ResetSplitNumber(uint256,uint256)'(newComplex?: null, newSimple?: null): ResetSplitNumberEventFilter;
        ResetSplitNumber(newComplex?: null, newSimple?: null): ResetSplitNumberEventFilter;
    };

    estimateGas: {
        acceptBot(overrides?: Overrides & { from?: string }): Promise<BigNumber>;

        addMiddleTokens(
            tokens: string[],
            limits: BigNumberish[],
            overrides?: Overrides & { from?: string },
        ): Promise<BigNumber>;

        addPools(pools: Config.PoolInputStruct[], overrides?: Overrides & { from?: string }): Promise<BigNumber>;

        bot(overrides?: CallOverrides): Promise<BigNumber>;

        changeSplits(
            newComplex: BigNumberish,
            newSimple: BigNumberish,
            overrides?: Overrides & { from?: string },
        ): Promise<BigNumber>;

        complexSplits(overrides?: CallOverrides): Promise<BigNumber>;

        getAmountsOut(
            pool: string,
            poolType: BigNumberish,
            isToken0: boolean,
            amountsIn: BigNumberish[],
            overrides?: Overrides & { from?: string },
        ): Promise<BigNumber>;

        getMidPrices(
            pools: string[],
            poolTypes: BigNumberish[],
            isBuy: boolean,
            overrides?: CallOverrides,
        ): Promise<BigNumber>;

        getMiddleTokens(overrides?: CallOverrides): Promise<BigNumber>;

        getPoolAdapter(poolType: BigNumberish, overrides?: CallOverrides): Promise<BigNumber>;

        getPoolsWithFlag(
            token0: string,
            token1: string,
            dexFlag: BigNumberish,
            overrides?: CallOverrides,
        ): Promise<BigNumber>;

        getSplits(poolLength: BigNumberish, overrides?: CallOverrides): Promise<BigNumber>;

        initialize(_owner: string, _bot: string, overrides?: Overrides & { from?: string }): Promise<BigNumber>;

        isMiddleToken(arg0: string, overrides?: CallOverrides): Promise<BigNumber>;

        isPoolExist(arg0: string, arg1: string, arg2: string, overrides?: CallOverrides): Promise<BigNumber>;

        middleTokenConstraints(arg0: string, overrides?: CallOverrides): Promise<BigNumber>;

        middleTokenList(arg0: BigNumberish, overrides?: CallOverrides): Promise<BigNumber>;

        owner(overrides?: CallOverrides): Promise<BigNumber>;

        pendingBot(overrides?: CallOverrides): Promise<BigNumber>;

        poolAdapter(arg0: BigNumberish, overrides?: CallOverrides): Promise<BigNumber>;

        poolList(arg0: string, arg1: string, arg2: BigNumberish, overrides?: CallOverrides): Promise<BigNumber>;

        poolTypeCount(overrides?: CallOverrides): Promise<BigNumber>;

        removeMiddleTokens(tokens: string[], overrides?: Overrides & { from?: string }): Promise<BigNumber>;

        removePoolsWithTokens(
            poolInputs: Config.PoolRemoveInputStruct[],
            overrides?: Overrides & { from?: string },
        ): Promise<BigNumber>;

        renounceOwnership(overrides?: Overrides & { from?: string }): Promise<BigNumber>;

        resetPoolAdapter(
            poolType: BigNumberish,
            newAdapter: string,
            overrides?: Overrides & { from?: string },
        ): Promise<BigNumber>;

        setMiddleTokenConstraints(
            token: string,
            limit: BigNumberish,
            overrides?: Overrides & { from?: string },
        ): Promise<BigNumber>;

        setPoolAdapter(
            poolType: BigNumberish,
            adapter: string,
            overrides?: Overrides & { from?: string },
        ): Promise<BigNumber>;

        setPoolAdapters(
            poolTypes: BigNumberish[],
            adapters: string[],
            overrides?: Overrides & { from?: string },
        ): Promise<BigNumber>;

        simpleSplits(overrides?: CallOverrides): Promise<BigNumber>;

        transferBot(newBot: string, overrides?: Overrides & { from?: string }): Promise<BigNumber>;

        transferOwnership(newOwner: string, overrides?: Overrides & { from?: string }): Promise<BigNumber>;
    };

    populateTransaction: {
        acceptBot(overrides?: Overrides & { from?: string }): Promise<PopulatedTransaction>;

        addMiddleTokens(
            tokens: string[],
            limits: BigNumberish[],
            overrides?: Overrides & { from?: string },
        ): Promise<PopulatedTransaction>;

        addPools(
            pools: Config.PoolInputStruct[],
            overrides?: Overrides & { from?: string },
        ): Promise<PopulatedTransaction>;

        bot(overrides?: CallOverrides): Promise<PopulatedTransaction>;

        changeSplits(
            newComplex: BigNumberish,
            newSimple: BigNumberish,
            overrides?: Overrides & { from?: string },
        ): Promise<PopulatedTransaction>;

        complexSplits(overrides?: CallOverrides): Promise<PopulatedTransaction>;

        getAmountsOut(
            pool: string,
            poolType: BigNumberish,
            isToken0: boolean,
            amountsIn: BigNumberish[],
            overrides?: Overrides & { from?: string },
        ): Promise<PopulatedTransaction>;

        getMidPrices(
            pools: string[],
            poolTypes: BigNumberish[],
            isBuy: boolean,
            overrides?: CallOverrides,
        ): Promise<PopulatedTransaction>;

        getMiddleTokens(overrides?: CallOverrides): Promise<PopulatedTransaction>;

        getPoolAdapter(poolType: BigNumberish, overrides?: CallOverrides): Promise<PopulatedTransaction>;

        getPoolsWithFlag(
            token0: string,
            token1: string,
            dexFlag: BigNumberish,
            overrides?: CallOverrides,
        ): Promise<PopulatedTransaction>;

        getSplits(poolLength: BigNumberish, overrides?: CallOverrides): Promise<PopulatedTransaction>;

        initialize(
            _owner: string,
            _bot: string,
            overrides?: Overrides & { from?: string },
        ): Promise<PopulatedTransaction>;

        isMiddleToken(arg0: string, overrides?: CallOverrides): Promise<PopulatedTransaction>;

        isPoolExist(arg0: string, arg1: string, arg2: string, overrides?: CallOverrides): Promise<PopulatedTransaction>;

        middleTokenConstraints(arg0: string, overrides?: CallOverrides): Promise<PopulatedTransaction>;

        middleTokenList(arg0: BigNumberish, overrides?: CallOverrides): Promise<PopulatedTransaction>;

        owner(overrides?: CallOverrides): Promise<PopulatedTransaction>;

        pendingBot(overrides?: CallOverrides): Promise<PopulatedTransaction>;

        poolAdapter(arg0: BigNumberish, overrides?: CallOverrides): Promise<PopulatedTransaction>;

        poolList(
            arg0: string,
            arg1: string,
            arg2: BigNumberish,
            overrides?: CallOverrides,
        ): Promise<PopulatedTransaction>;

        poolTypeCount(overrides?: CallOverrides): Promise<PopulatedTransaction>;

        removeMiddleTokens(tokens: string[], overrides?: Overrides & { from?: string }): Promise<PopulatedTransaction>;

        removePoolsWithTokens(
            poolInputs: Config.PoolRemoveInputStruct[],
            overrides?: Overrides & { from?: string },
        ): Promise<PopulatedTransaction>;

        renounceOwnership(overrides?: Overrides & { from?: string }): Promise<PopulatedTransaction>;

        resetPoolAdapter(
            poolType: BigNumberish,
            newAdapter: string,
            overrides?: Overrides & { from?: string },
        ): Promise<PopulatedTransaction>;

        setMiddleTokenConstraints(
            token: string,
            limit: BigNumberish,
            overrides?: Overrides & { from?: string },
        ): Promise<PopulatedTransaction>;

        setPoolAdapter(
            poolType: BigNumberish,
            adapter: string,
            overrides?: Overrides & { from?: string },
        ): Promise<PopulatedTransaction>;

        setPoolAdapters(
            poolTypes: BigNumberish[],
            adapters: string[],
            overrides?: Overrides & { from?: string },
        ): Promise<PopulatedTransaction>;

        simpleSplits(overrides?: CallOverrides): Promise<PopulatedTransaction>;

        transferBot(newBot: string, overrides?: Overrides & { from?: string }): Promise<PopulatedTransaction>;

        transferOwnership(newOwner: string, overrides?: Overrides & { from?: string }): Promise<PopulatedTransaction>;
    };
}
