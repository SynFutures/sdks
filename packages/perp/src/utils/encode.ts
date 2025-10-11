import { ethers } from 'ethers';
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

function bytes32ToBigInt(str: string): bigint {
    str = str.startsWith('0x') ? str : '0x' + str;
    if (str.length !== 66) {
        throw new ParamsEncodeError('invalid bytes32 string', { str });
    }
    return BigInt(str);
}

function pickNumber(value: bigint, from: number, to: number): number {
    return Number(pickBigInt(value, from, to));
}

function pickAddress(value: bigint, from: number, to: number): string {
    return hexZeroPad('0x' + pickBigInt(value, from, to).toString(16).padStart(40, '0'), 20);
}

function pickBigInt(value: bigint, from: number, to: number): bigint {
    return (value >> BigInt(from)) & ((ONE << BigInt(to - from)) - ONE);
}

// Helper function to convert bigint to hex string with proper padding
function bigIntToHex(value: bigint, padding: number = 32): string {
    return hexZeroPad('0x' + value.toString(16), padding);
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
        '0x' + BigInt(platform).toString(16),
        '0x' + BigInt(wallet).toString(16),
        ethers.utils.hexlify(ethers.utils.toUtf8Bytes(channel)),
    ]);
}

function encodeParamForTradeAndPlace(param: TradeParam): [string, string] {
    const usize = asUint128(param.size);
    const uAmount = asUint128(param.amount);

    const uTick = asUint24(param.limitTick);
    const combinedTick = (BigInt(uTick) << BigInt(32)) + BigInt(param.expiry);
    const combinedDeadline = (BigInt(param.deadline) << BigInt(56)) + combinedTick;
    const combinedSize = (BigInt(usize) << BigInt(128)) + BigInt(uAmount);
    const page0Temp = bigIntToHex(combinedDeadline, 32);
    const page1 = bigIntToHex(combinedSize, 32);

    const page0 = param.referralCode
        ? bigIntToHex(BigInt(getHexReferral(param.referralCode)) << BigInt(192) + BigInt(page0Temp), 32)
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
export function encodeDepositParam(token: string, quantity: bigint): string {
    return encodeParamForDepositAndWithdraw(token, quantity);
}

/// encode withdraw param to contract input format (bytes32)
export function encodeWithdrawParam(token: string, quantity: bigint): string {
    return encodeParamForDepositAndWithdraw(token, quantity);
}

function encodeParamForDepositAndWithdraw(token: string, quantity: bigint): string {
    return bigIntToHex((BigInt(quantity) << BigInt(160)) + BigInt(token), 32);
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
    const uTick = asUint48(Number(addParam.limitTicks));
    const combinedTick = (BigInt(uTick) << BigInt(32)) + BigInt(addParam.expiry);
    const combinedDeadline = (BigInt(addParam.deadline) << BigInt(80)) + combinedTick;
    const combinedAmount = (BigInt(addParam.tickDeltaLower) << BigInt(152)) + 
        (BigInt(addParam.tickDeltaUpper) << BigInt(128)) + 
        BigInt(addParam.amount);

    const page0 = addParam.referralCode
        ? bigIntToHex((BigInt(getHexReferral(addParam.referralCode)) << BigInt(192)) + combinedDeadline, 32)
        : bigIntToHex(combinedDeadline, 32);
    const page1 = bigIntToHex(combinedAmount, 32);
    return [page0, page1];
}

/// encode remove param to contract input format (bytes32[2])
export function encodeRemoveParam(removeParam: RemoveParam): [string, string] {
    const uTick = asUint48(Number(removeParam.limitTicks));
    const combinedTick = (BigInt(uTick) << BigInt(32)) + BigInt(removeParam.expiry);
    const combinedDeadline = (BigInt(removeParam.deadline) << BigInt(80)) + combinedTick;

    const uTickLower = asUint24(removeParam.tickLower);
    const uTickUpper = asUint24(removeParam.tickUpper);
    const combinedTickLower = (BigInt(uTickLower) << BigInt(160)) + BigInt(removeParam.traderAddr);
    const combinedTickUpper = (BigInt(uTickUpper) << BigInt(184)) + combinedTickLower;

    const page0 = bigIntToHex(combinedDeadline, 32);
    const page1 = bigIntToHex(combinedTickUpper, 32);
    return [page0, page1];
}

export function encodeBatchPlaceParam(
    expiry: number,
    size: bigint,
    leverage: bigint,
    ticks: number[],
    ratios: number[],
    deadline: number,
    referral?: string,
): [string, string, string] {
    if (ticks.length > 9) throw new ParamsEncodeError('cannot place more than 9 orders at once', { ticks });
    if (ticks.length !== ratios.length)
        throw new ParamsEncodeError('ticks and ratios length mismatch', { ticks, ratios });

    if (ratios.reduce((a, b) => a + b, 0) !== RATIO_BASE)
        throw new ParamsEncodeError('ratios sum must be 10000', ratios);

    const usize = asUint128(size);
    const uLeverage = asUint128(leverage);
    const combinedSize = (BigInt(usize) << BigInt(128)) + BigInt(uLeverage);
    const page2 = bigIntToHex(combinedSize, 32);

    let tmp0 = (BigInt(deadline) << BigInt(32)) + BigInt(expiry);
    for (let i = 0; i < 3; i++) {
        const uTick = i < ticks.length ? asUint24(ticks[i]) : EMPTY_TICK;
        const uRatio = i < ratios.length ? asUint16(ratios[i]) : 0;
        tmp0 = tmp0 + (BigInt(uRatio) << BigInt(64 + 40 * i)) + (BigInt(uTick) << BigInt(64 + 40 * i + 16));
    }
    const page0Temp = bigIntToHex(tmp0, 32);

    let tmp1 = ZERO;
    for (let i = 0; i < 6; i++) {
        const uTick = i + 3 < ticks.length ? asUint24(ticks[i + 3]) : EMPTY_TICK;
        const uRatio = i + 3 < ratios.length ? asUint16(ratios[i + 3]) : 0;
        tmp1 = tmp1 + (BigInt(uRatio) << BigInt(40 * i)) + (BigInt(uTick) << BigInt(40 * i + 16));
    }
    const page1 = bigIntToHex(tmp1, 32);

    const page0 = referral
        ? bigIntToHex((BigInt(getHexReferral(referral)) << BigInt(192)) + BigInt(page0Temp), 32)
        : page0Temp;
    return [page0, page1, page2];
}

/// encode fill param to contract input format (bytes32)
export function encodeFillParam(param: FillParam): string {
    const uTick = asUint24(param.tick);
    const combinedTarget = (BigInt(param.target) << BigInt(32)) + BigInt(param.expiry);
    const combinedTick = (BigInt(uTick) << BigInt(192)) + combinedTarget;
    return bigIntToHex((BigInt(param.nonce) << BigInt(216)) + combinedTick, 32);
}

/// encode cancel param to contract input format (bytes32)
export function encodeCancelParam(param: BatchCancelParam): string {
    const { ticks, expiry, deadline } = param;
    if (ticks.length < 1 || ticks.length > MAX_CANCEL_ORDER_COUNT)
        throw new ParamsEncodeError(`ticks length must be between 1 and ${MAX_CANCEL_ORDER_COUNT}`, { ticks });
    let encodedTicks = 0n;
    for (let i = 0; i < MAX_CANCEL_ORDER_COUNT; i++) {
        const tick = i < ticks.length ? ticks[i] : INT24_MAX;
        encodedTicks = encodedTicks + (BigInt(asUint24(tick)) << BigInt(24 * i));
    }

    const combinedTick = (encodedTicks << 32n) + BigInt(expiry);
    const combinedDeadline = (BigInt(deadline) << 224n) + combinedTick;
    return hexZeroPad(bigIntToHex(combinedDeadline, 32), 32);
}

export function decodeTradeParam(args: string[]): TradeParam {
    return decodeParamForTradeAndPlace(args);
}

export function decodeTradeWithStabilityFeeParam(args: string[]): TradeParam & { limitStabilityFeeRatio: number } {
    const tradeParam = decodeTradeParam(args);
    const value1 = bytes32ToBigInt(args[0]);
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
    const value1 = bytes32ToBigInt(arg1);
    const expiry = pickNumber(value1, offset, (offset += expiryLength));
    const limitTick = asInt24(pickNumber(value1, offset, (offset += tickLength)));
    const deadline = pickNumber(value1, offset, (offset += deadlineLength));

    offset = 0;
    const value2 = bytes32ToBigInt(arg2);
    const amount = asInt128(pickBigInt(value2, offset, (offset += amountLength)));
    const size = asInt128(pickBigInt(value2, offset, (offset += sizeLength)));

    return { expiry, size, amount, limitTick, deadline, referralCode: '' };
}

export function decodeDepositParam(arg: string): { token: string; quantity: bigint } {
    return decodeParamForDepositAndWithdraw(arg);
}

export function decodeWithdrawParam(arg: string): { token: string; quantity: bigint } {
    return decodeParamForDepositAndWithdraw(arg);
}

export function decodeParamForDepositAndWithdraw(arg: string): { token: string; quantity: bigint } {
    let offset = 0;
    const value = bytes32ToBigInt(arg);
    const token = pickAddress(value, offset, (offset += addressLength));
    const quantity = pickBigInt(value, offset, (offset += quantityLength));

    return { quantity, token };
}

export function decodeAddParam(args: string[]): AddParam {
    if (args.length !== 2) {
        throw new ParamsEncodeError('invalid args length for add', { args });
    }

    const [arg1, arg2] = args;

    let offset = 0;
    const value1 = bytes32ToBigInt(arg1);
    const expiry = pickNumber(value1, offset, (offset += expiryLength));
    const limitTicks = pickBigInt(value1, offset, (offset += limitTicksLength));
    const deadline = pickNumber(value1, offset, (offset += deadlineLength));

    offset = 0;
    const value2 = bytes32ToBigInt(arg2);
    const amount = pickBigInt(value2, offset, (offset += amountLength));
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
    const value1 = bytes32ToBigInt(arg1);
    const expiry = pickNumber(value1, offset, (offset += expiryLength));
    const limitTicks = pickBigInt(value1, offset, (offset += limitTicksLength));
    const deadline = pickNumber(value1, offset, (offset += deadlineLength));

    offset = 0;
    const value2 = bytes32ToBigInt(arg2);
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
    const value1 = bytes32ToBigInt(arg1);
    const expiry = pickNumber(value1, offset, (offset += expiryLength));
    const deadline = pickNumber(value1, offset, (offset += deadlineLength));
    for (let i = 0; i < 3; i++) {
        const ratio = pickNumber(value1, offset, (offset += ratioLength));
        const tick = asInt24(pickNumber(value1, offset, (offset += tickLength)));
        if (BigInt(tick) === EMPTY_TICK) continue;
        ticks.push(tick);
        ratios.push(ratio);
    }

    offset = 0;
    const value2 = bytes32ToBigInt(arg2);
    for (let i = 0; i < 6; i++) {
        const ratio = pickNumber(value2, offset, (offset += ratioLength));
        const tick = asInt24(pickNumber(value2, offset, (offset += tickLength)));
        if (BigInt(tick) === EMPTY_TICK) continue;
        ticks.push(tick);
        ratios.push(ratio);
    }

    offset = 0;
    const value3 = bytes32ToBigInt(arg3);
    const leverage = asInt128(pickBigInt(value3, offset, (offset += leverageLength)));
    const size = asInt128(pickBigInt(value3, offset, (offset += sizeLength)));

    return { expiry, ticks, ratios, size, leverage, deadline };
}

export function decodeFillParam(arg: string): FillParam {
    let offset = 0;
    const value = bytes32ToBigInt(arg);
    const expiry = pickNumber(value, offset, (offset += expiryLength));
    const target = pickAddress(value, offset, (offset += addressLength));
    const tick = asInt24(pickNumber(value, offset, (offset += tickLength)));
    const nonce = pickNumber(value, offset, (offset += nonceLength));

    return { nonce, tick, target, expiry };
}

export function decodeCancelParam(arg: string): { expiry: number; ticks: number[]; deadline: number } {
    let offset = 0;
    const value = bytes32ToBigInt(arg);
    const expiry = pickNumber(value, offset, (offset += expiryLength));
    const ticks: number[] = [];
    for (let i = 0; i < MAX_CANCEL_ORDER_COUNT; i++) {
        const tick = asInt24(pickNumber(value, offset, (offset += tickLength)));
        if (tick === Number(MAX_INT_24)) {
            continue;
        }
        ticks.push(tick);
    }
    const deadline = pickNumber(value, offset, (offset += deadlineLength));

    return { ticks, expiry, deadline };
}
