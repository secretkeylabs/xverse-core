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
export const stxFeeReducer = ({ initialFee, appInfo }: { initialFee: bigint; appInfo: AppInfo | null }): bigint => {
  let newFee = initialFee;

  // apply multiplier
  if (appInfo?.stxSendTxMultiplier && Number.isInteger(appInfo?.stxSendTxMultiplier)) {
    newFee = newFee * BigInt(appInfo.stxSendTxMultiplier);
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
 * applyFeeMultiplier - modifies the param unsignedTx with stx fee multiplier
 * @param unsignedTx
 * @param appInfo
 */
export const applyFeeMultiplier = (unsignedTx: StacksTransactionWire, appInfo: AppInfo | null) => {
  if (!appInfo) {
    return;
  }

  const newFee = stxFeeReducer({ initialFee: getFee(unsignedTx.auth), appInfo });
  unsignedTx.setFee(newFee);
};

export const applyMultiplierAndCapFeeAtThreshold = async (
  unsignedTx: StacksTransactionWire,
  network: StacksNetwork,
) => {
  const feeMultipliers = await getXverseApiClient(
    network.chainId === StacksMainnet.chainId ? 'Mainnet' : 'Testnet',
  ).fetchAppInfo();
  applyFeeMultiplier(unsignedTx, feeMultipliers);
  const fee = getFee(unsignedTx.auth);
  if (feeMultipliers && fee > BigInt(feeMultipliers?.thresholdHighStacksFee)) {
    unsignedTx.setFee(BigInt(feeMultipliers.thresholdHighStacksFee));
  }
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
    const err = error.toString();
    if (!err.includes('NoEstimateAvailable')) {
      throw error;
    }
    const mempoolFees = await getMempoolFeePriorities(network);
    return getFallbackFees(transaction, mempoolFees);
  }
};
