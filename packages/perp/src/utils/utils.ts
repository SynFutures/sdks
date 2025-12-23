/* eslint-disable @typescript-eslint/no-explicit-any */
import { BigNumber, CallOverrides } from 'ethers';
import moment from 'moment';
import { Context } from '@derivation-tech/context';
import { PERP_EXPIRY, MAX_POSITION_NUM } from '../constants';
import { MAX_UINT_128, ONE, TickMath, asUint24, asInt24, ZERO } from '../math';
import {
    Instrument,
    InstrumentIdentifier,
    Portfolio,
    TokenInfo,
    ByBase,
    ByQuote,
    TradeInfo,
    Position,
    TxOptions,
    Order,
    Range,
} from '../types';
import { Leverage, MarketType, Side } from '../enum';
import { BlockInfoStructOutput, PortfolioStructOutput } from '../typechain/Observer';
import * as factory from './factory';
import { CalculationError } from '../errors/calculationError';
import { SynfError } from '../errors/synfError';

export async function quickRetry<T>(fn: () => Promise<T>, times = 3, interval = 100) {
    let error: any;

    for (let i = 0; ; i++) {
        try {
            return await fn();
        } catch (err) {
            error = err;
        }

        if (i === times - 1) {
            break;
        }

        await new Promise<void>((r) => setTimeout(r, (i + 1) * interval));
    }

    throw error;
}

export function getLeverageFromImr(imr: number): Leverage {
    if (imr === 1000) return Leverage.LOW;
    if (imr === 500) return Leverage.MEDIUM;
    if (imr === 300) return Leverage.HIGH;
    if (imr === 100) return Leverage.RISKY;
    throw new CalculationError('Invalid IMR value', { imr });
}

export function alignExpiry(): number {
    return Math.floor((Date.now() / 1000 + 259200) / 604800) * 604800 + 345600 + 28800 - 259200;
}

export function alignTick(tick: number, tickSpacing: number): number {
    return tick - (tick % tickSpacing);
}

export function getMinTick(tickSpacing: number): number {
    return Math.ceil(-TickMath.MAX_TICK / tickSpacing) * tickSpacing;
}

export function getMaxTick(tickSpacing: number): number {
    return Math.floor(TickMath.MAX_TICK / tickSpacing) * tickSpacing;
}

export function getMaxLiquidityPerTick(tickSpacing: number): BigNumber {
    return MAX_UINT_128.div((getMaxTick(tickSpacing) - getMinTick(tickSpacing)) / tickSpacing + 1);
}

export function rangeKey(tickLower: number, tickUpper: number): number {
    return shiftLeft(asUint24(tickLower), 24) + asUint24(tickUpper);
}

export function orderKey(tick: number, nonce: number): number {
    return shiftLeft(asUint24(tick), 24) + nonce;
}

// These two functions exist because shifting integer does not work as regular in JavaScript. For example:
// 1) 1 << 48 in JavaScript results in 65536
// 2) 0x200000000 >> 1 in JavaScript results in 0
// To see more about this stupid fact, go to https://stackoverflow.com/questions/42221373/javascript-integer-shift-safety-n-1-n-2

// x << n
function shiftLeft(x: number, n: number): number {
    return x * Math.pow(2, n);
}

// x >> n
function shiftRight(x: number, n: number): number {
    return Math.floor(x / Math.pow(2, n));
}

const MAX_UINT_24 = shiftLeft(1, 24) - 1;
const MAX_UINT_48 = shiftLeft(1, 48) - 1;

// find RangeTicks depending on key
export function parseTicks(key: number): { tickLower: number; tickUpper: number } {
    if (key > MAX_UINT_48) {
        throw new CalculationError('Not 48-bit key', { key });
    }
    const tickLower = asInt24(shiftRight(key, 24));
    const tickUpper = asInt24(key & MAX_UINT_24);
    return { tickLower, tickUpper };
}

export function parseOrderTickNonce(key: number): { tick: number; nonce: number } {
    if (key > MAX_UINT_48) {
        throw new CalculationError('Not 48-bit key', { key });
    }
    const tick = asInt24(shiftRight(key, 24));
    const nonce = key & MAX_UINT_24;
    return { tick, nonce };
}

