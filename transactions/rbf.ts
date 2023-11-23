import { RecommendedFeeResponse, Transaction } from '../types/api/esplora';

// TODO: this is from txn consolidation logic
// TODO: Use that instead once merged
// TODO: Also, use that to sign these txns once merged
const areByteArraysEqual = (a: undefined | Uint8Array, b: undefined | Uint8Array): boolean => {
  if (!a || !b || a.length !== b.length) {
    return false;
  }

  return a.every((v, i) => v === b[i]);
};

const isTransactionRbfEnabled = (transaction: Transaction) => {
  if (transaction.status.confirmed) {
    return false;
  }

  return transaction.vin.some((input) => input.sequence < 0xffffffff - 1);
};

const getRbfTransactionSummary = (transaction: Transaction) => {
  const transactionVSize = transaction.weight / 4;

  const currentTransactionInputTotals = transaction.vin.reduce((total, input) => total + input.prevout.value, 0);
  const currentTransactionOutputTotals = transaction.vout.reduce((total, output) => total + output.value, 0);

  const currentFee = currentTransactionInputTotals - currentTransactionOutputTotals;
  const currentFeeRate = Math.ceil(currentFee / transactionVSize);

  const minimumRbfFee = Math.ceil(transaction.fee + transactionVSize);
  const minimumRbfFeeRate = Math.ceil(minimumRbfFee / transactionVSize);

  return { currentFee, currentFeeRate, minimumRbfFee, minimumRbfFeeRate };
};

type TierFees = {
  fee: number;
  feeRate: number;
};

type RbfRecommendedFees = {
  medium?: TierFees;
  high?: TierFees;
  higher?: TierFees;
  highest?: TierFees;
};

const getRbfRecommendedFees = (transaction: Transaction, mempoolFees: RecommendedFeeResponse): RbfRecommendedFees => {
  const { minimumRbfFeeRate } = getRbfTransactionSummary(transaction);

  const { halfHourFee: medium, fastestFee: high } = mempoolFees;

  if (minimumRbfFeeRate < medium) {
    return {
      medium: {
        fee: 0, // TODO
        feeRate: medium,
      },
      high: {
        fee: 0, // TODO
        feeRate: high,
      },
    };
  }

  if (minimumRbfFeeRate < high) {
    const higher = Math.ceil(high * 1.2);
    return {
      high: {
        fee: 0, // TODO
        feeRate: high,
      },
      higher: {
        fee: 0, // TODO
        feeRate: higher,
      },
    };
  }

  const higher = Math.ceil(minimumRbfFeeRate * 1.1);
  const highest = Math.ceil(minimumRbfFeeRate * 1.2);

  return {
    higher: {
      fee: 0, // TODO
      feeRate: higher,
    },
    highest: {
      fee: 0, // TODO
      feeRate: highest,
    },
  };
};

export default {
  isTransactionRbfEnabled,
  getRbfTransactionSummary,
  getRbfRecommendedFees,
};
