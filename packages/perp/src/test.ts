import { Context } from "@derivation-tech/context";
import { perpPlugin } from "./perp.plugin";

async function main() {
    const ctx = new Context('monadTestnet', {
        providerOps: {
            url: process.env.MONADTESTNET_RPC
        }
    }).use(perpPlugin({ configuration: 'local' }))
    await ctx.init();

    const allInstruments = await ctx.perp.observer.getAllInstruments();
    console.log('allinstruments', allInstruments);
}

main().catch(console.error)