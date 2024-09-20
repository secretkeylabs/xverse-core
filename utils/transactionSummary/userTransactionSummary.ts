import { PsbtSummary, TransactionContext, TransactionSummary } from '../../transactions/bitcoin';
import { RuneSummary } from '../runes';
import { combineInscriptionsAndSatributes, getAddressSummary } from './shared';
import {
  AggregatedOutputSummary,
  BaseSummary,
  TransferBundle,
  TransferIOSummary,
  UserTransactionSummary,
} from './types';

const extractIOSummaries = (
  context: TransactionContext,
  summary: TransactionSummary | PsbtSummary,
  runeSummary: RuneSummary,
): TransferIOSummary[] => {
  const userAddresses = new Set([context.paymentAddress.address, context.ordinalsAddress.address]);
  const destinationTransfers: Record<string, TransferIOSummary> = {};

  for (const [idx, output] of summary.outputs.entries()) {
    if (output.type === 'script') {
      // op_return outputs are not considered as destinations
      continue;
    }

    const outputAddress = output.type === 'address' ? output.address : undefined;
    // we aggregate user address outputs separately, so skip them from this list
    if (outputAddress && userAddresses.has(outputAddress)) {
      continue;
    }

    if (!(output.scriptHex in destinationTransfers)) {
      destinationTransfers[output.scriptHex] = {
        destinationType: output.type,
        address: outputAddress,
        script: output.script,
        scriptHex: output.scriptHex,
        btcSatsAmount: 0,
        bundles: [],
      };
    }

    // no assets on output, so add to btc sats amount
    if (output.inscriptions.length === 0 && output.satributes.length === 0 && !runeSummary.outputMapping[idx]) {
      destinationTransfers[output.scriptHex].btcSatsAmount += output.amount;
      continue;
    }

    // assets on the output, so extract bundle
    const mergedInscriptionsSatributes = combineInscriptionsAndSatributes(output.inscriptions, output.satributes);
    const bundle: TransferBundle = {
      amount: output.amount,
      inscriptions: mergedInscriptionsSatributes.inscriptions,
      satributes: mergedInscriptionsSatributes.satributes,
      runes: runeSummary.outputMapping[idx] || [],
    };

    destinationTransfers[output.scriptHex].bundles.push(bundle);
  }

  return Object.values(destinationTransfers);
};

const getUserAddressSummary = (
  address: string,
  summary: TransactionSummary | PsbtSummary,
  runeSummary: RuneSummary,
): AggregatedOutputSummary => {
  const addressSummary = getAddressSummary(address, summary, runeSummary);
  return addressSummary.receipts;
};

export const compileUserTransactionSummary = (
  context: TransactionContext,
  summary: TransactionSummary | PsbtSummary,
  runeSummary: RuneSummary,
  base: BaseSummary,
): UserTransactionSummary => {
  if (!summary.feeOutput || !summary.feeRate) {
    throw new Error('Transaction summary should be compiled with fee output and fee rate for user transaction summary');
  }

  const transfers = extractIOSummaries(context, summary, runeSummary);

  return {
    ...base,
    type: 'user',
    transfers,
    feeOutput: summary.feeOutput,
    paymentsAddressReceipts: getUserAddressSummary(context.paymentAddress.address, summary, runeSummary),
    ordinalsAddressReceipts: getUserAddressSummary(context.ordinalsAddress.address, summary, runeSummary),
  };
};
