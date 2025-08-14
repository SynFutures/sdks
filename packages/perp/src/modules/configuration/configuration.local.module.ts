import { CHAIN_ID } from '@derivation-tech/context';
import { SynFuturesConfig } from '../../types';
import { loadConfig } from '../../utils';
import * as localConfig from './config/local.json';
import * as goerliConfig from './config/goerli.json';
import * as polygonConfig from './config/polygon.json';
import * as scrollConfig from './config/scroll.json';
import * as lineaConfig from './config/linea.json';
import * as arbitrumConfig from './config/arbitrum.json';
import * as blastsepoliaConfig from './config/blastsepolia.json';
import * as blastConfig from './config/blast.json';
import * as baseConfig from './config/base.json';
import * as monadTestnetConfig from './config/monadTestnet.json';
import * as gelatoConfig from './config/gelato.json';
import * as conduitConfig from './config/conduit.json';
import { ConfigurationModuleBase } from './configuration.base.module';

export class LocalConfigurationModule extends ConfigurationModuleBase {
    protected async getConfig(): Promise<SynFuturesConfig | null> {
        switch (this.context.chainId) {
            case CHAIN_ID.LOCAL: {
                return loadConfig(localConfig);
            }
            case CHAIN_ID.GOERLI: {
                return loadConfig(goerliConfig);
            }
            case CHAIN_ID.POLYGON: {
                return loadConfig(polygonConfig);
            }
            case CHAIN_ID.SCROLL: {
                return loadConfig(scrollConfig);
            }
            case CHAIN_ID.LINEA: {
                return loadConfig(lineaConfig);
            }
            case CHAIN_ID.ARBITRUM: {
                return loadConfig(arbitrumConfig);
            }
            case CHAIN_ID.BLASTSEPOLIA: {
                return loadConfig(blastsepoliaConfig);
            }
            case CHAIN_ID.BLAST: {
                return loadConfig(blastConfig);
            }
            case CHAIN_ID.BASE: {
                return loadConfig(baseConfig);
            }
            case CHAIN_ID.MONADTESTNET: {
                return loadConfig(monadTestnetConfig);
            }
            case CHAIN_ID.GELATO: {
                return loadConfig(gelatoConfig);
            }
            case CHAIN_ID.CONDUIT: {
                return loadConfig(conduitConfig);
            }
            default: {
                return null;
            }
        }
    }
}
