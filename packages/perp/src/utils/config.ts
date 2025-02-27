import { BigNumber } from 'ethers';
import { SynfConfigJson, QuoteParamJson, SynFuturesConfig, QuoteParam } from '../types';
import { QuoteType } from '../enum';

export function loadConfig(json: SynfConfigJson): SynFuturesConfig {
  const quotesParam: { [key in string]?: QuoteParam } = {};

  for (const symbol in json.quotesParam) {
    const item: QuoteParamJson = json.quotesParam[symbol]!;
    quotesParam[symbol] = {
      tradingFeeRatio: item.tradingFeeRatio,
      stabilityFeeRatioParam: BigNumber.from(item.stabilityFeeRatioParam),
      protocolFeeRatio: item.protocolFeeRatio,
      qtype: Number(item.qtype) as QuoteType,
      minMarginAmount: BigNumber.from(item.minMarginAmount),
      tip: BigNumber.from(item.tip),
    } as QuoteParam;
  }

  const config: SynFuturesConfig = {
    ...json,
    quotesParam,
  };

  return config;
}
