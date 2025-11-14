import { ethers } from 'ethers';
import { ContractParser, Context } from '@derivation-tech/context';
import {
    Beacon__factory,
    CexMarket__factory,
    DexV2Market__factory,
    EmergingFeederFactory__factory,
    Guardian__factory,
    PythFeederFactory__factory,
} from '../../typechain';
import {
    Gate__factory as LegacyGate__factory,
    Observer__factory as LegacyObserver__factory,
    Config__factory as LegacyConfig__factory,
} from '../../typechain';
import {
    Gate__factory as CurrentGate__factory,
    Observer__factory as CurrentObserver__factory,
    Config__factory as CurrentConfig__factory,
} from '../../typechain/current/factories';

import {
    SynFuturesConfig,
    InstrumentIdentifier,
    SynFuturesV3Contracts,
    MarketContracts,
    FeederFactoryContracts,
} from '../../types';
import { MarketType } from '../../enum';
import { isCexMarket, isLegacyChain } from '../../utils';
import { CexMarketParser, ConfigParser, DexV2MarketParser, GateParser, GuardianParser } from '../../parser';
import { ConfigurationInterface } from './configuration.interface';
import { SynfError } from '../../errors';

export abstract class ConfigurationModuleBase implements ConfigurationInterface {
    context: Context;

    config: SynFuturesConfig;

    private instrumentIdentifiers = new Map<string, InstrumentIdentifier>();

    constructor(context: Context) {
        this.context = context;
    }

    protected abstract getConfig(): Promise<SynFuturesConfig | null>;

    protected registerContracts() {
        this.context.registerAddress(this.config.contractAddress.gate, 'Gate');
        this.context.registerAddress(this.config.contractAddress.observer, 'Observer');
        this.context.registerAddress(this.config.contractAddress.config, 'Config');
        this.context.registerContractParser(this.config.contractAddress.gate, new GateParser(this.context));
        this.context.registerContractParser(this.config.contractAddress.config, new ConfigParser());
        if (this.config.contractAddress.guardian) {
            this.context.registerAddress(this.config.contractAddress.guardian, 'Guardian');
            this.context.registerContractParser(this.config.contractAddress.guardian, new GuardianParser());
        }

        for (const marketType in this.config.contractAddress.market) {
            const marketAddress = this.config.contractAddress.market[marketType as MarketType]!;
            this.context.registerAddress(marketAddress.market, `${marketType}-Market`);
            this.context.registerAddress(marketAddress.beacon, `${marketType}-InstrumentBeacon`);
            if (isCexMarket(marketType as MarketType)) {
                this.context.registerContractParser(marketAddress.market, new CexMarketParser());
            } else {
                this.context.registerContractParser(marketAddress.market, new DexV2MarketParser());
            }
        }

        for (const marketType in this.config.contractAddress.feederFactory) {
            const feederFactoryAddress = this.config.contractAddress.feederFactory[marketType as MarketType]!;
            if (feederFactoryAddress.factory !== '' && feederFactoryAddress.beacon !== '') {
                this.context.registerAddress(feederFactoryAddress.factory, `${marketType}-FeederFactory`);
                this.context.registerAddress(feederFactoryAddress.beacon, `${marketType}-FeederBeacon`);
                if (marketType === MarketType.PYTH) {
                    this.context.registerContractParser(
                        feederFactoryAddress.factory,
                        new ContractParser(PythFeederFactory__factory.createInterface()),
                    );
                } else if (marketType === MarketType.EMG) {
                    this.context.registerContractParser(
                        feederFactoryAddress.factory,
                        new ContractParser(EmergingFeederFactory__factory.createInterface()),
                    );
                }
            }
        }

        if (this.config.tokenInfo) {
            for (const token of this.config.tokenInfo) {
                this.context.perp.registerQuoteInfo(token);
            }
        }
    }

