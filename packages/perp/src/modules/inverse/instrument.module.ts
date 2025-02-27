import { ethers } from 'ethers';
import {
  AddLiquidityParam,
  TxOptionsWithSigner,
  RemoveLiquidityParam,
  PlaceLimitOrderParam,
  PlaceMarketOrderParam,
  BatchPlaceLimitOrderParam,
  PlaceCrossMarketOrderParam,
  TxOptions,
} from '../../types';
import { reverseSide } from '../../utils';
import { InstrumentModule } from '../instrument.module';

export class InverseInstrumentModule extends InstrumentModule {
  addLiquidity(param: AddLiquidityParam, txOptions: TxOptionsWithSigner): Promise<ethers.providers.TransactionReceipt>;
  addLiquidity(param: AddLiquidityParam, txOptions?: TxOptions): Promise<ethers.PopulatedTransaction>;
  async addLiquidity(
    param: AddLiquidityParam,
    txOptions?: TxOptions,
  ): Promise<ethers.providers.TransactionReceipt | ethers.PopulatedTransaction> {
    const isInverse =
      typeof param.instrumentAddr === 'string'
        ? await this.context.perp.configuration.isInverse(param.instrumentAddr)
        : await this.context.perp.configuration.isInverseByIdentifier(param.instrumentAddr);

    return isInverse
      ? await super.addLiquidity(
          {
            ...param,
            tickDeltaLower: param.tickDeltaUpper,
            tickDeltaUpper: param.tickDeltaLower,
          },
          txOptions,
        )
      : await super.addLiquidity(param, txOptions);
  }

  removeLiquidity(
    param: RemoveLiquidityParam,
    txOptions: TxOptionsWithSigner,
  ): Promise<ethers.providers.TransactionReceipt>;
  removeLiquidity(param: RemoveLiquidityParam, txOptions?: TxOptions): Promise<ethers.PopulatedTransaction>;
  async removeLiquidity(
    param: RemoveLiquidityParam,
    txOptions?: TxOptions,
  ): Promise<ethers.providers.TransactionReceipt | ethers.PopulatedTransaction> {
    const isInverse = await this.context.perp.configuration.isInverse(param.instrumentAddr);

    return isInverse
      ? await super.removeLiquidity(
          {
            ...param,
            tickLower: param.tickUpper,
            tickUpper: param.tickLower,
          },
          txOptions,
        )
      : await super.removeLiquidity(param, txOptions);
  }

  placeLimitOrder(
    param: PlaceLimitOrderParam,
    txOptions: TxOptionsWithSigner,
  ): Promise<ethers.providers.TransactionReceipt>;
  placeLimitOrder(param: PlaceLimitOrderParam, txOptions?: TxOptions): Promise<ethers.PopulatedTransaction>;
  async placeLimitOrder(
    param: PlaceLimitOrderParam,
    txOptions?: TxOptions,
  ): Promise<ethers.providers.TransactionReceipt | ethers.PopulatedTransaction> {
    const isInverse = await this.context.perp.configuration.isInverse(param.instrumentAddr);

    return isInverse
      ? await super.placeLimitOrder(
          {
            ...param,
            side: reverseSide(param.side),
          },
          txOptions,
        )
      : await super.placeLimitOrder(param, txOptions);
  }

  placeMarketOrder(
    param: PlaceMarketOrderParam,
    txOptions: TxOptionsWithSigner,
  ): Promise<ethers.providers.TransactionReceipt>;
  placeMarketOrder(param: PlaceMarketOrderParam, txOptions?: TxOptions): Promise<ethers.PopulatedTransaction>;
  async placeMarketOrder(
    param: PlaceMarketOrderParam,
    txOptions?: TxOptions,
  ): Promise<ethers.providers.TransactionReceipt | ethers.PopulatedTransaction> {
    const isInverse = await this.context.perp.configuration.isInverse(param.instrumentAddr);

    return isInverse
      ? await super.placeMarketOrder(
          {
            ...param,
            side: reverseSide(param.side),
          },
          txOptions,
        )
      : await super.placeMarketOrder(param, txOptions);
  }

  batchPlaceLimitOrder(
    param: BatchPlaceLimitOrderParam,
    txOptions: TxOptionsWithSigner,
  ): Promise<ethers.providers.TransactionReceipt>;
  batchPlaceLimitOrder(param: BatchPlaceLimitOrderParam, txOptions?: TxOptions): Promise<ethers.PopulatedTransaction>;
  async batchPlaceLimitOrder(
    param: BatchPlaceLimitOrderParam,
    txOptions?: TxOptions,
  ): Promise<ethers.providers.TransactionReceipt | ethers.PopulatedTransaction> {
    const isInverse = await this.context.perp.configuration.isInverse(param.instrumentAddr);

    return isInverse
      ? await super.batchPlaceLimitOrder(
          {
            ...param,
            side: reverseSide(param.side),
          },
          txOptions,
        )
      : await super.batchPlaceLimitOrder(param, txOptions);
  }

  placeCrossMarketOrder(
    param: PlaceCrossMarketOrderParam,
    txOptions: TxOptionsWithSigner,
  ): Promise<ethers.providers.TransactionReceipt>;
  placeCrossMarketOrder(param: PlaceCrossMarketOrderParam, txOptions?: TxOptions): Promise<ethers.PopulatedTransaction>;
  async placeCrossMarketOrder(
    param: PlaceCrossMarketOrderParam,
    txOptions?: TxOptions,
  ): Promise<ethers.providers.TransactionReceipt | ethers.PopulatedTransaction> {
    const isInverse = await this.context.perp.configuration.isInverse(param.instrumentAddr);

    return isInverse
      ? await super.placeCrossMarketOrder(
          {
            ...param,
            side: reverseSide(param.side),
          },
          txOptions,
        )
      : await super.placeCrossMarketOrder(param, txOptions);
  }
}
