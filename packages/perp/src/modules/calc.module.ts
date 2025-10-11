// Removed bigint import, using native bigint
import { Context } from '@derivation-tech/context';
import { alignPriceToTick, TickMath, sqrtX96ToWad } from '../math';
import { CalcInterface } from './calc.interface';

export class CalcModule implements CalcInterface {
    context: Context;

    constructor(context: Context) {
        this.context = context;
    }

    async alignPriceToTick(instrumentAddr: string, price: bigint): Promise<{ tick: number; price: bigint }> {
        return alignPriceToTick(price);
    }

    async getWadAtTick(instrumentAddr: string, tick: number): Promise<bigint> {
        return TickMath.getWadAtTick(tick);
    }

    async getTickAtPWad(instrumentAddr: string, price: bigint): Promise<number> {
        return TickMath.getTickAtPWad(price);
    }

    async getWadAtTicks(
        instrumentAddr: string,
        lowerTick: number,
        upperTick: number,
    ): Promise<{ lowerPrice: bigint; upperPrice: bigint }> {
        return {
            lowerPrice: TickMath.getWadAtTick(lowerTick),
            upperPrice: TickMath.getWadAtTick(upperTick),
        };
    }

    async sqrtX96ToWad(instrumentAddr: string, sqrtPX96: bigint): Promise<bigint> {
        return sqrtX96ToWad(sqrtPX96);
    }
}
