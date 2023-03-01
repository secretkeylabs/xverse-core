import {
  NetworkType,
  BtcUtxoDataResponse,
  BtcAddressDataResponse,
  BtcTransactionBroadcastResponse,
  BtcBalance,
  BtcOrdinal,
} from 'types';
import axios from 'axios';
import { BtcAddressData } from 'types/api/blockcypher/wallet';
import { BtcTransactionsDataResponse } from 'types/api/blockcypher/wallet';
import { BtcTransactionData } from 'types/api/blockcypher/wallet';
import { parseBtcTransactionData } from './helper';

export async function fetchBtcAddressUnspent(
  btcAddress: string,
  network: NetworkType,
  limit: number = 500
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

export async function broadcastRawBtcTransaction(
  rawTx: string,
  network: NetworkType
): Promise<BtcTransactionBroadcastResponse> {
  const btcApiBaseUrl = 'https://api.blockcypher.com/v1/btc/main/txs/push';
  const btcApiBaseUrlTestnet = 'https://api.blockcypher.com/v1/btc/test3/txs/push';
  let apiUrl = btcApiBaseUrl;
  if (network === 'Testnet') {
    apiUrl = btcApiBaseUrlTestnet;
  }
  const data = {
    tx: rawTx,
  };
  return axios
    .post<BtcTransactionBroadcastResponse>(apiUrl, data, { timeout: 45000 })
    .then((response) => {
      return response.data;
    });
}

export async function fetchBtcTransactionsData(
  btcAddress: string,
  network: NetworkType
): Promise<BtcAddressData> {
  const btcApiBaseUrl = `https://api.blockcypher.com/v1/btc/main/addrs/${btcAddress}/full?includeHex=true&txlimit=3000`;
  const btcApiBaseUrlTestnet = `https://api.blockcypher.com/v1/btc/test3/addrs/${btcAddress}/full?includeHex=true&txlimit=3000`;
  let apiUrl = btcApiBaseUrl;
  if (network === 'Testnet') {
    apiUrl = btcApiBaseUrlTestnet;
  }
  return axios.get<BtcTransactionsDataResponse>(apiUrl, { timeout: 45000 }).then((response) => {
    const transactions: BtcTransactionData[] = [];
    response.data.txs.forEach((tx) => {
      transactions.push(parseBtcTransactionData(tx, btcAddress));
    });
    const addressData: BtcAddressData = {
      address: response.data.address,
      totalReceived: response.data.total_received,
      totalSent: response.data.total_sent,
      balance: response.data.balance,
      unconfirmedBalance: response.data.unconfirmed_balance,
      finalBalance: response.data.final_balance,
      nTx: response.data.n_tx,
      unconfirmedTx: response.data.unconfirmed_tx,
      finalNTx: response.data.final_n_tx,
      transactions: transactions,
    };
    return addressData;
  });
}