    protected createContracts(provider: ethers.providers.Provider): SynFuturesV3Contracts {
        // At present, beacon for chainlink instrument and dexV2 instrument are the same contract (in InstrumentBeacon.sol).
        const marketContracts: { [key in MarketType]?: MarketContracts } = {};
        for (const marketType in this.config.contractAddress.market) {
            const mType = marketType as MarketType;
            const marketAddress = this.config.contractAddress.market[mType]!;
            marketContracts[mType] = {
                market: isCexMarket(mType)
                    ? CexMarket__factory.connect(marketAddress.market, provider)
                    : DexV2Market__factory.connect(marketAddress.market, provider),
                beacon: Beacon__factory.connect(marketAddress.beacon, provider),
            };
        }

        const feederFactoryContracts: { [key in MarketType]?: FeederFactoryContracts } = {};
        for (const marketType in this.config.contractAddress.feederFactory) {
            const mType = marketType as MarketType;
            const feederFactoryAddress = this.config.contractAddress.feederFactory[mType]!;
            if (feederFactoryAddress.factory !== '' && feederFactoryAddress.beacon !== '') {
                if (mType === MarketType.PYTH) {
                    feederFactoryContracts[mType] = {
                        factory: PythFeederFactory__factory.connect(feederFactoryAddress.factory, provider),
                        beacon: Beacon__factory.connect(feederFactoryAddress.beacon, provider),
                    };
                } else if (mType === MarketType.EMG) {
                    feederFactoryContracts[mType] = {
                        factory: EmergingFeederFactory__factory.connect(feederFactoryAddress.factory, provider),
                        beacon: Beacon__factory.connect(feederFactoryAddress.beacon, provider),
                    };
                } else {
                    throw new SynfError(`Invalid market type: ${mType}`);
                }
            }
        }

        // Select the appropriate factory based on the chain ID
        // For legacy chains (Base, Blast), use contracts with stabilityFeeRatioParam
        // For current chains, use contracts without stabilityFeeRatioParam
        const useLegacy = isLegacyChain(this.context.chainId);
        const observerContract = this.context.perp._observer.isLegacyObserver() ?
            LegacyObserver__factory.connect(this.config.contractAddress.observer, provider) : CurrentObserver__factory.connect(this.config.contractAddress.observer, provider);

        if (useLegacy) {
            // Use legacy factories for Base and Blast networks (with stabilityFeeRatioParam)
            return {
                gate: LegacyGate__factory.connect(this.config.contractAddress.gate, provider),
                observer: observerContract,
                config: LegacyConfig__factory.connect(this.config.contractAddress.config, provider),
                guardian: this.config.contractAddress.guardian
                    ? Guardian__factory.connect(this.config.contractAddress.guardian, provider)
                    : undefined,
                marketContracts: marketContracts,
                feederFactoryContracts: feederFactoryContracts,
            };
        } else {
            // Use current factories for new networks (without stabilityFeeRatioParam)
            return {
                gate: CurrentGate__factory.connect(this.config.contractAddress.gate, provider),
                observer: observerContract,
                config: CurrentConfig__factory.connect(this.config.contractAddress.config, provider),
                guardian: this.config.contractAddress.guardian
                    ? Guardian__factory.connect(this.config.contractAddress.guardian, provider)
                    : undefined,
                marketContracts: marketContracts,
                feederFactoryContracts: feederFactoryContracts,
            };
        }
    }

    onSetProvider() {
        // ignored if config does not exist
        if (this.config) {
            this.registerContracts();
            this.context.perp.contracts = this.createContracts(this.context.provider);
        }
    }

    async update() {
        const config = await this.getConfig();
        if (config) {
            this.config = config;
            this.registerContracts();
            this.context.perp.contracts = this.createContracts(this.context.provider);
        }
    }

    async isInverse(instrument: string): Promise<boolean> {
        instrument = instrument.toLowerCase();

        let identifier = this.instrumentIdentifiers.get(instrument);
        if (!identifier) {
            const _instrument = await this.context.perp._observer.getInstrument(instrument);
            if (!_instrument) {
                throw new SynfError('Unknown instrument: ' + instrument);
            }

            this.instrumentIdentifiers.set(
                instrument,
                (identifier = {
                    marketType: _instrument!.marketType,
                    baseSymbol: _instrument!.base,
                    quoteSymbol: _instrument!.quote,
                }),
            );
        }

        return this.isInverseByIdentifier(identifier);
    }

    async isInverseByIdentifier(identifier: InstrumentIdentifier): Promise<boolean> {
        const baseSymbol =
            typeof identifier.baseSymbol === 'string' ? identifier.baseSymbol : identifier.baseSymbol.symbol;
        const quoteSymbol =
            typeof identifier.quoteSymbol === 'string' ? identifier.quoteSymbol : identifier.quoteSymbol.symbol;
        const symbol = baseSymbol + '-' + quoteSymbol + '-' + identifier.marketType;
        return !!this.config.inversePairs?.includes(symbol);
    }
}
