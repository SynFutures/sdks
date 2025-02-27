import axios from 'axios';
import { CHAIN_ID, Context } from '@derivation-tech/context';
import { SynFuturesConfig } from '../../types';
import { loadConfig } from '../../utils';
import { ConfigurationModuleBase } from './configuration.base.module';

// TODO: improve @samlior
const suppotedChainId = new Set<CHAIN_ID>([CHAIN_ID.BASE, CHAIN_ID.BLAST]);

export class S3ConfigurationModule extends ConfigurationModuleBase {
  basePath: string;

  constructor(context: Context, basePath?: string) {
    super(context);
    this.basePath = basePath ?? 'https://api.synfutures.com/s3/config/sdkConfig';
  }

  protected async getConfig(): Promise<SynFuturesConfig | null> {
    if (!suppotedChainId.has(this.context.chainId)) {
      return null;
    }

    const url = this.basePath + '/' + this.context.chainId + '.json';
    const res = await axios.get(url);
    return loadConfig(res.data);
  }
}
