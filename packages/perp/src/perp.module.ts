import { Context, TokenInfo } from '@derivation-tech/context';
import {
  CalcInterface,
  ConfigInterface,
  GateInterface,
  InstrumentInterface,
  ObserverInterface,
  SimulateInterface,
  ConfigurationInterface,
  CalcModule,
  InverseCalcModule,
  ConfigModule,
  GateModule,
  InstrumentModule,
  ObserverModule,
  SimulateModule,
  S3ConfigurationModule,
  LocalConfigurationModule,
  InverseObserverModule,
  InverseInstrumentModule,
  InverseSimulateModule,
} from './modules';
import { PerpInterface } from './perp.interface';
import { SynFuturesV3Contracts } from './types';

export interface PerpModuleOptions {
  inverse?: boolean;
  configuration?: 'local' | 's3';
}

const defaultOptions: Required<PerpModuleOptions> = {
  inverse: false,
  configuration: 's3',
};

export class PerpModule implements PerpInterface {
  contracts: SynFuturesV3Contracts;

  calc: CalcInterface;

  config: ConfigInterface;

  gate: GateInterface;

  instrument: InstrumentInterface;

  observer: ObserverInterface;

  simulate: SimulateInterface;

  configuration: ConfigurationInterface;

  _observer: ObserverInterface;

  constructor(
    public context: Context,
    options?: PerpModuleOptions,
  ) {
    const { inverse, configuration } = {
      ...defaultOptions,
      ...options,
    };

    this.config = new ConfigModule(context);
    this.gate = new GateModule(context);
    this._observer = new ObserverModule(context);

    this.calc = inverse ? new InverseCalcModule(context) : new CalcModule(context);
    this.instrument = inverse ? new InverseInstrumentModule(context) : new InstrumentModule(context);
    this.observer = inverse ? new InverseObserverModule(context) : new ObserverModule(context);
    this.simulate = inverse ? new InverseSimulateModule(context) : new SimulateModule(context);

    this.configuration =
      configuration === 'local' ? new LocalConfigurationModule(context) : new S3ConfigurationModule(context);
  }

  registerQuoteInfo(tokenInfo: TokenInfo): void {
    this.context.tokenInfo.set(tokenInfo.symbol.toLowerCase(), tokenInfo);
    this.context.tokenInfo.set(tokenInfo.address.toLowerCase(), tokenInfo);
    this.context.registerAddress(tokenInfo.address, tokenInfo.symbol);
  }
}
