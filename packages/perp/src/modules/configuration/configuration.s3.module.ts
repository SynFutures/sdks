import axios from 'axios';
import { Context } from '@derivation-tech/context';
import { SynFuturesConfig } from '../../types';
import { loadConfig } from '../../utils';
import { ConfigurationModuleBase } from './configuration.base.module';
import { LocalConfigurationModule } from './configuration.local.module';

export class S3ConfigurationModule extends ConfigurationModuleBase {
    basePath: string;
    localConfigurationModule: LocalConfigurationModule;

    constructor(context: Context, basePath?: string) {
        super(context);
        this.basePath = basePath ?? 'https://api.synfutures.com/s3/config/sdkConfig';
        this.localConfigurationModule = new LocalConfigurationModule(context);
    }

    protected async getConfig(): Promise<SynFuturesConfig | null> {
        const url = this.basePath + '/' + this.context.chainId + '.json';
        const res = await axios.get(url);
        if (res.status !== 200) {
            return this.localConfigurationModule.config;
        }
        return loadConfig(res.data);
    }

    async update(): Promise<void> {
        await this.localConfigurationModule.update();
        await super.update();
    }
}
