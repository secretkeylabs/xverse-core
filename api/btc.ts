import axios from 'axios';
import { BtcTransactionData } from '../types/api/blockcypher/wallet';
import { NetworkType } from '../types/network';
import { parseBtcTransactionData, parseOrdinalsBtcTransactions } from './helper';
import { BTC_BASE_URI_MAINNET, BTC_BASE_URI_TESTNET } from '../constant';
import { BtcTransaction } from '../types/api/mempoolspace/btc';

export async function fetchBtcOrdinalTransactions(ordinalsAddress: string, network: NetworkType) {
  const btcApiBaseUrl = `${BTC_BASE_URI_MAINNET}/address/${ordinalsAddress}/txs`;
  const btcApiBaseUrlTestnet = `${BTC_BASE_URI_TESTNET}/address/${ordinalsAddress}/txs`;
  const apiUrl = network === 'Mainnet' ? btcApiBaseUrl : btcApiBaseUrlTestnet;
  return axios.get<BtcTransaction[]>(apiUrl, { timeout: 45000 }).then((response) => {
    const transactions: BtcTransactionData[] = [];
    response.data.forEach((tx) => {
      transactions.push(parseOrdinalsBtcTransactions(tx, ordinalsAddress));
    });
    return transactions.filter((tx) => tx.incoming);
  });
}

export async function fetchBtcPaymentTransactions(
  btcAddress: string,
  ordinalsAddress: string,
  network: NetworkType
) {
  const btcApiBaseUrl = `${BTC_BASE_URI_MAINNET}/address/${btcAddress}/txs`;
  const btcApiBaseUrlTestnet = `${BTC_BASE_URI_TESTNET}/address/${btcAddress}/txs`;
  const apiUrl = network === 'Mainnet' ? btcApiBaseUrl : btcApiBaseUrlTestnet;

  return axios.get<BtcTransaction[]>(apiUrl, { timeout: 45000 }).then((response) => {
    const transactions: BtcTransactionData[] = [];
    response.data.forEach((tx) => {
      transactions.push(parseBtcTransactionData(tx, btcAddress, ordinalsAddress));
    });
    return transactions;
  });
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
