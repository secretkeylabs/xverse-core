import { deserializeTransaction, estimateTransaction } from '@stacks/transactions';
import BigNumber from 'bignumber.js';
import { RbfRecommendedFees, getRawTransaction, rbf } from '../../transactions';
import {
  AppInfo,
  RecommendedFeeResponse,
  SettingsNetwork,
  BtcTransactionData,
  StacksNetwork,
  StacksTransaction,
  StxTransactionData,
} from '../../types';
import { microstacksToStx } from '../../currency';

export type RbfData = {
  rbfTransaction?: InstanceType<typeof rbf.RbfTransaction>;
  rbfTxSummary?: {
    currentFee: number;
    currentFeeRate: number;
    minimumRbfFee: number;
    minimumRbfFeeRate: number;
  };
  rbfRecommendedFees?: RbfRecommendedFees;
  mempoolFees?: RecommendedFeeResponse;
  isLoading?: boolean;
  errorCode?: 'SOMETHING_WENT_WRONG';
};

export const isBtcTransaction = (
  transaction: BtcTransactionData | StxTransactionData,
): transaction is BtcTransactionData => transaction?.txType === 'bitcoin';

export const constructRecommendedFees = (
  lowerName: keyof RbfRecommendedFees,
  lowerFeeRate: number,
  higherName: keyof RbfRecommendedFees,
  higherFeeRate: number,
  stxAvailableBalance: string,
): RbfRecommendedFees => {
  const bigNumLowerFee = BigNumber(lowerFeeRate);
  const bigNumHigherFee = BigNumber(higherFeeRate);

  return {
    [lowerName]: {
      enoughFunds: bigNumLowerFee.lte(BigNumber(stxAvailableBalance)),
      feeRate: microstacksToStx(bigNumLowerFee).toNumber(),
      fee: microstacksToStx(bigNumLowerFee).toNumber(),
    },
    [higherName]: {
      enoughFunds: bigNumHigherFee.lte(BigNumber(stxAvailableBalance)),
      feeRate: microstacksToStx(bigNumHigherFee).toNumber(),
      fee: microstacksToStx(bigNumHigherFee).toNumber(),
    },
  };
};

export const sortFees = (fees: RbfRecommendedFees) =>
  Object.fromEntries(
    Object.entries(fees).sort((a, b) => {
      const priorityOrder = ['highest', 'higher', 'high', 'medium'];
      return priorityOrder.indexOf(a[0]) - priorityOrder.indexOf(b[0]);
    }),
  );

export const calculateStxData = async (
  transaction: StxTransactionData,
  btcNetwork: SettingsNetwork,
  stacksNetwork: StacksNetwork,
  appInfo: AppInfo | null,
  stxAvailableBalance: string,
): Promise<RbfData> => {
  const { fee } = transaction;
  const txRaw: string = await getRawTransaction(transaction.txid, btcNetwork);
  const unsignedTx: StacksTransaction = deserializeTransaction(txRaw);

  const [slow, medium, high] = await estimateTransaction(unsignedTx.payload, undefined, stacksNetwork);

  let feePresets: RbfRecommendedFees = {};
  let mediumFee = medium.fee;
  let highFee = high.fee;
  const higherFee = fee.multipliedBy(1.25).toNumber();
  const highestFee = fee.multipliedBy(1.5).toNumber();

  if (appInfo?.thresholdHighStacksFee) {
    if (high.fee > appInfo.thresholdHighStacksFee) {
      // adding a fee cap
      highFee = appInfo.thresholdHighStacksFee * 1.5;
      mediumFee = appInfo.thresholdHighStacksFee;
    }
  }

  let minimumFee = fee.multipliedBy(1.25).toNumber();
  if (!Number.isSafeInteger(minimumFee)) {
    // round up the fee to the nearest integer
    minimumFee = Math.ceil(minimumFee);
  }

  if (fee.lt(BigNumber(mediumFee))) {
    feePresets = constructRecommendedFees('medium', mediumFee, 'high', highFee, stxAvailableBalance);
  } else {
    feePresets = constructRecommendedFees('higher', higherFee, 'highest', highestFee, stxAvailableBalance);
  }

  return {
    rbfTransaction: undefined,
    rbfTxSummary: {
      currentFee: microstacksToStx(fee).toNumber(),
      currentFeeRate: microstacksToStx(fee).toNumber(),
      minimumRbfFee: microstacksToStx(BigNumber(minimumFee)).toNumber(),
      minimumRbfFeeRate: microstacksToStx(BigNumber(minimumFee)).toNumber(),
    },
    rbfRecommendedFees: sortFees(feePresets),
    mempoolFees: {
      fastestFee: microstacksToStx(BigNumber(high.fee)).toNumber(),
      halfHourFee: microstacksToStx(BigNumber(medium.fee)).toNumber(),
      hourFee: microstacksToStx(BigNumber(slow.fee)).toNumber(),
      economyFee: microstacksToStx(BigNumber(slow.fee)).toNumber(),
      minimumFee: microstacksToStx(BigNumber(slow.fee)).toNumber(),
    },
  };
};
