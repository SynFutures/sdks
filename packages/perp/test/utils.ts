/* eslint-disable @typescript-eslint/no-explicit-any */
import { BigNumber, ethers } from 'ethers';
import axios from 'axios';

export function addDeadline(deadline: number): number {
  return Math.floor(Date.now() / 1000) + deadline * 60;
}

export async function quickRetry<T>(fn: () => Promise<T>, times = 3) {
  let error: any;

  for (let i = 0; i < times; i++) {
    try {
      return await fn();
    } catch (err) {
      error = err;
    }

    await new Promise<void>((r) => setTimeout(r, 100));
  }

  throw error;
}

export async function estimateTx(
  tx: ethers.PopulatedTransaction,
  from: string,
  blockNumber: number,
  provider: ethers.providers.Provider,
) {
  const url = (provider as any).connection.url;

  // format hex value
  let hexValue = tx.value?.toHexString();
  if (hexValue?.startsWith('0x0')) {
    hexValue = '0x' + hexValue.substring(3);
  }

  // format hex block number
  let hexBlockNumber = ethers.utils.hexlify(blockNumber);
  if (hexBlockNumber?.startsWith('0x0')) {
    hexBlockNumber = '0x' + hexBlockNumber.substring(3);
  }

  const response = await quickRetry(() =>
    axios.post(url, {
      jsonrpc: '2.0',
      method: 'eth_estimateGas',
      id: 1024,
      params: [
        {
          ...tx,
          from,
          value: hexValue,
        },
        {
          blockNumber: hexBlockNumber,
        },
      ],
    }),
  );

  if (!('result' in response.data)) {
    console.log(response.data);

    throw new Error('estimate transaction failed');
  }
}

export function serialize(value: any): any {
  if (value instanceof Map) {
    // Handle Map: convert it to key-value pairs and mark as isMap
    const obj: any = {};
    value.forEach((v, k) => {
      const key = typeof k === 'number' ? `__number__${k}` : k; // Add prefix for numeric keys
      obj[key] = serialize(v); // Recursively serialize Map values
    });
    return {
      isMap: true,
      value: obj,
    };
  } else if (BigNumber.isBigNumber(value)) {
    // Handle BigNumber: convert to string and mark as isBigNumber
    return {
      isBigNumber: true,
      value: value.toString(),
    };
  } else if (Array.isArray(value) && isPureArray(value)) {
    // Handle pure arrays: recursively process each element
    return value.map(serialize);
  } else if (typeof value === 'object' && value !== null) {
    // Recursively handle plain objects and mixed objects/arrays
    const obj: any = {};
    for (const key in value) {
      if (Object.prototype.hasOwnProperty.call(value, key)) {
        obj[key] = serialize(value[key]);
      }
    }
    return obj;
  } else {
    // Return other types as is
    return value;
  }
}

function isPureArray(value: any): boolean {
  // Check if the array is a pure array (no extra non-numeric keys)
  if (!Array.isArray(value)) return false;
  const keys = Object.keys(value);
  return keys.every((key) => /^\d+$/.test(key));
}

export function deserialize(value: any): any {
  if (value && value.isMap) {
    // Handle Map: restore to Map type
    const map = new Map();
    Object.keys(value.value).forEach((key) => {
      const originalKey = key.startsWith('__number__') ? Number(key.replace('__number__', '')) : key;
      map.set(originalKey, deserialize(value.value[key])); // Recursively deserialize Map values
    });
    return map;
  } else if (value && value.isBigNumber) {
    // Handle BigNumber: restore to BigNumber instance
    return BigNumber.from(value.value);
  } else if (Array.isArray(value) && isPureArray(value)) {
    // Handle pure arrays: recursively deserialize each element
    return value.map(deserialize);
  } else if (typeof value === 'object' && value !== null) {
    // Recursively handle plain objects and mixed objects/arrays
    const obj: any = {};
    for (const key in value) {
      if (Object.prototype.hasOwnProperty.call(value, key)) {
        obj[key] = deserialize(value[key]);
      }
    }
    return obj;
  } else {
    // Return other types as is
    return value;
  }
}
