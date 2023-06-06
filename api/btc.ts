import { BtcTransactionData } from '../types/api/blockcypher/wallet';
import { NetworkType } from '../types/network';
import { parseBtcTransactionData, parseOrdinalsBtcTransactions } from './helper';
import BitcoinEsploraApiProvider from './esplora/esploraAPiProvider';
import * as esplora from '../types/api/esplora';

export async function fetchBtcOrdinalTransactions(ordinalsAddress: string, network: NetworkType) {
  const btcClient = new BitcoinEsploraApiProvider({
    network,
  });
  const transactions: BtcTransactionData[] = [];
  const txResponse: esplora.Transaction[] = await btcClient.getAddressTransactions(ordinalsAddress);
  txResponse.forEach((tx) => {
    transactions.push(parseOrdinalsBtcTransactions(tx, ordinalsAddress));
  });
  return transactions.filter((tx) => tx.incoming);
}

export async function fetchBtcPaymentTransactions(
  btcAddress: string,
  ordinalsAddress: string,
  network: NetworkType
) {
  const btcClient = new BitcoinEsploraApiProvider({
    network,
  });
  const transactions: BtcTransactionData[] = [];
  const txResponse: esplora.Transaction[] = await btcClient.getAddressTransactions(btcAddress);
  txResponse.forEach((tx) => {
    transactions.push(parseBtcTransactionData(tx, btcAddress, ordinalsAddress));
  });
  return transactions;
}

export async function fetchBtcTransactionsData(
  btcAddress: string,
  ordinalsAddress: string,
  network: NetworkType,
  withOrdinals: boolean
): Promise<BtcTransactionData[]> {
  if (withOrdinals) {
    const ordinalsTransactions = await fetchBtcOrdinalTransactions(ordinalsAddress, network);
    const paymentTransactions = await fetchBtcPaymentTransactions(
      btcAddress,
      ordinalsAddress,
      network
    );
    return [...new Set([...paymentTransactions, ...ordinalsTransactions])];
  }
  const paymentTransactions = await fetchBtcPaymentTransactions(
    btcAddress,
    ordinalsAddress,
    network
  );
  return paymentTransactions;
}
