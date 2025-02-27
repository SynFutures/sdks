import { MarketType } from '../enum';
import { RATIO_BASE, MIN_ORDER_MULTIPLIER, MIN_RANGE_MULTIPLIER } from '../constants';
import { Instrument, Order, Position, Amm, Range } from '../types';
import { sqrtX96ToWad, TickMath, ZERO, wdiv } from '../math';
import { orderKey, rangeKey, sizeToSide } from './utils';
import { calcMinTickDelta } from './lowLevel';

export function createInstrument(
    instrument: Omit<
        Instrument,
        | 'instrumentType'
        | 'marketType'
        | 'minTradeValue'
        | 'minOrderValue'
        | 'minRangeValue'
        | 'minTickDelta'
        | 'displayQuote'
        | 'displayBase'
    >,
): Instrument {
    const minTradeValue = instrument.setting.quoteParam.minMarginAmount
        .mul(RATIO_BASE)
        .div(instrument.setting.initialMarginRatio);

    const minOrderValue = minTradeValue.mul(MIN_ORDER_MULTIPLIER);

    const minRangeValue = minTradeValue.mul(MIN_RANGE_MULTIPLIER);

    return {
        ...instrument,
        instrumentAddr: instrument.instrumentAddr.toLowerCase(),
        instrumentType: instrument.market.feeder.ftype,
        marketType: instrument.market.info.type as MarketType,
        minTradeValue,
        minOrderValue,
        minRangeValue,
        displayBase: instrument.base,
        displayQuote: instrument.quote,
        minTickDelta: calcMinTickDelta(instrument.setting.initialMarginRatio),
    };
}

export function createAmm(amm: Omit<Amm, 'fairPrice'>): Amm {
    return {
        ...amm,
        instrumentAddr: amm.instrumentAddr.toLowerCase(),
        fairPrice: sqrtX96ToWad(amm.sqrtPX96),
    };
}

export function createOrder(order: Omit<Order, 'oid' | 'side' | 'limitPrice'>): Order {
    return {
        ...order,
        instrumentAddr: order.instrumentAddr.toLowerCase(),
        traderAddr: order.traderAddr.toLowerCase(),
        oid: orderKey(order.tick, order.nonce),
        side: sizeToSide(order.size),
        limitPrice: TickMath.getWadAtTick(order.tick),
    };
}

export function createPosition(position: Omit<Position, 'side' | 'entryPrice'>): Position {
    return {
        ...position,
        instrumentAddr: position.instrumentAddr.toLowerCase(),
        traderAddr: position.traderAddr.toLowerCase(),
        side: sizeToSide(position.size),
        entryPrice: position.size.eq(ZERO) ? ZERO : wdiv(position.entryNotional, position.size.abs()),
    };
}

export function createRange(range: Omit<Range, 'rid' | 'lowerPrice' | 'upperPrice' | 'entryPrice'>): Range {
    return {
        ...range,
        instrumentAddr: range.instrumentAddr.toLowerCase(),
        traderAddr: range.traderAddr.toLowerCase(),
        rid: rangeKey(range.tickLower, range.tickUpper),
        lowerPrice: TickMath.getWadAtTick(range.tickLower),
        upperPrice: TickMath.getWadAtTick(range.tickUpper),
        entryPrice: sqrtX96ToWad(range.sqrtEntryPX96),
    };
}
