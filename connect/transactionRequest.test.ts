import { describe, expect, it } from 'vitest';
import { stxFeeReducer } from './transactionRequest';
import { AppInfo } from '../types';

describe('stxFeeReducer', () => {
  [
    {
      name: 'returns initialFee when no appInfo',
      inputs: { initialFee: BigInt(3), appInfo: null },
      expectedFee: BigInt(3),
    },
    {
      name: 'returns initialFee when no send multiplier and no threshold',
      inputs: {
        initialFee: BigInt(3),
        appInfo: {
          stxSendTxMultiplier: undefined,
          thresholdHighStacksFee: undefined,
        } as unknown as AppInfo,
      },
      expectedFee: BigInt(3),
    },
    {
      name: 'returns fee with multiplier applied if under threshold',
      inputs: {
        initialFee: BigInt(1),
        appInfo: {
          stxSendTxMultiplier: 3,
          thresholdHighStacksFee: 6,
        } as unknown as AppInfo,
      },
      expectedFee: BigInt(3),
    },
    {
      name: 'returns intialFee unmodified if multiplier is not an integer',
      inputs: {
        initialFee: BigInt(1),
        appInfo: {
          stxSendTxMultiplier: 0.5,
          thresholdHighStacksFee: 6,
        } as unknown as AppInfo,
      },
      expectedFee: BigInt(1),
    },
    {
      name: 'returns threshold fee if initialFee is higher',
      inputs: {
        initialFee: BigInt(10),
        appInfo: {
          stxSendTxMultiplier: 1,
          thresholdHighStacksFee: 6,
        } as unknown as AppInfo,
      },
      expectedFee: BigInt(6),
    },
    {
      name: 'returns threshold fee if fee after multiplier is higher',
      inputs: {
        initialFee: BigInt(2),
        appInfo: {
          stxSendTxMultiplier: 4,
          thresholdHighStacksFee: 6,
        } as unknown as AppInfo,
      },
      expectedFee: BigInt(6),
    },
  ].forEach(({ name, inputs, expectedFee }) => {
    it(name, () => {
      expect(stxFeeReducer(inputs)).toEqual(expectedFee);
    });
  });
});
