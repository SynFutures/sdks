import { BigNumber } from 'ethers';
import { CalcModule } from '../calc.module';
import { reversePrice } from '../../utils';

export class InverseCalcModule extends CalcModule {
  async alignPriceToTick(instrumentAddr: string, price: BigNumber): Promise<{ tick: number; price: BigNumber }> {
    const isInverse = await this.context.perp.configuration.isInverse(instrumentAddr);

    const result = await super.alignPriceToTick(instrumentAddr, isInverse ? reversePrice(price) : price);

    return isInverse
      ? {
          ...result,
          price: reversePrice(result.price),
        }
      : result;
  }

  async getWadAtTick(instrumentAddr: string, tick: number): Promise<BigNumber> {
    const isInverse = await this.context.perp.configuration.isInverse(instrumentAddr);

    const result = await super.getWadAtTick(instrumentAddr, tick);

    return isInverse ? reversePrice(result) : result;
  }

  async getTickAtPWad(instrumentAddr: string, price: BigNumber): Promise<number> {
    const isInverse = await this.context.perp.configuration.isInverse(instrumentAddr);

    return await super.getTickAtPWad(instrumentAddr, isInverse ? reversePrice(price) : price);
  }

  async getWadAtTicks(
    instrumentAddr: string,
    lowerTick: number,
    upperTick: number,
  ): Promise<{ lowerPrice: BigNumber; upperPrice: BigNumber }> {
    const isInverse = await this.context.perp.configuration.isInverse(instrumentAddr);

    const result = await super.getWadAtTicks(instrumentAddr, lowerTick, upperTick);

    return isInverse
      ? {
          lowerPrice: reversePrice(result.upperPrice),
          upperPrice: reversePrice(result.lowerPrice),
        }
      : result;
  }

  async sqrtX96ToWad(instrumentAddr: string, sqrtPX96: BigNumber): Promise<BigNumber> {
    const isInverse = await this.context.perp.configuration.isInverse(instrumentAddr);

    const result = await super.sqrtX96ToWad(instrumentAddr, sqrtPX96);

    return isInverse ? reversePrice(result) : result;
  }
}
