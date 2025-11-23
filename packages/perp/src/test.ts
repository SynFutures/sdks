import { Context } from '@derivation-tech/context';
import { perpPlugin } from './perp.plugin';
import { DefaultEthGasEstimator, txPlugin } from '@derivation-tech/tx-plugin';

async function main(): Promise<void> {
    const ctx = new Context('monad', {
        providerOps: {
            url: process.env.MONAD_RPC,
        },
    })
        .use(perpPlugin({ configuration: 'local' }))
        .use(txPlugin({ gasEstimator: new DefaultEthGasEstimator() }));
    await ctx.init();

    const allInstruments = await ctx.perp.observer.getAllInstruments();
    console.log(allInstruments);
}

main().catch(console.error);
