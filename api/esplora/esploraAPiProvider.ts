import {
  BtcAddressBalanceResponse,
  BtcTransactionBroadcastResponse,
} from '../../types/api/blockcypher/wallet';
import { NetworkType } from '../../types/network';
import * as esplora from './types';
import axios, { AxiosInstance, AxiosRequestConfig } from 'axios';

export class ApiInstance {
  bitcoinApi: AxiosInstance;
  constructor(config: AxiosRequestConfig) {
    this.bitcoinApi = axios.create(config);
  }

  httpGet(url: string, params: any = {}): Promise<any> {
    return this.bitcoinApi
      .get(url, { params })
      .then((response) => response.data)
      .catch((e) => e.toJSON());
  }

  httpPost(url: string, data: any): Promise<any> {
    return this.bitcoinApi
      .post(url, data)
      .then((response) => response.data)
      .catch((e) => e.toJSON());
  }
}

export interface EsploraApiProviderOptions {
  url: string;
  network: NetworkType;
  numberOfBlockConfirmation?: number;
}

export default class BitcoinEsploraApiProvider
  extends ApiInstance
  implements esplora.BitcoinApiProvider
{
  _network: NetworkType;

  constructor(options: EsploraApiProviderOptions) {
    const { url, network, numberOfBlockConfirmation = 1 } = options;
    super({
      baseURL: url,
    });
    this._network = network;
  }

  async getBalance(address: string) {
    const data: BtcAddressBalanceResponse = await this.httpGet(`/address/${address}`);
    const { chain_stats, mempool_stats } = data;
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
  }

  async _getUnspentTransactions(address: string): Promise<bitcoin.UTXO[]> {
    const data: esplora.UTXO[] = await this.httpGet(`/address/${address}/utxo`);
    return data.map((utxo) => ({
      ...utxo,
      address,
      value: utxo.value,
      blockHeight: utxo.status.block_height,
    }));
  }

  async getUnspentUtxos(address: string): Promise<esplora.UTXO[]> {
    const utxoSets = await this._getUnspentTransactions(address);
    return utxoSets;
  }

  async _getAddressTransactionCount(address: string) {
    const data: esplora.Address = await this.httpGet(`/address/${address}`);
    return data.chain_stats.tx_count + data.mempool_stats.tx_count;
  }

  async getAddressTransactions(address: string): Promise<esplora.Transaction[]> {
    return this.httpGet(`/address/${address}/txs`);
  }

  async sendRawTransaction(rawTransaction: string): Promise<BtcTransactionBroadcastResponse> {
    const data: string = await this.httpPost('/tx', rawTransaction);
    return {
      tx: {
        hash: data,
      },
    };
  }
}
