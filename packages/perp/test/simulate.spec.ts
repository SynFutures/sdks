/* eslint-disable @typescript-eslint/no-explicit-any */
import fs from 'fs';
import path from 'path';
import { deserialize, serialize } from './utils';
import { Context } from '@derivation-tech/context';
import { MarketType, PERP_EXPIRY, perpPlugin } from '../src';
import * as dotenv from 'dotenv';
import { parseEther } from 'ethers/lib/utils';

dotenv.config();

describe('Simulate plugin', () => {
    const url = process.env['BASE_RPC'];
    if (url === undefined) {
        console.log('Please provide a base RPC URL, skip testing');
        return;
    }

    const context = new Context('base', { url }).use(perpPlugin());

    const predefinedData = JSON.parse(
        fs.readFileSync(path.join(__dirname, './fixtures/', 'simulate.fixtures.json'), 'utf8'),
    );

    for (const key of Object.keys(predefinedData)) {
        it(`Test ${key}`, async () => {
            const datas = predefinedData[key];
            for (const data of datas) {
                const input = deserialize(data.input);
                const result = await (context.perp.simulate as any)[key](...input);
                expect(serialize(result)).toEqual(data.output);
            }
        });
    }

    beforeAll(async () => {
        await context.init();
    });

    it('Test simulateImpermanentLoss', async () => {
        const result = await context.perp.simulate.simulateImpermanentLoss({
            instrument: {
                marketType: MarketType.LINK,
                baseSymbol: 'BTC',
                quoteSymbol: 'USDC',
            },
            expiry: PERP_EXPIRY,
            alphaWadLower: parseEther('2'),
            alphaWadUpper: parseEther('3'),
        });

        for (const r of result) {
            expect(r.impermanentLoss).toBeLessThanOrEqual(0);
        }
    });
});
