import {
  NetworkType,
  BtcUtxoDataResponse,
  BtcAddressDataResponse,
  BtcTransactionBroadcastResponse,
  BtcBalance,
} from 'types';
import axios from 'axios';
import { BtcAddressData } from 'types/api/blockcypher/wallet';
import { BtcTransactionsDataResponse } from 'types/api/blockcypher/wallet';
import { BtcTransactionData } from 'types/api/blockcypher/wallet';
import { parseBtcTransactionData } from './helper';

export async function fetchBtcTransactionData(
  tx_hash: string,
  network: NetworkType
): Promise<string> {
  const apiUrl = {
    Mainnet: `https://api.blockcypher.com/v1/btc/main/txs/${tx_hash}?includeHex=true`,
    Testnet: `https://api.blockcypher.com/v1/btc/test3/txs/${tx_hash}?includeHex=true`,
    BlockCypher: `https://api.blockcypher.com/v1/bcy/test/txs/${tx_hash}?includeHex=true`,
  };
  console.log('xverse-core/btc.ts/fetchBtcTransactionData | tx_hash: ', tx_hash);
  console.log('xverse-core/btc.ts/fetchBtcTransactionData | network: ', network);
  console.log('xverse-core/btc.ts/fetchBtcTransactionData | url: ', apiUrl[network])

  return axios
    .get<BtcTransactionData>(apiUrl[network], { headers: { 'Access-Control-Allow-Origin': '*' } })
    .then((response) => {
      console.log('xverse-core/btc.ts/fetchBtcTransactionData | BtcTransactionData: ', response);
      const rawTx: string = response.data.hex;
      return rawTx;
    });
}

export async function fetchBtcAddressUnspent(
  btcAddress: string,
  network: NetworkType
): Promise<Array<BtcUtxoDataResponse>> {
  const apiUrl = {
    Mainnet: `https://api.blockcypher.com/v1/btc/main/addrs/${btcAddress}?unspentOnly=true&limit=50`,
    Testnet: `https://api.blockcypher.com/v1/btc/test3/addrs/${btcAddress}?unspentOnly=true&limit=50`,
    BlockCypher: `https://api.blockcypher.com/v1/bcy/test/assrs/${btcAddress}?unspentOnly=true&limit=50`,
  };

  return axios.get<BtcAddressDataResponse>(apiUrl[network], { timeout: 45000 }).then((response) => {
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
  const apiUrl = {
    Mainnet: `https://api.blockcypher.com/v1/btc/main/addrs/${btcAddress}`,
    Testnet: `https://api.blockcypher.com/v1/btc/test3/addrs/${btcAddress}`,
    BlockCypher: `https://api.blockcypher.com/v1/bcy/test/addrs/${btcAddress}`,
  };

  return axios
    .get<BtcAddressDataResponse>(apiUrl[network], {
      headers: { 'Access-Control-Allow-Origin': '*' },
    })
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
  const apiUrl = {
    Mainnet: 'https://api.blockcypher.com/v1/btc/main/txs/push',
    Testnet: 'https://api.blockcypher.com/v1/btc/test3/txs/push',
    BlockCypher: 'https://api.blockcypher.com/v1/bcy/test/txs/push',
  };

  const data = {
    tx: rawTx,
  };
  console.log('BTCTRANSACTION DATA: ', data)
  return axios
    .post<BtcTransactionBroadcastResponse>(apiUrl[network], data, { timeout: 45000 })
    .then((response) => {
      return response.data;
    });
}

export async function fetchBtcTransactionsData(
  btcAddress: string,
  network: NetworkType
): Promise<BtcAddressData> {
  const apiUrl = {
    Mainnet: `https://api.blockcypher.com/v1/btc/main/addrs/${btcAddress}/full?includeHex=true&txlimit=3000&limit=50`,
    Testnet: `https://api.blockcypher.com/v1/btc/test3/addrs/${btcAddress}/full?includeHex=true&txlimit=3000&limit=50`,
    BlockCypher: `https://api.blockcypher.com/v1/bcy/test/addrs/${btcAddress}/full?includeHex=true&txlimit=3000&limit=50`,
  };

  return axios
    .get<BtcTransactionsDataResponse>(apiUrl[network], { timeout: 45000 })
    .then((response) => {
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
