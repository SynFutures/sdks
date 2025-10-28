# Oyster Aggregator

- [Oyster Aggregator](#oyster-aggregator)
    - [Intruduction](#intruduction)
    - [Install](#install)
        - [Initialization example](#initialization-example)
    - [Example](#example)
        - [Query single route](#query-single-route)
        - [Query split route](#query-split-route)
        - [Simulate mix swap](#simulate-mix-swap)
        - [Simulate multi swap](#simulate-multi-swap)
        - [Mix swap](#mix-swap)
        - [Multi swap](#multi-swap)

## Intruduction

Our aggregator contract is a smart contract that allows users to swap tokens using multiple pools. This package includes one plugin:

- `aggregatorPlugin`

## Install

```sh
npm i @synfutures/sdks-aggregator
```

### Initialization example

```ts
import { AggregatorModule } from '@synfutures/sdks-aggregator';

const aggregator = new AggregatorModule({
    chainId: 8453, // Base mainnet
    rpcUrl: 'https://mainnet.base.org',
});

await aggregator.init();
```

## Example

### Query single route

```ts
const aggregator = new AggregatorModule({ chainId: 8453, rpcUrl: 'https://mainnet.base.org' });
await aggregator.init();

const chainKit = ChainKitRegistry.for(8453);
const usdc = chainKit.getErc20TokenInfo('USDC');
const weth = chainKit.getErc20TokenInfo('WETH');

const result = await aggregator.querySingleRoute({
    fromToken: usdc,
    toToken: weth,
    fromAmount: parseUnits('10000', usdc.decimals),
    excludePoolTypes: [],
});
```

### Query split route

```ts
const result = await aggregator.querySplitRoute({
    fromToken: usdc,
    toToken: weth,
    fromAmount: parseUnits('10000', usdc.decimals),
    excludePoolTypes: [],
    isDirect: true,
});
```

### Simulate mix swap

```ts
const fromToken = weth;
const toToken = usdc;
const fromAmount = parseUnits('0.001', fromToken.decimals);

const result = await aggregator.simulateMixSwap({
    fromToken,
    toToken,
    fromAmount,
    excludePoolTypes: [],
    slippageInBps: 100, // 1%
});
console.log('priceImpact', result.priceImpact);
console.log('minReceivedAmount', result.minReceivedAmount.toString());
console.log('route', result.route);
```

### Simulate multi swap

```ts
const usdc = await ctx.getTokenInfo('USDC');
const weth = await ctx.getTokenInfo('WETH');

const fromToken = usdc;
const toToken = weth;
const fromAmount = parseUnits('10', fromToken.decimals);

const result = await aggregator.simulateMultiSwap({
    fromToken,
    toToken,
    fromAmount,
    excludePoolTypes: [],
    isDirect: true,
    slippageInBps: 100, // 1%
});
console.log('priceImpact', result.priceImpact);
console.log('minReceivedAmount', result.minReceivedAmount.toString());
console.log('route', result.route);
```

### Mix swap

```ts
const signer = await ctx.getSigner('SIGNER_NAME');

const usdc = await ctx.getTokenInfo('USDC');
const weth = await ctx.getTokenInfo('WETH');
const fromToken = usdc;
const toToken = weth;
const fromTokenAmount = parseUnits('10', fromToken.decimals);
const result = await ctx.aggregator.querySingleRoute({
    fromTokenAddress: fromToken.address,
    toTokenAddress: toToken.address,
    fromAmount: fromTokenAmount,
    excludePoolTypes: [],
});

console.log(result.bestPoolPath[0]);
const approveTo = OYSTER_AGGREGATOR_ADDRESS[ctx.chainId];
console.log('approveTo', approveTo);

await ctx.erc20.approveIfNeeded(signer, fromToken.address, approveTo, fromTokenAmount);
const tx = await ctx.aggregator.encodeMixSwapData(
    {
        fromTokenAddress: fromToken.address,
        fromTokenAmount,
        toTokenAddress: toToken.address,
        bestPath: result.bestPath,
        bestPoolPath: result.bestPoolPath,
        bestAmount: result.bestAmount,
        broker: ZERO_ADDRESS,
        brokerFeeRate: ZERO,
        userParams: {
            slippageInBps: 100, // 1%
            deadline: NULL_DDL,
        },
    },
    { signer },
);
```

### Multi swap

```ts
const signer = await ctx.getSigner('SIGNER_NAME');

const usdc = await ctx.getTokenInfo('USDC');
const weth = await ctx.getTokenInfo('WETH');
const fromToken = weth;
const toToken = usdc;
const fromTokenAmount = parseUnits('0.001', fromToken.decimals);
const result = await ctx.aggregator.querySplitRoute({
    fromTokenAddress: fromToken.address,
    toTokenAddress: toToken.address,
    fromAmount: fromTokenAmount,
    excludePoolTypes: [],
    isDirect: true,
});

console.log(result.bestPathInfo);
const approveTo = OYSTER_AGGREGATOR_ADDRESS[ctx.chainId];
console.log('approveTo', approveTo);

await ctx.erc20.approveIfNeeded(signer, fromToken.address, approveTo, fromTokenAmount);
const tx = await ctx.aggregator.encodeMultiSwapData(
    {
        fromTokenAddress: fromToken.address,
        fromTokenAmount,
        toTokenAddress: toToken.address,
        bestPathInfo: result.bestPathInfo,
        bestAmount: result.bestAmount,
        broker: ZERO_ADDRESS,
        brokerFeeRate: ZERO,
        userParams: {
            slippageInBps: 100, // 1%
            deadline: NULL_DDL,
        },
    },
    { signer },
);
```
