import { BigNumber, ethers } from 'ethers';
import { hexZeroPad } from 'ethers/lib/utils';
import { INT24_MAX, MAX_CANCEL_ORDER_COUNT, RATIO_BASE } from '../constants';
import { EMPTY_TICK, MAX_INT_24, ONE, ZERO, asUint128, asUint24, asUint48, asUint16, asInt24, asInt128 } from '../math';
import {
  AddParam,
  AdjustParam,
  BatchCancelParam,
  BatchPlaceParam,
  FillParam,
  PlaceParam,
  RemoveParam,
  TradeParam,
} from '../types';
import { ParamsEncodeError } from '../errors/paramsEncodeError';

const nonceLength = 24;
const tickLength = 24;
const limitTicksLength = tickLength * 2;
const expiryLength = 32;
const sizeLength = 128;
const amountLength = 128;
const quantityLength = 96;
const addressLength = 160;
const deadlineLength = 32;
const limitStabilityFeeRatioLength = 16;
const ratioLength = 16;
const leverageLength = 128;

function bytes32ToBigNumber(str: string): BigNumber {
  str = str.startsWith('0x') ? str : '0x' + str;
  if (str.length !== 66) {
    throw new ParamsEncodeError('invalid bytes32 string', { str });
  }
  return BigNumber.from(str);
}

function pickNumber(value: BigNumber, from: number, to: number): number {
  return pickBigNumber(value, from, to).toNumber();
}

function pickAddress(value: BigNumber, from: number, to: number): string {
  return hexZeroPad(pickBigNumber(value, from, to).toHexString(), 20);
}

function pickBigNumber(value: BigNumber, from: number, to: number): BigNumber {
  return value.shr(from).and(ONE.shl(to - from).sub(1));
}

export function checkReferralCode(referral: string): void {
  if (referral.length !== 8) throw new ParamsEncodeError('referral code length must be 8', { referral });
}

export function getHexReferral(referral: string): string {
  // cannot directly use toUtf8Bytes, since charcode larger than 127 would result in 2bytes unicode
  checkReferralCode(referral);
  const platform = referral.charCodeAt(0);
  const wallet = referral.charCodeAt(1);
  const channel = referral.slice(2);
  return ethers.utils.hexConcat([
    BigNumber.from(platform).toHexString(),
    BigNumber.from(wallet).toHexString(),
    ethers.utils.hexlify(ethers.utils.toUtf8Bytes(channel)),
  ]);
}

function encodeParamForTradeAndPlace(param: TradeParam): [string, string] {
  const usize = asUint128(param.size);
  const uAmount = asUint128(param.amount);

  const uTick = asUint24(param.limitTick);
  const combinedTick = BigNumber.from(uTick).shl(32).add(BigNumber.from(param.expiry));
  const combinedDeadline = BigNumber.from(param.deadline).shl(56).add(combinedTick);
  const combinedSize = BigNumber.from(usize).shl(128).add(uAmount);
  const page0Temp = hexZeroPad(combinedDeadline.toHexString(), 32);
  const page1 = hexZeroPad(combinedSize.toHexString(), 32);

  const page0 = param.referralCode
    ? hexZeroPad(
        BigNumber.from(getHexReferral(param.referralCode)).shl(192).add(BigNumber.from(page0Temp)).toHexString(),
        32,
      )
    : page0Temp;
  return [page0, page1];
}

export function encodeTradeParam(param: TradeParam): [string, string] {
  return encodeParamForTradeAndPlace(param);
}

export function encodePlaceParam(param: PlaceParam): [string, string] {
  return encodeParamForTradeAndPlace({
    ...param,
    limitTick: param.tick,
  });
}

/// encode deposit param to contract input format (bytes32)
export function encodeDepositParam(token: string, quantity: BigNumber): string {
  return encodeParamForDepositAndWithdraw(token, quantity);
}

/// encode withdraw param to contract input format (bytes32)
export function encodeWithdrawParam(token: string, quantity: BigNumber): string {
  return encodeParamForDepositAndWithdraw(token, quantity);
}

function encodeParamForDepositAndWithdraw(token: string, quantity: BigNumber): string {
  return hexZeroPad(BigNumber.from(quantity).shl(160).add(token).toHexString(), 32);
}

