import { BigNumber } from 'ethers';
import { Context } from '@derivation-tech/context';
import { alignPriceToTick, TickMath, sqrtX96ToWad } from '../math';
import { CalcInterface } from './calc.interface';

export class CalcModule implements CalcInterface {
  context: Context;

  constructor(context: Context) {
    this.context = context;
  }

  async alignPriceToTick(instrumentAddr: string, price: BigNumber): Promise<{ tick: number; price: BigNumber }> {
    return alignPriceToTick(price);
  }

  async getWadAtTick(instrumentAddr: string, tick: number): Promise<BigNumber> {
    return TickMath.getWadAtTick(tick);
  }

  async getTickAtPWad(instrumentAddr: string, price: BigNumber): Promise<number> {
    return TickMath.getTickAtPWad(price);
  }

  async getWadAtTicks(
    instrumentAddr: string,
    lowerTick: number,
    upperTick: number,
  ): Promise<{ lowerPrice: BigNumber; upperPrice: BigNumber }> {
    return {
      lowerPrice: TickMath.getWadAtTick(lowerTick),
      upperPrice: TickMath.getWadAtTick(upperTick),
    };
  }

  async sqrtX96ToWad(instrumentAddr: string, sqrtPX96: BigNumber): Promise<BigNumber> {
    return sqrtX96ToWad(sqrtPX96);
  }
}
