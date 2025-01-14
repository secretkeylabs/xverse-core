import {
  fetchFeeEstimateTransaction,
  estimateTransactionByteLength,
  getFee,
  PayloadType,
  StacksTransactionWire,
  serializePayloadBytes,
} from '@stacks/transactions';
import { FeeEstimation, getMempoolFeePriorities, getXverseApiClient } from '../../api';
import { StacksNetwork } from '@stacks/network';
import { MempoolFeePriorities } from '@stacks/stacks-blockchain-api-types';
import { bytesToHex } from '@noble/hashes/utils';
import { AppInfo, StacksMainnet } from '../../types';

/**
 * stxFeeReducer - given initialFee, and appInfo (stacks fee multiplier and threshold config),
 * return the newFee
 * @param initialFee
 * @param appInfo
 * @returns newFee
 */
export const stxFeeReducer = ({
  initialFee,
  appInfo,
  txType,
}: {
  initialFee: bigint;
  appInfo: AppInfo | null;
  txType: PayloadType;
}): bigint => {
  let newFee = initialFee;

  const multiplier = appInfo
    ? txType === PayloadType.ContractCall
      ? appInfo.otherTxMultiplier
      : appInfo.stxSendTxMultiplier
    : 1;

  // apply multiplier
  if (Number.isInteger(multiplier)) {
    newFee = newFee * BigInt(multiplier);
  }

  // cap the fee at thresholdHighStacksFee
  if (
    appInfo?.thresholdHighStacksFee &&
    Number.isInteger(appInfo?.thresholdHighStacksFee) &&
    newFee > BigInt(appInfo.thresholdHighStacksFee)
  ) {
    newFee = BigInt(appInfo.thresholdHighStacksFee);
  }

  return newFee;
};

/**
 * applyMultiplierAndCapFeeAtThreshold - modifies the param unsignedTx with stx fee multiplier and fee cap
 * @param unsignedTx
 * @param appInfo
 */
export const applyMultiplierAndCapFeeAtThreshold = async (
  unsignedTx: StacksTransactionWire,
  network: StacksNetwork,
) => {
  const appInfo = await getXverseApiClient(
    network.chainId === StacksMainnet.chainId ? 'Mainnet' : 'Testnet',
  ).fetchAppInfo();
  const newFee = stxFeeReducer({
    initialFee: getFee(unsignedTx.auth),
    appInfo,
    txType: unsignedTx.payload.payloadType,
  });
  unsignedTx.setFee(newFee);
};

const getFallbackFees = (
  transaction: StacksTransactionWire,
  mempoolFees: MempoolFeePriorities,
): [FeeEstimation, FeeEstimation, FeeEstimation] => {
  if (!transaction || !transaction.payload) {
    throw new Error('Invalid transaction object');
  }

  if (!mempoolFees) {
    throw new Error('Invalid mempool fees object');
  }

  const { payloadType } = transaction.payload;

  if (payloadType === PayloadType.ContractCall && mempoolFees.contract_call) {
    return [
      { fee: mempoolFees.contract_call.low_priority },
      { fee: mempoolFees.contract_call.medium_priority },
      { fee: mempoolFees.contract_call.high_priority },
    ];
  } else if (payloadType === PayloadType.TokenTransfer && mempoolFees.token_transfer) {
    return [
      { fee: mempoolFees.token_transfer.low_priority },
      { fee: mempoolFees.token_transfer.medium_priority },
      { fee: mempoolFees.token_transfer.high_priority },
    ];
  }
  return [
    { fee: mempoolFees.all.low_priority },
    { fee: mempoolFees.all.medium_priority },
    { fee: mempoolFees.all.high_priority },
  ];
};

export const modifyRecommendedStxFees = (
  baseFees: {
    low: number;
    medium: number;
    high: number;
  },
  appInfo: AppInfo | undefined | null,
  txType: PayloadType,
): { low: number; medium: number; high: number } => {
  const multiplier = appInfo
    ? txType === PayloadType.ContractCall
      ? appInfo.otherTxMultiplier
      : appInfo.stxSendTxMultiplier
    : 1;
  const highCap = appInfo?.thresholdHighStacksFee;

  let adjustedLow = Math.round(baseFees.low * multiplier);
  let adjustedMedium = Math.round(baseFees.medium * multiplier);
  let adjustedHigh = Math.round(baseFees.high * multiplier);

  if (highCap && highCap < adjustedMedium) {
    adjustedLow = adjustedLow < highCap ? adjustedLow : Math.round(highCap * 0.75);
    adjustedMedium = highCap;
    adjustedHigh = Math.round(highCap * 1.25);
  } else if (highCap && highCap < adjustedHigh) {
    adjustedHigh = highCap;
  }

  return { low: adjustedLow, medium: adjustedMedium, high: adjustedHigh };
};

/**
 * Estimates the fee using {@link getMempoolFeePriorities} as a fallback if
 * {@link estimateTransaction} does not get an estimation due to the
 * {NoEstimateAvailableError} error.
 */
export const estimateStacksTransactionWithFallback = async (
  transaction: StacksTransactionWire,
  network: StacksNetwork,
): Promise<[FeeEstimation, FeeEstimation, FeeEstimation]> => {
  try {
    const estimatedLen = estimateTransactionByteLength(transaction);

    const [slower, regular, faster] = await fetchFeeEstimateTransaction({
      payload: bytesToHex(serializePayloadBytes(transaction.payload)),
      estimatedLength: estimatedLen,
      network,
    });
    return [slower, regular, faster];
  } catch (error) {
    const mempoolFees = await getMempoolFeePriorities(network);
    return getFallbackFees(transaction, mempoolFees);
  }
};
