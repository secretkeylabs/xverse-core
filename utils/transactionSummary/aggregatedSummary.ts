import { PsbtSummary, TransactionContext, TransactionSummary } from '../../transactions/bitcoin';
import { RuneSummary } from '../runes';
import { getAddressSummary } from './shared';
import { AggregatedSummary, BaseSummary } from './types';

export const compileAggregatedSummary = (
  context: TransactionContext,
  summary: TransactionSummary | PsbtSummary,
  runeSummary: RuneSummary,
  base: BaseSummary,
): AggregatedSummary => {
  const paymentAddressSummary = getAddressSummary(context.paymentAddress.address, summary, runeSummary);
  const ordinalsAddressSummary = getAddressSummary(context.ordinalsAddress.address, summary, runeSummary);

  const transfers = {
    [context.paymentAddress.address]: paymentAddressSummary.transfers,
    [context.ordinalsAddress.address]: ordinalsAddressSummary.transfers,
  };
  const receipts = {
    [context.paymentAddress.address]: paymentAddressSummary.receipts,
    [context.ordinalsAddress.address]: ordinalsAddressSummary.receipts,
  };

  return {
    ...base,
    type: 'aggregated',
    transfers,
    receipts,
    fee: summary.feeOutput?.amount,
  };
};
