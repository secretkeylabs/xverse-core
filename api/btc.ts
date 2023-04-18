import { MAINNET_BROADCAST_URI, TESTNET_BROADCAST_URI } from './../constant';
import axios from 'axios';
import {
  BtcAddressBalanceResponse,
  BtcAddressData,
  BtcTransactionsDataResponse,
  BtcTransactionData,
  BtcUtxoDataResponse,
  BtcAddressDataResponse,
  BtcTransactionBroadcastResponse,
  BtcBalance,
  BtcTransactionDataResponse,
  BtcTransactionDataHexIncluded,
} from '../types/api/blockcypher/wallet';
import { NetworkType } from '../types/network';
import { parseBtcTransactionData, parseOrdinalsBtcTransactions } from './helper';
import { BtcAddressMempool } from '../types/api/blockstream/transactions';

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

export async function broadcastRawBtcTransaction(
  rawTx: string,
  network: NetworkType
): Promise<BtcTransactionBroadcastResponse> {
  const broadcastUrl = network === 'Mainnet' ? MAINNET_BROADCAST_URI : TESTNET_BROADCAST_URI;
  return axios.post(broadcastUrl, rawTx, { timeout: 45000 }).then((response) => {
    return {
      tx: {
        hash: response.data,
      },
    };
  });
}

export async function getBtcWalletData(
  btcPaymentAddress: string,
  network: NetworkType
): Promise<BtcAddressData> {
  const btcApiBaseUrl = `https://blockstream.info/api/address/${btcPaymentAddress}`;
  const btcApiBaseUrlTestnet = `https://blockstream.info/testnet/api/address/${btcPaymentAddress}`;
  let apiUrl = btcApiBaseUrl;
  if (network === 'Testnet') {
    apiUrl = btcApiBaseUrlTestnet;
  }
  return axios.get<BtcAddressBalanceResponse>(apiUrl).then((response) => {
    const {
      data: { address, chain_stats, mempool_stats },
    } = response;
    const finalBalance = chain_stats.funded_txo_sum - chain_stats.spent_txo_sum;
    const unconfirmedBalance = mempool_stats.funded_txo_sum - mempool_stats.spent_txo_sum;
    return {
      address,
      finalBalance,
      finalNTx: chain_stats.tx_count,
      totalReceived: chain_stats.funded_txo_sum,
      totalSent: chain_stats.spent_txo_sum,
      unconfirmedTx: mempool_stats.tx_count,
      unconfirmedBalance,
    };
  });
}

export async function fetchBtcTransactionData(
  txHash: string,
  btcAddress: string,
  ordinalsAddress: string
): Promise<BtcTransactionData> {
  const txDataApiUrl = `https://api.blockcypher.com/v1/btc/main/txs/${txHash}`;
  const response = await axios.get<BtcTransactionDataResponse>(txDataApiUrl);
  return parseBtcTransactionData(response.data, btcAddress, ordinalsAddress);
}

export async function fetchBtcTransactionRawData(
  tx_hash: string,
  network: NetworkType
): Promise<string> {
  const apiUrl = {
    Mainnet: `https://api.blockcypher.com/v1/btc/main/txs/${tx_hash}?includeHex=true`,
    Testnet: `https://api.blockcypher.com/v1/btc/test3/txs/${tx_hash}?includeHex=true`,
    BlockCypher: `https://api.blockcypher.com/v1/bcy/test/txs/${tx_hash}?includeHex=true`,
  };

  return axios
    .get<BtcTransactionDataHexIncluded>(apiUrl[network], {
      headers: { 'Access-Control-Allow-Origin': '*' },
    })
    .then((response) => {
      console.log('xverse-core/btc.ts/fetchBtcTransactionData | BtcTransactionData: ', response);
      const rawTx = response.data.hex;
      return rawTx;
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

export async function fetchPendingOrdinalsTransactions(
  ordinalsAddress: string,
  network: NetworkType
): Promise<BtcAddressMempool[]> {
  const apiUrlMainnet = `https://blockstream.info/api/address/${ordinalsAddress}/txs/mempool`;
  const apiUrlMainnetTestnet = `https://blockstream.info/testnet/api/address/${ordinalsAddress}/txs/mempool`;
  let apiUrl = apiUrlMainnet;
  if (network === 'Testnet') {
    apiUrl = apiUrlMainnetTestnet;
  }
  const response = await axios.get<BtcAddressMempool[]>(apiUrl);
  return response.data;
}
