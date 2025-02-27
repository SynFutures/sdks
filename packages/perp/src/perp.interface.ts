import {
  CalcInterface,
  ConfigInterface,
  ConfigurationInterface,
  GateInterface,
  InstrumentInterface,
  ObserverInterface,
  SimulateInterface,
} from './modules';
import { SynFuturesV3Contracts, TokenInfo } from './types';

export interface PerpInterface {
  contracts: SynFuturesV3Contracts;

  calc: CalcInterface;

  config: ConfigInterface;

  gate: GateInterface;

  instrument: InstrumentInterface;

  observer: ObserverInterface;

  simulate: SimulateInterface;

  configuration: ConfigurationInterface;

  _observer: ObserverInterface;

  /**
   * Register new quote info
   * @param tokenInfo {@link TokenInfo}
   */
  registerQuoteInfo(tokenInfo: TokenInfo): void;
}
