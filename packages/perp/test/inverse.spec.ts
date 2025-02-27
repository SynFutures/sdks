/* eslint-disable @typescript-eslint/no-explicit-any */
import fs from 'fs';
import path from 'path';
import { Context } from '@derivation-tech/context';
import { perpPlugin } from '../src';
import { deserialize, serialize } from './utils';
import * as dotenv from 'dotenv';

dotenv.config();

describe('Inverse plugin Test', () => {
    const url = process.env['BASE_RPC'];

    if (url === undefined) {
        console.log('Please provide a base RPC URL, skip testing');
        return;
    }

    const context = new Context('base', { url }).use(perpPlugin({ inverse: true }));

    beforeAll(async () => {
        await context.init();
    });

    const predefinedData = JSON.parse(
        fs.readFileSync(path.join(__dirname, './fixtures/', 'inverse.fixtures.json'), 'utf8'),
    );

    for (const key of Object.keys(predefinedData)) {
        for (const key2 of Object.keys(predefinedData[key])) {
            it(`Test ${key}.${key2}`, async () => {
                const datas = predefinedData[key][key2];
                for (const data of datas) {
                    const input = deserialize(data.input);
                    const result = await (context.perp as any)[key][key2](...input);
                    expect(serialize(result)).toEqual(data.output);
                }
            });
        }
    }

    beforeAll(async () => {
        await context.init();
    });
});
