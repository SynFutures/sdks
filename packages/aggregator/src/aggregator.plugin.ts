import { Context } from '@derivation-tech/context';
import { AggregatorModule } from './aggregator.module';
import { AggregatorInterface } from './aggregator.interface';

declare module '@derivation-tech/context' {
  interface Context {
    aggregator: AggregatorInterface;
  }
}

export const aggregatorPlugin = () => {
  return {
    install(ctx: Context) {
      ctx.aggregator = new AggregatorModule(ctx);
    },
  };
};
