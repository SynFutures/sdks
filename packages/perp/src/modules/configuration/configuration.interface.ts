import { InstrumentIdentifier, SynFuturesConfig } from '../../types';

export interface ConfigurationInterface {
    config: SynFuturesConfig;

    update(): Promise<void>;

    isInverse(instrument: string): Promise<boolean>;

    isInverseByIdentifier(instrument: InstrumentIdentifier): Promise<boolean>;
}
