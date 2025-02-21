import { Context, Plugin } from '@derivation-tech/context';
import { PerpModule, PerpModuleOptions } from './perp.module';
import { PerpInterface } from './perp.interface';

declare module '@derivation-tech/context' {
    interface Context {
        perp: PerpInterface;
    }
}

export const perpPlugin = (option?: PerpModuleOptions): Plugin => {
    return {
        install(context: Context): void {
            const perp = new PerpModule(context, option);

            context.addInitHook(async () => {
                await perp.configuration.update();
            });

            context.perp = perp;
        },
    };
};
