import { PsbtSummary, TransactionContext, TransactionSummary } from '../../transactions/bitcoin';
import { NetworkType } from '../../types';
import { parseSummaryForRunes } from '../runes';
import { compileAggregatedSummary } from './aggregatedSummary';
import { isPsbtSummary } from './shared';
import { AggregatedSummary, BaseSummary, UserTransactionSummary } from './types';
import { compileUserTransactionSummary } from './userTransactionSummary';

export const extractViewSummary = async (
  context: TransactionContext,
  summary: TransactionSummary | PsbtSummary,
  network: NetworkType,
): Promise<UserTransactionSummary | AggregatedSummary> => {
  const userAddresses = new Set([context.paymentAddress.address, context.ordinalsAddress.address]);
  const runeSummary = await parseSummaryForRunes(context, summary, network);

  const base: BaseSummary = {
    runes: {
      mint: runeSummary.mint,
      burns: runeSummary.burns,
      hasCenotaph: (summary.runeOp?.Cenotaph?.flaws ?? 0) > 0,
      hasInvalidMint: runeSummary.mint ? !(runeSummary.mint.runeIsOpen && runeSummary.mint.runeIsMintable) : false,
      hasInsufficientBalance: runeSummary.transfers.some((transfer) => !transfer.hasSufficientBalance),
    },
    inputs: summary.inputs,
    outputs: summary.outputs,
    feeRate: summary.feeRate,
    isFinal: isPsbtSummary(summary) ? summary.isFinal : true, // internal transactions are always final
    hasSigHashNone: isPsbtSummary(summary) ? summary.hasSigHashNone : false,
    hasSigHashSingle: isPsbtSummary(summary) ? summary.hasSigHashSingle : false,
    hasExternalInputs: summary.inputs.some((input) => !userAddresses.has(input.extendedUtxo.address)),
    hasOutputScript: summary.outputs.some((output) => output.type === 'script'),
    hasUnconfirmedInputs: summary.inputs.some(
      (input) => input.walletWillSign && !input.extendedUtxo.utxo.status.confirmed,
    ),
  };

  if (base.isFinal && !base.hasExternalInputs) {
    return compileUserTransactionSummary(context, summary, runeSummary, base);
  }
  return compileAggregatedSummary(context, summary, runeSummary, base);
};

export * from './aggregatedSummary';
export * from './types';
export * from './userTransactionSummary';
