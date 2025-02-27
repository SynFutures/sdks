import { formatEther } from 'ethers/lib/utils';
import {
  Amm,
  Instrument,
  Order,
  Portfolio,
  Position,
  Range,
  RawAmm,
  RawPosition,
  SimulateAddLiquidityResult,
  SimulateAddLiquidityWithAsymmetricRangeResult,
  SimulateAdjustMarginByLeverageResult,
  SimulateAdjustMarginByMarginResult,
  SimulateCrossMarketOrderResult,
  SimulateLimitOrderResult,
  SimulateRemoveLiquidityResult,
  SimulateScaledLimitOrderResult,
  SimulateTradeResult,
} from '../types';
import {
  orderLeverage,
  positionEquity,
  positionLeverage,
  positionLiquidationPrice,
  positionUnrealizedFundingFee,
  positionUnrealizedPnl,
  rangeFeeEarned,
  rangeLowerPositionIfRemove,
  rangeUpperPositionIfRemove,
  rangeValueLocked,
} from './calculation';
import { factory } from '.';
import { ZERO } from '../math';
import { Side } from '../enum';

export function groupBy<T, K>(arr: T[], fn: (item: T) => K): Map<K, T[]> {
  return arr.reduce((map, curr) => {
    const key = fn(curr);
    const group = map.get(key);

    if (group) {
      group.push(curr);
    } else {
      map.set(key, [curr]);
    }
    return map;
  }, new Map<K, T[]>());
}

export function calcPositionLiquidationPrice(amm: RawAmm, position: RawPosition, maintenanceMarginRatio?: number) {
  if (position.size.isZero() || position.balance.isZero()) return ZERO;
  return positionLiquidationPrice(position, amm, maintenanceMarginRatio);
}
function _formatOrder(order: Order, amm: Amm) {
  const formattedOrder = {
    side: Side[order.side],
    size: formatEther(order.size),
    Filled: formatEther(order.taken),
    'Order Price': formatEther(order.limitPrice),
    Margin: formatEther(order.balance),
    Leverage: formatEther(orderLeverage(order, amm)),
  };

  return formattedOrder;
}

export function formatOrder(order: Order, amm: Amm) {
  return JSON.stringify(_formatOrder(order, amm), null, 2);
}

function _formatRange(range: Range, amm: Amm, maintenanceMarginRatio: number) {
  const upperRawPosition = rangeUpperPositionIfRemove(range, amm);
  const upperPosition = factory.createPosition({
    ...upperRawPosition,
    instrumentAddr: range.instrumentAddr,
    expiry: range.expiry,
    traderAddr: range.traderAddr,
  });
  // lower position
  const lowerRawPosition = rangeLowerPositionIfRemove(range, amm);
  const lowerPosition = factory.createPosition({
    ...lowerRawPosition,
    instrumentAddr: range.instrumentAddr,
    expiry: range.expiry,
    traderAddr: range.traderAddr,
  });

  const lowerLiquidationPrice = positionLiquidationPrice(lowerPosition, amm, maintenanceMarginRatio);
  const upperLiquidationPrice = positionLiquidationPrice(upperPosition, amm, maintenanceMarginRatio);
  const formattedRange = {
    'Price Range': `${formatEther(range.lowerPrice)} - ${formatEther(range.upperPrice)}`,
    'Fair Price': formatEther(amm.fairPrice),
    'Value Locked': formatEther(rangeValueLocked(range, amm)),
    'Fees Earned': formatEther(rangeFeeEarned(range, amm)),
    'Liquidation Price': `${formatEther(lowerLiquidationPrice)} - ${formatEther(upperLiquidationPrice)}`,
  };
  return formattedRange;
}

export function formatRange(range: Range, amm: Amm, maintenanceMarginRatio: number) {
  return JSON.stringify(_formatRange(range, amm, maintenanceMarginRatio), null, 2);
}

function _formatPosition(position: Position, amm: Amm, maintenanceMarginRatio: number) {
  const formattedPosition = {
    side: Side[position.side],
    size: formatEther(position.size),
    'Avg.Price': formatEther(position.entryPrice),
    Margin: formatEther(positionEquity(position, amm)),
    Leverage: formatEther(positionLeverage(position, amm)),
    'Liq.Price': formatEther(calcPositionLiquidationPrice(amm, position, maintenanceMarginRatio)),
    'Mark Price': formatEther(amm.markPrice),
    'Unrealized P&L': formatEther(positionUnrealizedPnl(position, amm)),
    'Unrealized Funding': formatEther(positionUnrealizedFundingFee(position, amm)),
  };
  return formattedPosition;
}