export function encodeAdjustParam(param: AdjustParam): [string, string] {
  return encodeParamForTradeAndPlace({
    expiry: param.expiry,
    size: ZERO,
    amount: param.net,
    limitTick: 0,
    deadline: param.deadline,
    referralCode: param.referralCode,
  });
}

export function encodeAddParam(addParam: AddParam): [string, string] {
  const uTick = asUint48(addParam.limitTicks.toNumber());
  const combinedTick = BigNumber.from(uTick).shl(32).add(BigNumber.from(addParam.expiry));
  const combinedDeadline = BigNumber.from(addParam.deadline).shl(80).add(combinedTick);
  const combinedAmount = BigNumber.from(addParam.tickDeltaLower)
    .shl(152)
    .add(BigNumber.from(addParam.tickDeltaUpper).shl(128))
    .add(addParam.amount);

  const page0 = addParam.referralCode
    ? hexZeroPad(BigNumber.from(getHexReferral(addParam.referralCode)).shl(192).add(combinedDeadline).toHexString(), 32)
    : hexZeroPad(combinedDeadline.toHexString(), 32);
  const page1 = hexZeroPad(combinedAmount.toHexString(), 32);
  return [page0, page1];
}

/// encode remove param to contract input format (bytes32[2])
export function encodeRemoveParam(removeParam: RemoveParam): [string, string] {
  const uTick = asUint48(removeParam.limitTicks.toNumber());
  const combinedTick = BigNumber.from(uTick).shl(32).add(BigNumber.from(removeParam.expiry));
  const combinedDeadline = BigNumber.from(removeParam.deadline).shl(80).add(combinedTick);

  const uTickLower = asUint24(removeParam.tickLower);
  const uTickUpper = asUint24(removeParam.tickUpper);
  const combinedTickLower = BigNumber.from(uTickLower).shl(160).add(removeParam.traderAddr);
  const combinedTickUpper = BigNumber.from(uTickUpper).shl(184).add(combinedTickLower);

  const page0 = hexZeroPad(combinedDeadline.toHexString(), 32);
  const page1 = hexZeroPad(combinedTickUpper.toHexString(), 32);
  return [page0, page1];
}

export function encodeBatchPlaceParam(
  expiry: number,
  size: BigNumber,
  leverage: BigNumber,
  ticks: number[],
  ratios: number[],
  deadline: number,
  referral?: string,
): [string, string, string] {
  if (ticks.length > 9) throw new ParamsEncodeError('cannot place more than 9 orders at once', { ticks });
  if (ticks.length !== ratios.length)
    throw new ParamsEncodeError('ticks and ratios length mismatch', { ticks, ratios });

  if (ratios.reduce((a, b) => a + b, 0) !== RATIO_BASE) throw new ParamsEncodeError('ratios sum must be 10000', ratios);

  const usize = asUint128(size);
  const uLeverage = asUint128(leverage);
  const combinedSize = BigNumber.from(usize).shl(128).add(uLeverage);
  const page2 = hexZeroPad(combinedSize.toHexString(), 32);

  let tmp0 = BigNumber.from(deadline).shl(32).add(BigNumber.from(expiry));
  for (let i = 0; i < 3; i++) {
    const uTick = i < ticks.length ? asUint24(ticks[i]) : EMPTY_TICK;
    const uRatio = i < ratios.length ? asUint16(ratios[i]) : 0;
    tmp0 = tmp0.add(BigNumber.from(uRatio).shl(64 + 40 * i)).add(BigNumber.from(uTick).shl(64 + 40 * i + 16));
  }
  const page0Temp = hexZeroPad(tmp0.toHexString(), 32);

  let tmp1 = ZERO;
  for (let i = 0; i < 6; i++) {
    const uTick = i + 3 < ticks.length ? asUint24(ticks[i + 3]) : EMPTY_TICK;
    const uRatio = i + 3 < ratios.length ? asUint16(ratios[i + 3]) : 0;
    tmp1 = tmp1.add(BigNumber.from(uRatio).shl(40 * i)).add(BigNumber.from(uTick).shl(40 * i + 16));
  }
  const page1 = hexZeroPad(tmp1.toHexString(), 32);

  const page0 = referral
    ? hexZeroPad(BigNumber.from(getHexReferral(referral)).shl(192).add(BigNumber.from(page0Temp)).toHexString(), 32)
    : page0Temp;
  return [page0, page1, page2];
}

