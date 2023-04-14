import axios from 'axios';
import {
  BtcTransactionsDataResponse,
  BtcTransactionData,
  BtcUtxoDataResponse,
  BtcAddressDataResponse,
  BtcBalance,
} from '../types/api/blockcypher/wallet';
import { NetworkType } from '../types/network';
import { parseBtcTransactionData, parseOrdinalsBtcTransactions } from './helper';

export async function fetchBtcAddressUnspent(
  btcAddress: string,
  network: NetworkType,
  limit: number = 1000
): Promise<Array<BtcUtxoDataResponse>> {
  const btcApiBaseUrl = `https://api.blockcypher.com/v1/btc/main/addrs/${btcAddress}?unspentOnly=true&limit=${limit}`;
  const btcApiBaseUrlTestnet = `https://api.blockcypher.com/v1/btc/test3/addrs/${btcAddress}?unspentOnly=true&limit=${limit}`;
  let apiUrl = btcApiBaseUrl;
  if (network === 'Testnet') {
    apiUrl = btcApiBaseUrlTestnet;
  }
  return axios.get<BtcAddressDataResponse>(apiUrl, { timeout: 45000 }).then((response) => {
    const confirmed = response.data.txrefs
      ? (response.data.txrefs as Array<BtcUtxoDataResponse>)
      : [];
    const unconfirmed = response.data.unconfirmed_n_tx
      ? (response.data.unconfirmed_txrefs as Array<BtcUtxoDataResponse>)
      : [];
    const combined = [...confirmed, ...unconfirmed];
    return combined;
  });
}

export async function fetchPoolBtcAddressBalance(
  btcAddress: string,
  network: NetworkType
): Promise<BtcBalance> {
  const btcApiBaseUrl = 'https://api.blockcypher.com/v1/btc/main/addrs/';
  const btcApiBaseUrlTestnet = 'https://api.blockcypher.com/v1/btc/test3/addrs/';
  let apiUrl = `${btcApiBaseUrl}${btcAddress}`;
  if (network === 'Testnet') {
    apiUrl = `${btcApiBaseUrlTestnet}${btcAddress}`;
  }
  return axios
    .get<BtcAddressDataResponse>(apiUrl, { headers: { 'Access-Control-Allow-Origin': '*' } })
    .then((response) => {
      const btcPoolData: BtcBalance = {
        balance: response.data.final_balance,
      };
      return btcPoolData;
    });
}


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