export function formatPosition(position: Position, amm: Amm, maintenanceMarginRatio: number) {
  return JSON.stringify(_formatPosition(position, amm, maintenanceMarginRatio), null, 2);
}

function _formatPositionWithoutPnL(position: Position, amm: Amm, maintenanceMarginRatio: number) {
  const formattedPosition = {
    side: Side[position.side],
    size: formatEther(position.size),
    'Avg.Price': formatEther(position.entryPrice),
    Margin: formatEther(positionEquity(position, amm)),
    Leverage: formatEther(positionLeverage(position, amm)),
    'Liq.Price': formatEther(calcPositionLiquidationPrice(amm, position, maintenanceMarginRatio)),
    'Mark Price': formatEther(amm.markPrice),
  };
  return formattedPosition;
}

export function formatPositionWithoutPnL(position: Position, amm: Amm, maintenanceMarginRatio: number) {
  return JSON.stringify(_formatPositionWithoutPnL(position, amm, maintenanceMarginRatio), null, 2);
}

function _formatAmm(amm: Amm) {
  const formattedAmm = {
    expiry: amm.expiry,
    markPrice: formatEther(amm.markPrice),
    fairPrice: formatEther(amm.fairPrice),
  };
  return formattedAmm;
}

export function formatAmm(amm: Amm) {
  return JSON.stringify(_formatAmm(amm), null, 2);
}

function _formatInstrument(instrument: Instrument) {
  const formattedInstrument = {
    instrumentAddr: instrument.instrumentAddr,
    symbol: instrument.symbol,
    spotPrice: formatEther(instrument.spotPrice),
    amms: Object.fromEntries(Array.from(instrument.amms).map(([expiry, amm]) => [expiry, _formatAmm(amm)])),
  };

  return formattedInstrument;
}

export function formatInstrument(instrument: Instrument) {
  return JSON.stringify(_formatInstrument(instrument), null, 2);
}

export function formatPortfolio(portfolio: Portfolio, instrument: Instrument) {
  const maintenanceMarginRatio = instrument.setting.maintenanceMarginRatio;
  const formattedPortfolio = {
    ...portfolio,
    position: portfolio.position.size.isZero()
      ? null
      : formatPosition(
          portfolio.position,
          instrument.amms.get(portfolio.position.expiry) as Amm,
          instrument.setting.maintenanceMarginRatio,
        ),
    orders: Object.fromEntries(
      Array.from(portfolio.orders).map(([oid, order]) => [
        oid,
        formatOrder(order, instrument.amms.get(order.expiry) as Amm),
      ]),
    ),
    ranges: Object.fromEntries(
      Array.from(portfolio.ranges).map(([rid, range]) => [
        rid,
        formatRange(range, instrument.amms.get(range.expiry) as Amm, maintenanceMarginRatio),
      ]),
    ),
  };

  return JSON.stringify(formattedPortfolio, null, 2);
}

export function formatSimulateAddLiquidityResult(
  result: SimulateAddLiquidityResult,
  amm: Amm,
  maintenanceMarginRatio: number,
) {
  const formattedResult = {
    'Current Price': formatEther(amm.fairPrice),
    'Capital Efficiency Boost': result.capitalEfficiencyBoost,
    'Removal Price': formatEther(result.lowerPrice) + ' ~ ' + formatEther(result.upperPrice),
    'Liquidation Price':
      formatEther(calcPositionLiquidationPrice(amm, result.lowerPosition, maintenanceMarginRatio)) +
      ' ~ ' +
      formatEther(calcPositionLiquidationPrice(amm, result.upperPosition, maintenanceMarginRatio)),
    minEffectiveQuoteAmount: formatEther(result.minEffectiveQuoteAmount),
    minMargin: formatEther(result.minMargin),
  };

  return JSON.stringify(formattedResult, null, 2);
}

export function formatSimulateAddLiquidityWithAsymmetricRangeResult(
  result: SimulateAddLiquidityWithAsymmetricRangeResult,
  amm: Amm,
  maintenanceMarginRatio: number,
) {
  const formattedResult = {
    'Current Price': formatEther(amm.fairPrice),
    'Capital Efficiency Boost': result.capitalEfficiencyBoost,
    'Removal Price': formatEther(result.lowerPrice) + ' ~ ' + formatEther(result.upperPrice),
    'Liquidation Price':
      formatEther(calcPositionLiquidationPrice(amm, result.lowerPosition, maintenanceMarginRatio)) +
      ' ~ ' +
      formatEther(calcPositionLiquidationPrice(amm, result.upperPosition, maintenanceMarginRatio)),
    minEffectiveQuoteAmount: formatEther(result.minEffectiveQuoteAmount),
    minMargin: formatEther(result.minMargin),
  };

  return JSON.stringify(formattedResult, null, 2);
}

