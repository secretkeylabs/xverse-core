import axios from 'axios';
import { BtcTransactionsDataResponse, BtcTransactionData } from '../types/api/blockcypher/wallet';
import { NetworkType } from '../types/network';
import { parseBtcTransactionData, parseOrdinalsBtcTransactions } from './helper';

export async function fetchBtcOrdinalTransactions(ordinalsAddress: string, network: NetworkType) {
  const btcApiBaseUrl = `https://api.blockcypher.com/v1/btc/main/addrs/${ordinalsAddress}/full?txlimit=3000`;
  const btcApiBaseUrlTestnet = `https://api.blockcypher.com/v1/btc/test3/addrs/${ordinalsAddress}/full?txlimit=3000`;
  let apiUrl = btcApiBaseUrl;
  if (network === 'Testnet') {
    apiUrl = btcApiBaseUrlTestnet;
  }
  return axios.get<BtcTransactionsDataResponse>(apiUrl, { timeout: 45000 }).then((response) => {
    const transactions: BtcTransactionData[] = [];
    response.data.txs.forEach((tx) => {
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
  const btcApiBaseUrl = `https://api.blockcypher.com/v1/btc/main/addrs/${btcAddress}/full?txlimit=3000`;
  const btcApiBaseUrlTestnet = `https://api.blockcypher.com/v1/btc/test3/addrs/${btcAddress}/full?txlimit=3000`;
  let apiUrl = btcApiBaseUrl;
  if (network === 'Testnet') {
    apiUrl = btcApiBaseUrlTestnet;
  }
  return axios.get<BtcTransactionsDataResponse>(apiUrl, { timeout: 45000 }).then((response) => {
    const transactions: BtcTransactionData[] = [];
    response.data.txs.forEach((tx) => {
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
  const btcApiBaseUrl = `https://api.blockcypher.com/v1/btc/main/addrs/${btcAddress}/full?txlimit=3000`;
  const btcApiBaseUrlTestnet = `https://api.blockcypher.com/v1/btc/test3/addrs/${btcAddress}/full?txlimit=3000`;
  let apiUrl = btcApiBaseUrl;
  if (network === 'Testnet') {
    apiUrl = btcApiBaseUrlTestnet;
  }
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
