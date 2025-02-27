/* eslint-disable @typescript-eslint/no-explicit-any */
import { BigNumber } from 'ethers';
import { ContractParser, formatWad } from '@derivation-tech/context';
import { Config__factory } from '../typechain';
import { LogDescription, TransactionDescription } from '@ethersproject/abi';
import { ErrorDescription } from '@ethersproject/abi/lib/interface';
import { ParamType } from 'ethers/lib/utils';
import { formatExpiry } from '../utils';
import { extractFeeRatioParams, formatRatio } from './farmat';
import { QuoteType } from '../enum';

export class ConfigParser extends ContractParser {
  constructor() {
    super(Config__factory.createInterface());
  }

  async parseBaseParam(
    _description: TransactionDescription | LogDescription | ErrorDescription,
    param: ParamType,
    data: any,
  ): Promise<string> {
    switch (param.name) {
      case 'tradingFeeRatio':
      case 'protocolFeeRatio':
        return formatRatio(data);
      case 'stabilityFeeRatioParam':
        return extractFeeRatioParams(BigNumber.from(data))
          .map((p) => formatWad(p))
          .toString();
      case 'tip':
      case 'minMarginAmount':
        return formatWad(data);
      case 'expiry':
        return formatExpiry(data);
      case 'qtype':
        return QuoteType[Number(data)];
      default:
        return data.toString();
    }
  }
}
