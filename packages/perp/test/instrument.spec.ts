import { ethers } from 'ethers';
import { PERP_EXPIRY, Side } from '../src';
import { addDeadline, estimateTx } from './utils';
import { Context } from '@derivation-tech/context';
import { txPlugin } from '@derivation-tech/tx-plugin';
import { perpPlugin } from '../src';
import * as dotenv from 'dotenv';

dotenv.config();

describe('Instrument plugin', () => {
  const url = process.env['BASE_RPC'];
  if (url === undefined) {
    console.log('Please provide a base RPC URL, skip testing');
    return;
  }
  const context = new Context('base', { url }).use(perpPlugin()).use(txPlugin());

  beforeAll(async () => {
    await context.init();
  });

  it('Add liquidity without launch new instrument', async () => {
    const blockNumber = 19661097;
    const expiry = PERP_EXPIRY;
    const instrumentAddr = '0xec6c44e704eb1932ec5fe1e4aba58db6fee71460';
    const traderAddr = '0xA84cefd4ce52E1B262cEF8823006778a6c1094D7';
    const margin = ethers.utils.parseUnits('170');
    const alphaWad = ethers.utils.parseEther('1.8');

    const instrument = await context.perp.observer.getInstrument(instrumentAddr, {
      blockTag: blockNumber,
    });
    const simulateRes = await context.perp.simulate.simulateAddLiquidity(
      {
        expiry,
        instrument: {
          marketType: instrument!.marketType,
          baseSymbol: instrument!.base,
          quoteSymbol: instrument!.quote,
        },
        alphaWad,
        margin,
        slippage: 50,
      },
      {
        blockTag: blockNumber,
      },
    );
    const tx = await context.perp.instrument.addLiquidity(
      {
        instrumentAddr,
        expiry,
        tickDeltaLower: simulateRes.tickDelta,
        tickDeltaUpper: simulateRes.tickDelta,
        margin,
        limitTicks: simulateRes.limitTicks,
        deadline: addDeadline(5),
      },
      {
        blockTag: blockNumber,
        disableGasLimit: true,
      },
    );
    await estimateTx(tx, traderAddr, blockNumber, context.provider);
  });

  it('Remove liquidity', async () => {
    const blockNumber = 19661097;
    const expiry = PERP_EXPIRY;
    const instrumentAddr = '0xec6c44e704eb1932ec5fe1e4aba58db6fee71460';
    const traderAddr = '0xcacde723b890ac82f3cba431bf4a56c36ac56e8b';
    const tickLower = 105750;
    const tickUpper = 113950;

    const simulateRes = await context.perp.simulate.simulateRemoveLiquidity(
      {
        tradeInfo: {
          instrumentAddr,
          expiry,
          traderAddr,
        },
        tickLower,
        tickUpper,
        slippage: 50,
      },
      {
        blockTag: blockNumber,
      },
    );
    const tx = await context.perp.instrument.removeLiquidity(
      {
        instrumentAddr,
        expiry,
        traderAddr,
        tickLower,
        tickUpper,
        limitTicks: simulateRes.limitTicks,
        deadline: addDeadline(5),
      },
      {
        blockTag: blockNumber,
        disableGasLimit: true,
      },
    );
    await estimateTx(tx, traderAddr, blockNumber, context.provider);
  });

  it('Place limit order', async () => {
    const blockNumber = 19661097;
    const expiry = PERP_EXPIRY;
    const instrumentAddr = '0xec6c44e704eb1932ec5fe1e4aba58db6fee71460';
    const traderAddr = '0xA84cefd4ce52E1B262cEF8823006778a6c1094D7';
    const price = ethers.utils.parseUnits('58334.636942');
    const quoteAmount = ethers.utils.parseUnits('1000');

    const simulateRes = await context.perp.simulate.simulateLimitOrder(
      {
        tradeInfo: {
          instrumentAddr,
          expiry,
          traderAddr,
        },
        priceInfo: price,
        size: { quote: quoteAmount },
        side: Side.LONG,
        leverage: ethers.utils.parseUnits('10'),
      },
      {
        blockTag: blockNumber,
      },
    );
    const tx = await context.perp.instrument.placeLimitOrder(
      {
        instrumentAddr,
        expiry,
        tick: simulateRes.tick,
        baseSize: simulateRes.size.base,
        margin: simulateRes.margin,
        side: Side.LONG,
        deadline: addDeadline(5),
      },
      {
        disableGasLimit: true,
      },
    );
    await estimateTx(tx, traderAddr, blockNumber, context.provider);
  });

  it('Cancel limit order', async () => {
    const blockNumber = 19661097;
    const expiry = PERP_EXPIRY;
    const instrumentAddr = '0xec6c44e704eb1932ec5fe1e4aba58db6fee71460';
    const traderAddr = '0xb4f0b57a7398656c96ac9014d618ddd2305e48e9';
    const tick = 110325;

    const tx = await context.perp.instrument.cancelLimitOrder(
      {
        instrumentAddr,
        expiry,
        tick,
        deadline: addDeadline(5),
      },
      {
        blockTag: blockNumber,
        disableGasLimit: true,
      },
    );
    await estimateTx(tx, traderAddr, blockNumber, context.provider);
  });

  it('Fill limit order', async () => {
    const blockNumber = 19655141;
    const expiry = PERP_EXPIRY;
    const instrumentAddr = '0xec6c44e704eb1932ec5fe1e4aba58db6fee71460';
    const traderAddr = '0xfc392b4c5c178237662e9ee1c8a08171c216e92d';
    const tick = 109620;
    const nonce = 231;

    const tx = await context.perp.instrument.fillLimitOrder(
      {
        instrumentAddr,
        expiry,
        target: traderAddr,
        tick,
        nonce,
      },
      {
        disableGasLimit: true,
      },
    );
    await estimateTx(tx, traderAddr, blockNumber, context.provider);
  });

  it('Adjust margin', async () => {
    const blockNumber = 19661097;
    const expiry = PERP_EXPIRY;
    const instrumentAddr = '0xec6c44e704eb1932ec5fe1e4aba58db6fee71460';
    const traderAddr = '0x8949c8d0a263b111ce76a0f5c34b162d2138154a';

    const simulateRes = await context.perp.simulate.simulateAdjustMarginByLeverage(
      {
        tradeInfo: {
          instrumentAddr,
          expiry,
          traderAddr,
        },
        slippage: 50,
        leverage: ethers.utils.parseUnits('5'),
      },
      {
        blockTag: blockNumber,
      },
    );
    const tx = await context.perp.instrument.adjustMargin(
      {
        instrumentAddr,
        expiry,
        transferIn: simulateRes.transferIn,
        margin: simulateRes.margin,
        deadline: addDeadline(5),
      },
      {
        blockTag: blockNumber,
        disableGasLimit: true,
      },
    );
    await estimateTx(tx, traderAddr, blockNumber, context.provider);
  });

  it('Place market order', async () => {
    const blockNumber = 19661097;
    const expiry = PERP_EXPIRY;
    const instrumentAddr = '0xec6c44e704eb1932ec5fe1e4aba58db6fee71460';
    const traderAddr = '0x8949c8d0a263b111ce76a0f5c34b162d2138154a';
    const quoteAmount = ethers.utils.parseUnits('1000');

    const simulateRes = await context.perp.simulate.simulateMarketOrderByLeverage(
      {
        tradeInfo: {
          instrumentAddr,
          expiry,
          traderAddr,
        },
        side: Side.LONG,
        size: { quote: quoteAmount },
        slippage: 50,
        leverage: ethers.utils.parseUnits('10'),
      },
      {
        blockTag: blockNumber,
      },
    );
    const tx = await context.perp.instrument.placeMarketOrder(
      {
        instrumentAddr,
        expiry,
        side: Side.LONG,
        baseSize: simulateRes.size.base,
        margin: simulateRes.margin,
        limitTick: simulateRes.limitTick,
        deadline: addDeadline(5),
      },
      {
        blockTag: blockNumber,
        disableGasLimit: true,
      },
    );
    await estimateTx(tx, traderAddr, blockNumber, context.provider);
  });

  // it('Batch place limit order', async () => {
  //     const blockNumber = 19661097;
  //     const expiry = PERP_EXPIRY;
  //     const instrumentAddr = '0xec6c44e704eb1932ec5fe1e4aba58db6fee71460';
  //     const traderAddr = '0xA84cefd4ce52E1B262cEF8823006778a6c1094D7';
  //     const quoteAmount = ethers.utils.parseUnits('1000');
  //     const lowerPrice = ethers.utils.parseUnits('58072.733895');
  //     const upperPrice = ethers.utils.parseUnits('58172.733895');

  //     const simulateRes = await context.perp.simulate.simulateScaledLimitOrder(
  //         {
  //             tradeInfo: {
  //                 instrumentAddr,
  //                 expiry,
  //                 traderAddr,
  //             },
  //             lowerPriceInfo: lowerPrice,
  //             upperPriceInfo: upperPrice,
  //             orderCount: 2,
  //             sizeDistribution: BatchOrderSizeDistribution.RANDOM,
  //             size: { quote: quoteAmount },
  //             side: Side.LONG,
  //             leverage: ethers.utils.parseEther('10'),
  //         },
  //         {
  //             blockTag: blockNumber,
  //         },
  //     );
  //     const tx = await context.perp.instrument.batchPlaceLimitOrder(
  //         {
  //             instrumentAddr,
  //             expiry,
  //             ticks: simulateRes.orders.map((o) => o!.tick),
  //             ratios: simulateRes.orders.map((o) => o!.ratio),
  //             baseSize: simulateRes.size.base,
  //             side: Side.LONG,
  //             leverage: ethers.utils.parseEther('10'),
  //             deadline: addDeadline(5),
  //         },
  //         {
  //             disableGasLimit: true,
  //         },
  //     );
  //     await estimateTx(tx, traderAddr, blockNumber, provider);
  // });

  it('Batch cancel limit order', async () => {
    const blockNumber = 19669649;
    const expiry = PERP_EXPIRY;
    const instrumentAddr = '0xec6c44e704eb1932ec5fe1e4aba58db6fee71460';
    const traderAddr = '0xb4f0b57a7398656c96ac9014d618ddd2305e48e9';
    const orderTicks = [110325, 109750];

    const tx = await context.perp.instrument.batchCancelLimitOrder(
      {
        instrumentAddr,
        expiry,
        orderTicks,
        deadline: addDeadline(5),
      },
      {
        blockTag: blockNumber,
        disableGasLimit: true,
      },
    );
    await estimateTx(tx, traderAddr, blockNumber, context.provider);
  });

  it('Place cross market order', async () => {
    const blockNumber = 19669649;
    const expiry = PERP_EXPIRY;
    const instrumentAddr = '0xec6c44e704eb1932ec5fe1e4aba58db6fee71460';
    const traderAddr = '0x6316958fa1dfb6bc5aea231e8b68bc9e2fe1b587';
    const price = ethers.utils.parseUnits('58568.431077');
    const quoteAmount = ethers.utils.parseUnits('100000');

    const simulateRes = await context.perp.simulate.simulateCrossMarketOrder(
      {
        tradeInfo: {
          instrumentAddr,
          expiry,
          traderAddr,
        },
        priceInfo: price,
        size: { quote: quoteAmount },
        side: Side.LONG,
        leverage: ethers.utils.parseUnits('30'),
        slippage: 50,
      },
      {
        blockTag: blockNumber,
      },
    );

    const tx = await context.perp.instrument.placeCrossMarketOrder(
      {
        instrumentAddr,
        expiry,
        side: Side.LONG,
        tradeSize: simulateRes.tradeSimulation.size.base,
        tradeMargin: simulateRes.tradeSimulation.margin,
        tradeLimitTick: simulateRes.tradeSimulation.limitTick,
        orderTick: simulateRes.orderSimulation.tick,
        orderSize: simulateRes.orderSimulation.size.base,
        orderMargin: simulateRes.orderSimulation.margin,
        deadline: addDeadline(5),
      },
      {
        blockTag: blockNumber,
        disableGasLimit: true,
      },
    );
    await estimateTx(tx, traderAddr, blockNumber, context.provider);
  });
});