export function normalizeTick(originTick: number, tickSpacing: number): number {
    return BigNumber.from(originTick).div(tickSpacing).mul(tickSpacing).toNumber();
}

export function solidityRequire(condition: boolean, message?: string): void {
    if (!condition) {
        throw new SynfError(message ?? 'Solidity require failed');
    }
}

export function tickDeltaToAlphaWad(tickDelta: number): BigNumber {
    return TickMath.getWadAtTick(tickDelta);
}

export function alphaWadToTickDelta(alphaWad: BigNumber): number {
    return TickMath.getTickAtPWad(alphaWad) + 1;
}

// e.g. 0b1101 => [0, 2, 3]
export function decomposePbitmap(pbitmap: BigNumber): number[] {
    const bits: number[] = [];
    for (let i = 0; i < MAX_POSITION_NUM; i++) {
        if (!pbitmap.and(ONE.shl(i)).isZero()) {
            bits.push(i);
        }
    }
    return bits;
}

function isEthersArray(obj: unknown): boolean {
    if (obj instanceof Array) {
        return obj.length === Object.keys(obj).length;
    }
    return false;
}

function isEthersTypeChainStruct(obj: unknown): boolean {
    if (obj instanceof Array) {
        return obj.length !== Object.keys(obj).length;
    }
    return false;
}

export function trimObj<T>(obj: T & { length: number }): T {
    if (isEthersTypeChainStruct(obj)) {
        const ret = {} as T;
        Object.keys(obj).forEach((key: string, i) => {
            if (i >= obj.length) {
                // eslint-disable-next-line @typescript-eslint/ban-ts-comment
                // @ts-ignore
                ret[key] = trimObj(obj[key]);
            }
        });
        return ret;
    } else if (isEthersArray(obj)) {
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        return (obj as Array<any>).map((item: any) => trimObj(item));
    } else {
        return obj;
    }
}

// For perpetual expiry, return 'PERP'
// For futures expiry, return yyyymmdd format. e.g. 20230207
export function formatExpiry(expiry: number): string {
    return expiry === PERP_EXPIRY ? 'PERP' : moment.utc(expiry * 1000).format('yyyyMMDD');
}

export function dateExpiry2Ts(expiry: string): number {
    if (expiry === '0' || expiry.toUpperCase() === 'PERPETUAL' || expiry.toUpperCase() === 'PERP') {
        return PERP_EXPIRY;
    }
    return moment.utc(expiry, 'YYYYMMDD').unix();
}

export function getTokenSymbol(
    base: string | TokenInfo,
    quote: string | TokenInfo,
): {
    baseSymbol: string;
    quoteSymbol: string;
} {
    const baseSymbol = typeof base === 'string' ? base : base.symbol;
    const quoteSymbol = typeof quote === 'string' ? quote : quote.symbol;
    return { baseSymbol, quoteSymbol };
}

export async function getTokenInfo(
    instrumentIdentifier: InstrumentIdentifier,
    ctx: Context,
): Promise<{
    baseTokenInfo: TokenInfo;
    quoteTokenInfo: TokenInfo;
}> {
    const call1 =
        typeof instrumentIdentifier.baseSymbol === 'string'
            ? ctx.getTokenInfo(instrumentIdentifier.baseSymbol)
            : (instrumentIdentifier.baseSymbol as TokenInfo);
    const call2 =
        typeof instrumentIdentifier.quoteSymbol === 'string'
            ? ctx.getTokenInfo(instrumentIdentifier.quoteSymbol)
            : (instrumentIdentifier.quoteSymbol as TokenInfo);
    const [baseTokenInfo, quoteTokenInfo] = await Promise.all([call1, call2]);
    return { baseTokenInfo, quoteTokenInfo };
}

export function isEmptyPortfolio(portfolio: Portfolio): boolean {
    return portfolio.orders.size === 0 && portfolio.ranges.size === 0 && portfolio.position.size.isZero();
}

export function isCexMarket(marketType: MarketType): boolean {
    return marketType === MarketType.LINK || marketType === MarketType.EMG || marketType === MarketType.PYTH || marketType === MarketType.STORK;
}

