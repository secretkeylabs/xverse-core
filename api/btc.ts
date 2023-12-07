import { BtcTransactionData } from '../types/api/blockcypher/wallet';
import * as esplora from '../types/api/esplora';
import EsploraApiProvider from './esplora/esploraAPiProvider';
import { parseBtcTransactionData, parseOrdinalsBtcTransactions } from './helper';

export async function fetchBtcOrdinalTransactions(ordinalsAddress: string, esploraProvider: EsploraApiProvider) {
  const transactions: BtcTransactionData[] = [];
  const txResponse: esplora.Transaction[] = await esploraProvider.getAddressTransactions(ordinalsAddress);
  txResponse.forEach((tx) => {
    transactions.push(parseOrdinalsBtcTransactions(tx, ordinalsAddress));
  });
  return transactions.filter((tx) => tx.incoming);
}

export async function fetchBtcPaymentTransactions(
  btcAddress: string,
  ordinalsAddress: string,
  esploraProvider: EsploraApiProvider,
) {
  const transactions: BtcTransactionData[] = [];
  const txResponse: esplora.Transaction[] = await esploraProvider.getAddressTransactions(btcAddress);
  txResponse.forEach((tx) => {
    transactions.push(parseBtcTransactionData(tx, btcAddress, ordinalsAddress));
  });
  return transactions;
}

export async function fetchBtcTransactionsData(
  btcAddress: string,
  ordinalsAddress: string,
  esploraProvider: EsploraApiProvider,
  withOrdinals: boolean,
): Promise<BtcTransactionData[]> {
  if (withOrdinals) {
    const ordinalsTransactions = await fetchBtcOrdinalTransactions(ordinalsAddress, esploraProvider);
    const paymentTransactions = await fetchBtcPaymentTransactions(btcAddress, ordinalsAddress, esploraProvider);
    return [...new Set([...paymentTransactions, ...ordinalsTransactions])];
  }
  const paymentTransactions = await fetchBtcPaymentTransactions(btcAddress, ordinalsAddress, esploraProvider);
  return paymentTransactions;
}

export async function fetchBtcTransaction(
  id: string,
  btcAddress: string,
  ordinalsAddress: string,
  esploraProvider: EsploraApiProvider,
  isOrdinal?: boolean,
) {
  const txResponse: esplora.Transaction = await esploraProvider.getTransaction(id);
  const transaction: BtcTransactionData = isOrdinal
    ? parseOrdinalsBtcTransactions(txResponse, ordinalsAddress)
    : parseBtcTransactionData(txResponse, btcAddress, ordinalsAddress);
  return transaction;
}
