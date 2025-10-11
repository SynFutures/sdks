export interface CalcInterface {
    alignPriceToTick(instrumentAddr: string, price: bigint): Promise<{ tick: number; price: bigint }>;

    getWadAtTick(instrumentAddr: string, tick: number): Promise<bigint>;

    getTickAtPWad(instrumentAddr: string, price: bigint): Promise<number>;

    getWadAtTicks(
        instrumentAddr: string,
        lowerTick: number,
        upperTick: number,
    ): Promise<{
        lowerPrice: bigint;
        upperPrice: bigint;
    }>;

    sqrtX96ToWad(instrumentAddr: string, sqrtPX96: bigint): Promise<bigint>;
}
