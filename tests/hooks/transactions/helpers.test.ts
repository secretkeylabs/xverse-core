import BigNumber from 'bignumber.js';
import { calculateStxRbfData } from '../../../hooks/transactions/helpers';
import { AppInfo } from '../../../types';
import { describe, expect, it } from 'vitest';
import { microstacksToStx } from '../../../currency';

const lowFee = 1000;
const mediumFee = 2000;
const highFee = 3000;
const threshold = 5000;

const feeEstimations = [
  { fee: lowFee, fee_rate: lowFee },
  { fee: mediumFee, fee_rate: mediumFee },
  { fee: highFee, fee_rate: highFee },
];

// We start the testing with the low fee set as the transaction fee here
const currentTxFee = BigNumber(lowFee);

const mockAppInfo: AppInfo = {
  stxSendTxMultiplier: 1,
  poolStackingTxMultiplier: 1,
  otherTxMultiplier: 1,
  thresholdHighSatsFee: 1,
  thresholdHighSatsPerByteRatio: 1,
  thresholdHighStacksFee: threshold,
};

const mockStxAvailableBalance = '4000';

const mockResult = {
  rbfTransaction: undefined,
  rbfTxSummary: {
    currentFee: microstacksToStx(BigNumber(lowFee)).toNumber(),
    currentFeeRate: microstacksToStx(BigNumber(lowFee)).toNumber(),
    // The minimum fee should be 1.25 times the current fee
    minimumRbfFee: microstacksToStx(BigNumber(lowFee).multipliedBy(1.25)).toNumber(),
    minimumRbfFeeRate: microstacksToStx(BigNumber(lowFee).multipliedBy(1.25)).toNumber(),
  },
  rbfRecommendedFees: {
    high: {
      enoughFunds: true,
      fee: microstacksToStx(BigNumber(highFee)).toNumber(),
      feeRate: microstacksToStx(BigNumber(highFee)).toNumber(),
    },
    medium: {
      enoughFunds: true,
      fee: microstacksToStx(BigNumber(mediumFee)).toNumber(),
      feeRate: microstacksToStx(BigNumber(mediumFee)).toNumber(),
    },
  },
  mempoolFees: {
    fastestFee: microstacksToStx(BigNumber(highFee)).toNumber(),
    halfHourFee: microstacksToStx(BigNumber(mediumFee)).toNumber(),
    hourFee: microstacksToStx(BigNumber(lowFee)).toNumber(),
    economyFee: microstacksToStx(BigNumber(lowFee)).toNumber(),
    minimumFee: microstacksToStx(BigNumber(lowFee)).toNumber(),
  },
};

describe('calculateStxRbfData method', async () => {
  it('should return the fee estimation fetched from the Stacks function', async () => {
    const result = await calculateStxRbfData(currentTxFee, feeEstimations, mockAppInfo, mockStxAvailableBalance);

    expect(result).toBeDefined();
    expect(result).toEqual(mockResult);
    // Checking if the minimum fee is set to 1.25 times the current fee
    expect(result.rbfTxSummary?.minimumRbfFee).toEqual(microstacksToStx(currentTxFee.multipliedBy(1.25)).toNumber());
  });

  it('should return the fee estimation based on the current fee', async () => {
    const fee = BigNumber(mediumFee + 500);
    const result = await calculateStxRbfData(fee, feeEstimations, mockAppInfo, mockStxAvailableBalance);

    expect(result).toBeDefined();
    expect(result).toEqual({
      ...mockResult,
      rbfRecommendedFees: {
        highest: {
          enoughFunds: true,
          // Checking if the highest fee is set to 1.5 times the current fee
          fee: microstacksToStx(fee.multipliedBy(1.5)).toNumber(),
          feeRate: microstacksToStx(fee.multipliedBy(1.5)).toNumber(),
        },
        higher: {
          enoughFunds: true,
          // Checking if the higher fee is set to 1.25 times the current fee
          fee: microstacksToStx(fee.multipliedBy(1.25)).toNumber(),
          feeRate: microstacksToStx(fee.multipliedBy(1.25)).toNumber(),
        },
      },
      rbfTxSummary: {
        currentFee: microstacksToStx(fee).toNumber(),
        currentFeeRate: microstacksToStx(fee).toNumber(),
        // Checking if the minimum fee is set to 1.25 times the current fee
        minimumRbfFee: microstacksToStx(fee.multipliedBy(1.25)).toNumber(),
        minimumRbfFeeRate: microstacksToStx(fee.multipliedBy(1.25)).toNumber(),
      },
    });
  });

  it('should return falsy value for the enoughFunds when the balance is not enough', async () => {
    const availableBalance = '1';
    const result = await calculateStxRbfData(currentTxFee, feeEstimations, mockAppInfo, availableBalance);

    expect(result).toBeDefined();
    expect(result.rbfRecommendedFees?.high?.enoughFunds).toEqual(false);
    expect(result.rbfRecommendedFees?.medium?.enoughFunds).toEqual(false);
  });

  it('should cap the fees based on the thresholdHighStacksFee from appInfo', async () => {
    const highFeeAboveThreshold = threshold + 1000; // Set a high fee above the threshold
    const modifiedFeeEstimations = [
      { fee: lowFee, fee_rate: lowFee },
      { fee: mediumFee, fee_rate: mediumFee },
      { fee: highFeeAboveThreshold, fee_rate: highFeeAboveThreshold },
    ];

    const result = await calculateStxRbfData(
      currentTxFee,
      modifiedFeeEstimations,
      mockAppInfo,
      mockStxAvailableBalance,
    );

    expect(result).toBeDefined();
    expect(result.rbfRecommendedFees?.medium?.fee).toEqual(
      microstacksToStx(BigNumber(mockAppInfo.thresholdHighStacksFee)).toNumber(),
    );
    expect(result.rbfRecommendedFees?.medium?.feeRate).toEqual(
      microstacksToStx(BigNumber(mockAppInfo.thresholdHighStacksFee)).toNumber(),
    );
    expect(result.rbfRecommendedFees?.high?.fee).toEqual(
      microstacksToStx(BigNumber(mockAppInfo.thresholdHighStacksFee * 1.5)).toNumber(),
    );
    expect(result.rbfRecommendedFees?.high?.feeRate).toEqual(
      microstacksToStx(BigNumber(mockAppInfo.thresholdHighStacksFee * 1.5)).toNumber(),
    );
  });
});
