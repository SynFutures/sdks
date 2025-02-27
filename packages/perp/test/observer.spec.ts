/* eslint-disable @typescript-eslint/no-explicit-any */
import fs from 'fs';
import path from 'path';
import { deserialize, serialize } from './utils';
import { Context } from '@derivation-tech/context';
import { perpPlugin } from '../src';
import * as dotenv from 'dotenv';

dotenv.config();

describe('Observer plugin', () => {
    const url = process.env['BASE_RPC'];
    if (url === undefined) {
        console.log('Please provide a base RPC URL, skip testing');
        return;
    }

    const context = new Context('base', { url }).use(perpPlugin());

    const predefinedData = JSON.parse(
        fs.readFileSync(path.join(__dirname, './fixtures/', 'observer.fixtures.json'), 'utf8'),
    );

    for (const key of Object.keys(predefinedData)) {
        it(`Test ${key}`, async () => {
            const datas = predefinedData[key];
            for (const data of datas) {
                const input = deserialize(data.input);
                const result = await (context.perp.observer as any)[key](...input);
                expect(serialize(result)).toEqual(data.output);
            }
        });
    }

    beforeAll(async () => {
        await context.init();
    });
});