/// encode fill param to contract input format (bytes32)
export function encodeFillParam(param: FillParam): string {
  const uTick = asUint24(param.tick);
  const combinedTarget = BigNumber.from(param.target).shl(32).add(BigNumber.from(param.expiry));
  const combinedTick = BigNumber.from(uTick).shl(192).add(combinedTarget);
  return hexZeroPad(BigNumber.from(param.nonce).shl(216).add(combinedTick).toHexString(), 32);
}

/// encode cancel param to contract input format (bytes32)
export function encodeCancelParam(param: BatchCancelParam): string {
  const { ticks, expiry, deadline } = param;
  if (ticks.length < 1 || ticks.length > MAX_CANCEL_ORDER_COUNT)
    throw new ParamsEncodeError(`ticks length must be between 1 and ${MAX_CANCEL_ORDER_COUNT}`, { ticks });
  let encodedTicks = ZERO;
  for (let i = 0; i < MAX_CANCEL_ORDER_COUNT; i++) {
    const tick = i < ticks.length ? ticks[i] : INT24_MAX;
    encodedTicks = encodedTicks.add(BigNumber.from(asUint24(tick)).shl(24 * i));
  }

  const combinedTick = BigNumber.from(encodedTicks).shl(32).add(BigNumber.from(expiry));
  const combinedDeadline = BigNumber.from(deadline).shl(224).add(combinedTick);
  return hexZeroPad(combinedDeadline.toHexString(), 32);
}

export function decodeTradeParam(args: string[]): TradeParam {
  return decodeParamForTradeAndPlace(args);
}

export function decodeTradeWithStabilityFeeParam(args: string[]): TradeParam & { limitStabilityFeeRatio: number } {
  const tradeParam = decodeTradeParam(args);
  const value1 = bytes32ToBigNumber(args[0]);
  const offset = expiryLength + tickLength + deadlineLength;
  const limitStabilityFeeRatio = pickNumber(value1, offset, offset + limitStabilityFeeRatioLength);
  return { ...tradeParam, limitStabilityFeeRatio };
}

function decodeParamForTradeAndPlace(args: string[]): TradeParam {
  if (args.length !== 2) {
    throw new ParamsEncodeError('invalid args length for trade and place', { args });
  }

  const [arg1, arg2] = args;

  let offset = 0;
  const value1 = bytes32ToBigNumber(arg1);
  const expiry = pickNumber(value1, offset, (offset += expiryLength));
  const limitTick = asInt24(pickNumber(value1, offset, (offset += tickLength)));
  const deadline = pickNumber(value1, offset, (offset += deadlineLength));

  offset = 0;
  const value2 = bytes32ToBigNumber(arg2);
  const amount = asInt128(pickBigNumber(value2, offset, (offset += amountLength)));
  const size = asInt128(pickBigNumber(value2, offset, (offset += sizeLength)));

  return { expiry, size, amount, limitTick, deadline, referralCode: '' };
}

export function decodeDepositParam(arg: string): { token: string; quantity: BigNumber } {
  return decodeParamForDepositAndWithdraw(arg);
}

export function decodeWithdrawParam(arg: string): { token: string; quantity: BigNumber } {
  return decodeParamForDepositAndWithdraw(arg);
}

export function decodeParamForDepositAndWithdraw(arg: string): { token: string; quantity: BigNumber } {
  let offset = 0;
  const value = bytes32ToBigNumber(arg);
  const token = pickAddress(value, offset, (offset += addressLength));
  const quantity = pickBigNumber(value, offset, (offset += quantityLength));

  return { quantity, token };
}

export function decodeAddParam(args: string[]): AddParam {
  if (args.length !== 2) {
    throw new ParamsEncodeError('invalid args length for add', { args });
  }

  const [arg1, arg2] = args;

  let offset = 0;
  const value1 = bytes32ToBigNumber(arg1);
  const expiry = pickNumber(value1, offset, (offset += expiryLength));
  const limitTicks = pickBigNumber(value1, offset, (offset += limitTicksLength));
  const deadline = pickNumber(value1, offset, (offset += deadlineLength));

  offset = 0;
  const value2 = bytes32ToBigNumber(arg2);
  const amount = pickBigNumber(value2, offset, (offset += amountLength));
  const tickDeltaUpper = pickNumber(value2, offset, (offset += tickLength));
  const tickDeltaLower = pickNumber(value2, offset, (offset += tickLength));

  return { limitTicks, amount, tickDeltaLower, tickDeltaUpper, expiry, deadline, referralCode: '' };
}

