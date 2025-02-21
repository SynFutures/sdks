/* Autogenerated file. Do not edit manually. */
/* tslint:disable */

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
import type { TypedEventFilter, TypedEvent, TypedListener, OnEvent, PromiseOrValue } from './common';

export interface EmergingFeederInterface extends utils.Interface {
    functions: {
        'currentPrice()': FunctionFragment;
        'decimals()': FunctionFragment;
        'factory()': FunctionFragment;
        'initialize(uint8,uint128)': FunctionFragment;
        'lastUpdatedTimestamp()': FunctionFragment;
        'latestRoundData()': FunctionFragment;
        'setDeicmal(uint8)': FunctionFragment;
        'setRawPrice(uint128)': FunctionFragment;
    };

    getFunction(
        nameOrSignatureOrTopic:
            | 'currentPrice'
            | 'decimals'
            | 'factory'
            | 'initialize'
            | 'lastUpdatedTimestamp'
            | 'latestRoundData'
            | 'setDeicmal'
            | 'setRawPrice',
    ): FunctionFragment;

    encodeFunctionData(functionFragment: 'currentPrice', values?: undefined): string;
    encodeFunctionData(functionFragment: 'decimals', values?: undefined): string;
    encodeFunctionData(functionFragment: 'factory', values?: undefined): string;
    encodeFunctionData(
        functionFragment: 'initialize',
        values: [PromiseOrValue<BigNumberish>, PromiseOrValue<BigNumberish>],
    ): string;
    encodeFunctionData(functionFragment: 'lastUpdatedTimestamp', values?: undefined): string;
    encodeFunctionData(functionFragment: 'latestRoundData', values?: undefined): string;
    encodeFunctionData(functionFragment: 'setDeicmal', values: [PromiseOrValue<BigNumberish>]): string;
    encodeFunctionData(functionFragment: 'setRawPrice', values: [PromiseOrValue<BigNumberish>]): string;

    decodeFunctionResult(functionFragment: 'currentPrice', data: BytesLike): Result;
    decodeFunctionResult(functionFragment: 'decimals', data: BytesLike): Result;
    decodeFunctionResult(functionFragment: 'factory', data: BytesLike): Result;
    decodeFunctionResult(functionFragment: 'initialize', data: BytesLike): Result;
    decodeFunctionResult(functionFragment: 'lastUpdatedTimestamp', data: BytesLike): Result;
    decodeFunctionResult(functionFragment: 'latestRoundData', data: BytesLike): Result;
    decodeFunctionResult(functionFragment: 'setDeicmal', data: BytesLike): Result;
    decodeFunctionResult(functionFragment: 'setRawPrice', data: BytesLike): Result;

    events: {
        'Initialized(uint8)': EventFragment;
    };

    getEvent(nameOrSignatureOrTopic: 'Initialized'): EventFragment;
}

export interface InitializedEventObject {
    version: number;
}
export type InitializedEvent = TypedEvent<[number], InitializedEventObject>;

export type InitializedEventFilter = TypedEventFilter<InitializedEvent>;

export interface EmergingFeeder extends BaseContract {
    connect(signerOrProvider: Signer | Provider | string): this;
    attach(addressOrName: string): this;
    deployed(): Promise<this>;

    interface: EmergingFeederInterface;

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
        currentPrice(overrides?: CallOverrides): Promise<[BigNumber]>;

        decimals(overrides?: CallOverrides): Promise<[number]>;

        factory(overrides?: CallOverrides): Promise<[string]>;

        initialize(
            _decimals: PromiseOrValue<BigNumberish>,
            priceE8: PromiseOrValue<BigNumberish>,
            overrides?: Overrides & { from?: PromiseOrValue<string> },
        ): Promise<ContractTransaction>;

        lastUpdatedTimestamp(overrides?: CallOverrides): Promise<[BigNumber]>;

        latestRoundData(overrides?: CallOverrides): Promise<[BigNumber, BigNumber, BigNumber, BigNumber, BigNumber]>;

        setDeicmal(
            newDecimals: PromiseOrValue<BigNumberish>,
            overrides?: Overrides & { from?: PromiseOrValue<string> },
        ): Promise<ContractTransaction>;

