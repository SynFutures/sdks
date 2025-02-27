import { CallOverrides, BigNumber } from 'ethers';
import {
  Portfolio,
  Instrument,
  FetchInstrumentParam,
  FetchPortfolioParam,
  Amm,
  Position,
  Quotation,
  InstrumentIdentifier,
} from '../../types';
import { Side } from '../../enum';
import {
  reverseAmm,
  reverseInstrument,
  reversePortfolio,
  reversePosition,
  reversePrice,
  reverseSide,
} from '../../utils';
import { ObserverModule } from '../observer.module';

export class InverseObserverModule extends ObserverModule {
  getPortfolio(params: FetchPortfolioParam, overrides?: CallOverrides): Promise<Portfolio>;
  getPortfolio(params: FetchPortfolioParam[], overrides?: CallOverrides): Promise<Portfolio[]>;
  async getPortfolio(
    params: FetchPortfolioParam | FetchPortfolioParam[],
    overrides?: CallOverrides,
  ): Promise<Portfolio | Portfolio[]> {
    const result: Portfolio | Portfolio[] = await super.getPortfolio(params as FetchPortfolioParam, overrides);

    const portfolios = await Promise.all(
      (Array.isArray(result) ? result : [result]).map((p: Portfolio) =>
        this.context.perp.configuration
          .isInverse(p.instrumentAddr)
          .then((isInverse) => (isInverse ? reversePortfolio(p) : p)),
      ),
    );

    return portfolios.length === 1 ? portfolios[0] : portfolios;
  }

  async getAllInstruments(overrides?: CallOverrides): Promise<Instrument[]> {
    const instruments = await super.getAllInstruments(overrides);

    return await Promise.all(
      instruments.map((i) =>
        this.context.perp.configuration
          .isInverse(i.instrumentAddr)
          .then((isInverse) => (isInverse ? reverseInstrument(i) : i)),
      ),
    );
  }

  getInstrument(params: FetchInstrumentParam | string, overrides?: CallOverrides): Promise<Instrument>;
  getInstrument(params: (FetchInstrumentParam | string)[], overrides?: CallOverrides): Promise<Instrument[]>;
  async getInstrument(
    params: FetchInstrumentParam | string | (FetchInstrumentParam | string)[],
    overrides?: CallOverrides,
  ): Promise<Instrument | Instrument[]> {
    const instrument: Instrument | undefined | Instrument[] = await super.getInstrument(params as string, overrides);

    if (!Array.isArray(instrument)) {
      const isInverse = await this.context.perp.configuration.isInverse(instrument.instrumentAddr);

      return isInverse ? reverseInstrument(instrument) : instrument;
    } else {
      return await Promise.all(
        instrument.map((i) =>
          this.context.perp.configuration
            .isInverse(i.instrumentAddr)
            .then((isInverse) => (isInverse ? reverseInstrument(i) : i)),
        ),
      );
    }
  }

  async getPositionIfSettle(portfolio: Portfolio, amm: Amm): Promise<Position> {
    const isInverse = await this.context.perp.configuration.isInverse(portfolio.instrumentAddr);

    const position = await super.getPositionIfSettle(
      isInverse ? reversePortfolio(portfolio) : portfolio,
      isInverse ? reverseAmm(amm) : amm,
    );

    return isInverse ? reversePosition(position) : position;
  }

  async inquireByBase(
    instrumentAddr: string,
    expiry: number,
    side: Side,
    baseAmount: BigNumber,
    overrides?: CallOverrides,
  ): Promise<{ quoteAmount: BigNumber; quotation: Quotation }> {
    const isInverse = await this.context.perp.configuration.isInverse(instrumentAddr);

    return await super.inquireByBase(
      instrumentAddr,
      expiry,
      isInverse ? reverseSide(side) : side,
      baseAmount,
      overrides,
    );
  }

  async inquireByQuote(
    instrumentAddr: string,
    expiry: number,
    side: Side,
    quoteAmount: BigNumber,
    overrides?: CallOverrides,
  ): Promise<{ baseAmount: BigNumber; quotation: Quotation }> {
    const isInverse = await this.context.perp.configuration.isInverse(instrumentAddr);

    return await super.inquireByQuote(
      instrumentAddr,
      expiry,
      isInverse ? reverseSide(side) : side,
      quoteAmount,
      overrides,
    );
  }

  async getRawSpotPrice(identifier: InstrumentIdentifier, overrides?: CallOverrides): Promise<BigNumber> {
    const isInverse = await this.context.perp.configuration.isInverseByIdentifier(identifier);

    const result = await super.getRawSpotPrice(identifier, overrides);

    return isInverse ? reversePrice(result) : result;
  }
}