export function formatSimulateRemoveLiquidityResult(
  result: SimulateRemoveLiquidityResult,
  amm: Amm,
  maintenanceMarginRatio: number,
) {
  const formattedResult = {
    'Removed position': _formatPositionWithoutPnL(result.removedPosition, amm, maintenanceMarginRatio),
    'Post position': _formatPositionWithoutPnL(result.postPosition, amm, maintenanceMarginRatio),
  };

  return JSON.stringify(formattedResult, null, 2);
}

function _formatSimulateMarketOrderResult(result: SimulateTradeResult, amm: Amm, maintenanceMarginRatio: number) {
  const formattedResult = {
    'Price Impact': Number(formatEther(result.priceImpact)) * 100 + '%',
    'Est. Trade Value': formatEther(result.tradeValue),
    'Trading Fee': formatEther(result.tradingFee),
    Margin: formatEther(result.margin),
    Leverage: formatEther(result.leverage),
    'Post position': _formatPositionWithoutPnL(result.postPosition, amm, maintenanceMarginRatio),
  };

  return formattedResult;
}

export function formatSimulateMarketOrderResult(result: SimulateTradeResult, amm: Amm, maintenanceMarginRatio: number) {
  return JSON.stringify(_formatSimulateMarketOrderResult(result, amm, maintenanceMarginRatio), null, 2);
}

export function formatSimulateAdjustMarginByMarginResult(
  result: SimulateAdjustMarginByMarginResult,
  amm: Amm,
  maintenanceMarginRatio: number,
) {
  const formattedResult = {
    Leverage: formatEther(result.leverage),
    'Post position': _formatPositionWithoutPnL(result.postPosition, amm, maintenanceMarginRatio),
  };
  return JSON.stringify(formattedResult, null, 2);
}

export function formatSimulateAdjustMarginByLeverageResult(
  result: SimulateAdjustMarginByLeverageResult,
  amm: Amm,
  maintenanceMarginRatio: number,
) {
  const formattedResult = {
    'Transfer In': result.transferIn,
    Margin: formatEther(result.margin),
    'Post position': _formatPositionWithoutPnL(result.postPosition, amm, maintenanceMarginRatio),
  };
  return JSON.stringify(formattedResult, null, 2);
}

function _formatSimulateLimitOrderResult(result: SimulateLimitOrderResult) {
  const formattedResult = {
    Margin: formatEther(result.margin),
    'Est. Trade Value': formatEther(result.tradeValue),
    'Fee Rebate': formatEther(result.minFeeRebate),
    limitPrice: formatEther(result.limitPrice),
    leverage: formatEther(result.leverage),
  };
  return formattedResult;
}

export function formatSimulateLimitOrderResult(result: SimulateLimitOrderResult) {
  return JSON.stringify(_formatSimulateLimitOrderResult(result), null, 2);
}

export function formatSimulateBatchPlaceResult(result: SimulateScaledLimitOrderResult) {
  const orders = [];
  for (let i = 0; i < result.orders.length; i++) {
    if (result.orders[i]) {
      orders.push({
        'Order Price': formatEther(result.orders[i]!.limitPrice),
        tick: result.orders[i]!.tick,
        margin: formatEther(result.orders[i]!.margin),
        leverage: formatEther(result.orders[i]!.leverage),
        minFeeRebate: formatEther(result.orders[i]!.minFeeRebate),
      });
    }
  }
  const formattedResult = {
    orders: orders,
  };

  return JSON.stringify(formattedResult, null, 2);
}

export function formatSimulateCrossMarketOrderResult(
  result: SimulateCrossMarketOrderResult,
  amm: Amm,
  maintenanceMarginRatio: number,
) {
  const formattedResult = {
    'Can Place Order': result.canPlaceOrder,
    minOrderSize: formatEther(result.minOrderSize),
    'Trade Simulation': _formatSimulateMarketOrderResult(result.tradeSimulation, amm, maintenanceMarginRatio),
    'Order Simulation': _formatSimulateLimitOrderResult(result.orderSimulation),
  };
  return JSON.stringify(formattedResult, null, 2);
}