        setRawPrice(
            priceE8: PromiseOrValue<BigNumberish>,
            overrides?: Overrides & { from?: PromiseOrValue<string> },
        ): Promise<ContractTransaction>;
    };

    currentPrice(overrides?: CallOverrides): Promise<BigNumber>;

    decimals(overrides?: CallOverrides): Promise<number>;

    factory(overrides?: CallOverrides): Promise<string>;

    initialize(
        _decimals: PromiseOrValue<BigNumberish>,
        priceE8: PromiseOrValue<BigNumberish>,
        overrides?: Overrides & { from?: PromiseOrValue<string> },
    ): Promise<ContractTransaction>;

    lastUpdatedTimestamp(overrides?: CallOverrides): Promise<BigNumber>;

    latestRoundData(overrides?: CallOverrides): Promise<[BigNumber, BigNumber, BigNumber, BigNumber, BigNumber]>;

    setDeicmal(
        newDecimals: PromiseOrValue<BigNumberish>,
        overrides?: Overrides & { from?: PromiseOrValue<string> },
    ): Promise<ContractTransaction>;

    setRawPrice(
        priceE8: PromiseOrValue<BigNumberish>,
        overrides?: Overrides & { from?: PromiseOrValue<string> },
    ): Promise<ContractTransaction>;

    callStatic: {
        currentPrice(overrides?: CallOverrides): Promise<BigNumber>;

        decimals(overrides?: CallOverrides): Promise<number>;

        factory(overrides?: CallOverrides): Promise<string>;

        initialize(
            _decimals: PromiseOrValue<BigNumberish>,
            priceE8: PromiseOrValue<BigNumberish>,
            overrides?: CallOverrides,
        ): Promise<void>;

        lastUpdatedTimestamp(overrides?: CallOverrides): Promise<BigNumber>;

        latestRoundData(overrides?: CallOverrides): Promise<[BigNumber, BigNumber, BigNumber, BigNumber, BigNumber]>;

        setDeicmal(newDecimals: PromiseOrValue<BigNumberish>, overrides?: CallOverrides): Promise<void>;

        setRawPrice(priceE8: PromiseOrValue<BigNumberish>, overrides?: CallOverrides): Promise<void>;
    };

    filters: {
        'Initialized(uint8)'(version?: null): InitializedEventFilter;
        Initialized(version?: null): InitializedEventFilter;
    };

    estimateGas: {
        currentPrice(overrides?: CallOverrides): Promise<BigNumber>;

        decimals(overrides?: CallOverrides): Promise<BigNumber>;

        factory(overrides?: CallOverrides): Promise<BigNumber>;

        initialize(
            _decimals: PromiseOrValue<BigNumberish>,
            priceE8: PromiseOrValue<BigNumberish>,
            overrides?: Overrides & { from?: PromiseOrValue<string> },
        ): Promise<BigNumber>;

        lastUpdatedTimestamp(overrides?: CallOverrides): Promise<BigNumber>;

        latestRoundData(overrides?: CallOverrides): Promise<BigNumber>;

        setDeicmal(
            newDecimals: PromiseOrValue<BigNumberish>,
            overrides?: Overrides & { from?: PromiseOrValue<string> },
        ): Promise<BigNumber>;

        setRawPrice(
            priceE8: PromiseOrValue<BigNumberish>,
            overrides?: Overrides & { from?: PromiseOrValue<string> },
        ): Promise<BigNumber>;
    };

    populateTransaction: {
        currentPrice(overrides?: CallOverrides): Promise<PopulatedTransaction>;

        decimals(overrides?: CallOverrides): Promise<PopulatedTransaction>;

        factory(overrides?: CallOverrides): Promise<PopulatedTransaction>;

        initialize(
            _decimals: PromiseOrValue<BigNumberish>,
            priceE8: PromiseOrValue<BigNumberish>,
            overrides?: Overrides & { from?: PromiseOrValue<string> },
        ): Promise<PopulatedTransaction>;

        lastUpdatedTimestamp(overrides?: CallOverrides): Promise<PopulatedTransaction>;

        latestRoundData(overrides?: CallOverrides): Promise<PopulatedTransaction>;

        setDeicmal(
            newDecimals: PromiseOrValue<BigNumberish>,
            overrides?: Overrides & { from?: PromiseOrValue<string> },
        ): Promise<PopulatedTransaction>;

        setRawPrice(
            priceE8: PromiseOrValue<BigNumberish>,
            overrides?: Overrides & { from?: PromiseOrValue<string> },
        ): Promise<PopulatedTransaction>;
    };
}