export function sizeToSide(size: BigNumber): Side {
    if (size.isNegative()) {
        return Side.SHORT;
    } else if (size.isZero()) {
        return Side.FLAT;
    } else {
        return Side.LONG;
    }
}

export function signOfSide(side: Side): number {
    switch (side) {
        case Side.LONG:
            return 1;
        case Side.SHORT:
            return -1;
        case Side.FLAT:
            return 0;
        default:
            throw new SynfError(`Invalid side: ${side}`);
    }
}

export function isByBase(size: ByBase | ByQuote): size is ByBase {
    return 'base' in size;
}

export function isPosition(info: TradeInfo | Position): info is Position {
    return 'size' in info;
}

export function isPortfolio(info: TradeInfo | Portfolio): info is Portfolio {
    return 'position' in info;
}

export function isInstrument(instrument: Instrument | InstrumentIdentifier): instrument is Instrument {
    return 'instrumentAddr' in instrument;
}

export function toPopulatedTxOverrides(txOptions?: TxOptions): CallOverrides & { from?: string } {
    if (!txOptions) {
        return {};
    }

    const _txOptions = {
        ...txOptions,
    };

    if (_txOptions.signer) {
        if (_txOptions.from === undefined) {
            _txOptions.from = _txOptions.signer.getAddress();
        }

        delete _txOptions['signer'];
    }

    if (_txOptions.blockTag) {
        delete _txOptions['blockTag'];
    }

    if (_txOptions.enableGasPrice) {
        delete _txOptions['enableGasPrice'];
    }

    if (_txOptions.disableGasLimit) {
        delete _txOptions['disableGasLimit'];
    }

    if (_txOptions.gasLimitMultiple) {
        delete _txOptions['gasLimitMultiple'];
    }

    if (_txOptions.gasPriceMultiple) {
        delete _txOptions['gasPriceMultiple'];
    }

    if (_txOptions.from && typeof _txOptions.from !== 'string') {
        delete _txOptions['from'];
    }

    return _txOptions as CallOverrides & { from?: string };
}

export function toPortfolio(
    instrumentAddr: string,
    expiry: number,
    traderAddr: string,
    resp: {
        portfolio: PortfolioStructOutput;
        blockInfo: BlockInfoStructOutput;
    },
) {
    const position: Position = factory.createPosition({
        instrumentAddr,
        expiry,
        traderAddr,
        ...trimObj(resp.portfolio.position),
    });

    const oids = resp.portfolio.oids;
    const rids = resp.portfolio.rids;
    const rawOrdersFromContract = resp.portfolio.orders;
    const rawRangesFromContract = resp.portfolio.ranges;
    const ordersTaken = resp.portfolio.ordersTaken;

    const orders = new Map<number, Order>();
    const ranges = new Map<number, Range>();

    for (let i = 0; i < oids.length; i++) {
        const { tick, nonce } = parseOrderTickNonce(oids[i]);
        const order = factory.createOrder({
            balance: rawOrdersFromContract[i].balance,
            size: rawOrdersFromContract[i].size,
            instrumentAddr,
            expiry,
            taken: ordersTaken[i] ?? ZERO,
            tick,
            nonce,
            traderAddr,
        });
        orders.set(oids[i], order);
    }

    for (let i = 0; i < rids.length; i++) {
        const { tickLower, tickUpper } = parseTicks(rids[i]);
        const range = factory.createRange({
            liquidity: rawRangesFromContract[i].liquidity,
            entryFeeIndex: rawRangesFromContract[i].entryFeeIndex,
            balance: rawRangesFromContract[i].balance,
            sqrtEntryPX96: rawRangesFromContract[i].sqrtEntryPX96,
            tickLower,
            tickUpper,
            instrumentAddr,
            expiry,
            traderAddr,
        });
        ranges.set(rids[i], range);
    }

    const portfolio: Portfolio = {
        instrumentAddr: instrumentAddr.toLowerCase(),
        traderAddr: traderAddr.toLowerCase(),
        expiry,
        ranges,
        orders,
        isEmpty: position.size.eq(0) && ranges.size === 0 && orders.size === 0,
        blockInfo: trimObj(resp.blockInfo),
        position,
    };

    return portfolio;
}

export function bnMax(a: BigNumber, b: BigNumber): BigNumber {
    return a.gt(b) ? a : b;
}