export function decodeRemoveParam(args: string[]): RemoveParam {
  if (args.length !== 2) {
    throw new ParamsEncodeError('invalid args length for remove', { args });
  }

  const [arg1, arg2] = args;

  let offset = 0;
  const value1 = bytes32ToBigNumber(arg1);
  const expiry = pickNumber(value1, offset, (offset += expiryLength));
  const limitTicks = pickBigNumber(value1, offset, (offset += limitTicksLength));
  const deadline = pickNumber(value1, offset, (offset += deadlineLength));

  offset = 0;
  const value2 = bytes32ToBigNumber(arg2);
  const target = pickAddress(value2, offset, (offset += addressLength));
  const tickLower = asInt24(pickNumber(value2, offset, (offset += tickLength)));
  const tickUpper = asInt24(pickNumber(value2, offset, (offset += tickLength)));

  return { tickUpper, tickLower, traderAddr: target, expiry, limitTicks, deadline };
}

export function decodePlaceParam(args: string[]): PlaceParam {
  const result = decodeParamForTradeAndPlace(args);
  return {
    expiry: result.expiry,
    size: result.size,
    amount: result.amount,
    tick: result.limitTick,
    deadline: result.deadline,
  };
}

export function decodeBatchPlaceParam(args: string[]): BatchPlaceParam {
  if (args.length !== 3) {
    throw new ParamsEncodeError('invalid args length for place', { args });
  }

  const [arg1, arg2, arg3] = args;

  const ticks: number[] = [];
  const ratios: number[] = [];

  let offset = 0;
  const value1 = bytes32ToBigNumber(arg1);
  const expiry = pickNumber(value1, offset, (offset += expiryLength));
  const deadline = pickNumber(value1, offset, (offset += deadlineLength));
  for (let i = 0; i < 3; i++) {
    const ratio = pickNumber(value1, offset, (offset += ratioLength));
    const tick = asInt24(pickNumber(value1, offset, (offset += tickLength)));
    if (BigNumber.from(tick).eq(EMPTY_TICK)) continue;
    ticks.push(tick);
    ratios.push(ratio);
  }

  offset = 0;
  const value2 = bytes32ToBigNumber(arg2);
  for (let i = 0; i < 6; i++) {
    const ratio = pickNumber(value2, offset, (offset += ratioLength));
    const tick = asInt24(pickNumber(value2, offset, (offset += tickLength)));
    if (BigNumber.from(tick).eq(EMPTY_TICK)) continue;
    ticks.push(tick);
    ratios.push(ratio);
  }

  offset = 0;
  const value3 = bytes32ToBigNumber(arg3);
  const leverage = asInt128(pickBigNumber(value3, offset, (offset += leverageLength)));
  const size = asInt128(pickBigNumber(value3, offset, (offset += sizeLength)));

  return { expiry, ticks, ratios, size, leverage, deadline };
}

export function decodeFillParam(arg: string): FillParam {
  let offset = 0;
  const value = bytes32ToBigNumber(arg);
  const expiry = pickNumber(value, offset, (offset += expiryLength));
  const target = pickAddress(value, offset, (offset += addressLength));
  const tick = asInt24(pickNumber(value, offset, (offset += tickLength)));
  const nonce = pickNumber(value, offset, (offset += nonceLength));

  return { nonce, tick, target, expiry };
}

export function decodeCancelParam(arg: string): { expiry: number; ticks: number[]; deadline: number } {
  let offset = 0;
  const value = bytes32ToBigNumber(arg);
  const expiry = pickNumber(value, offset, (offset += expiryLength));
  const ticks: number[] = [];
  for (let i = 0; i < MAX_CANCEL_ORDER_COUNT; i++) {
    const tick = asInt24(pickNumber(value, offset, (offset += tickLength)));
    if (tick === MAX_INT_24.toNumber()) {
      continue;
    }
    ticks.push(tick);
  }
  const deadline = pickNumber(value, offset, (offset += deadlineLength));

  return { ticks, expiry, deadline };
}
