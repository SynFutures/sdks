import { BigNumber } from 'ethers';
import { safeWDiv, WAD } from '../math';
import { Side } from '../enum';
import { Portfolio, Instrument, Amm, Order, Position, Range } from '../types';

export function reverseSide(side: Side): Side {
  return side === Side.LONG ? Side.SHORT : side === Side.SHORT ? Side.LONG : Side.FLAT;
}

export function reversePrice(price: BigNumber) {
  return safeWDiv(WAD, price);
}

export function reverseOrder(order: Order): Order {
  return {
    ...order,
    size: order.size.mul(-1),
    side: reverseSide(order.side),
    limitPrice: reversePrice(order.limitPrice),
    isInverse: !order.isInverse,
  };
}

export function reversePosition(position: Position): Position {
  return {
    ...position,
    size: position.size.mul(-1),
    side: reverseSide(position.side),
    entryPrice: reversePrice(position.entryPrice),
    isInverse: !position.isInverse,
  };
}

export function reverseRange(range: Range): Range {
  return {
    ...range,
    tickLower: range.tickUpper,
    tickUpper: range.tickLower,
    lowerPrice: reversePrice(range.upperPrice),
    upperPrice: reversePrice(range.lowerPrice),
    entryPrice: reversePrice(range.entryPrice),
    isInverse: !range.isInverse,
  };
}

export function reversePortfolio(portfolio: Portfolio): Portfolio {
  return {
    ...portfolio,
    orders: new Map<number, Order>(
      Array.from(portfolio.orders.entries()).map(([oid, order]) => [oid, reverseOrder(order)]),
    ),
    ranges: new Map<number, Range>(
      Array.from(portfolio.ranges.entries()).map(([rid, range]) => [rid, reverseRange(range)]),
    ),
    position: reversePosition(portfolio.position),
    isInverse: !portfolio.isInverse,
  };
}

export function reverseAmm(amm: Amm): Amm {
  return {
    ...amm,
    totalLong: amm.totalShort,
    totalShort: amm.totalLong,
    shortFundingIndex: amm.longFundingIndex,
    longFundingIndex: amm.shortFundingIndex,
    shortSocialLossIndex: amm.longSocialLossIndex,
    longSocialLossIndex: amm.shortSocialLossIndex,
    settlementPrice: reversePrice(amm.settlementPrice),
    markPrice: reversePrice(amm.markPrice),
    fairPrice: reversePrice(amm.fairPrice),
    isInverse: !amm.isInverse,
  };
}

export function reverseInstrument(instrument: Instrument): Instrument {
  return {
    ...instrument,
    spotPrice: reversePrice(instrument.spotPrice),
    amms: new Map<number, Amm>(Array.from(instrument.amms.entries()).map(([expiry, amm]) => [expiry, reverseAmm(amm)])),
    isInverse: !instrument.isInverse,
    displayBase: instrument.displayQuote,
    displayQuote: instrument.displayBase,
  };
}

export function reversePriceInfo(priceInfo: BigNumber | number): BigNumber | number {
  return typeof priceInfo === 'number' ? priceInfo : reversePrice(priceInfo);
}
