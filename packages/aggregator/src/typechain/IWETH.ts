import type {
    BaseContract,
    BigNumber,
    BigNumberish,
    BytesLike,
    CallOverrides,
    ContractTransaction,
    Overrides,
    PayableOverrides,
    PopulatedTransaction,
    Signer,
    utils,
} from 'ethers';
import type { FunctionFragment, Result } from '@ethersproject/abi';
import type { Listener, Provider } from '@ethersproject/providers';
import type { TypedEventFilter, TypedEvent, TypedListener, OnEvent } from './common';

export interface IWETHInterface extends utils.Interface {
    functions: {
        'deposit()': FunctionFragment;
        'withdraw(uint256)': FunctionFragment;
    };

    encodeFunctionData(functionFragment: 'deposit', values?: undefined): string;
    encodeFunctionData(functionFragment: 'withdraw', values: [BigNumberish]): string;

    decodeFunctionResult(functionFragment: 'deposit', data: BytesLike): Result;
    decodeFunctionResult(functionFragment: 'withdraw', data: BytesLike): Result;
}

export interface IWETH extends BaseContract {
    connect(signerOrProvider: Signer | Provider | string): this;
    attach(addressOrName: string): this;
    deployed(): Promise<this>;

    interface: IWETHInterface;

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
        deposit(overrides?: PayableOverrides & { from?: string }): Promise<ContractTransaction>;

        withdraw(amount: BigNumberish, overrides?: Overrides & { from?: string }): Promise<ContractTransaction>;
    };

    deposit(overrides?: PayableOverrides & { from?: string }): Promise<ContractTransaction>;

    withdraw(amount: BigNumberish, overrides?: Overrides & { from?: string }): Promise<ContractTransaction>;

    callStatic: {
        deposit(overrides?: CallOverrides): Promise<void>;
        withdraw(amount: BigNumberish, overrides?: CallOverrides): Promise<void>;
    };

    estimateGas: {
        deposit(overrides?: PayableOverrides & { from?: string }): Promise<BigNumber>;
        withdraw(amount: BigNumberish, overrides?: Overrides & { from?: string }): Promise<BigNumber>;
    };

    populateTransaction: {
        deposit(overrides?: PayableOverrides & { from?: string }): Promise<PopulatedTransaction>;
        withdraw(amount: BigNumberish, overrides?: Overrides & { from?: string }): Promise<PopulatedTransaction>;
    };
}
