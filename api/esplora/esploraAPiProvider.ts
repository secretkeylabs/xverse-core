import axios, { AxiosInstance, AxiosRequestConfig } from 'axios';
import {
  BtcAddressBalanceResponse,
  BtcTransactionBroadcastResponse,
} from '../../types/api/blockcypher/wallet';
import { BTC_BASE_URI_MAINNET, BTC_BASE_URI_TESTNET } from '../../constant';
import { NetworkType } from '../../types/network';
import * as esplora from '../../types/api/esplora';
import { BitcoinApiProvider } from './types';

export class ApiInstance {
  bitcoinApi: AxiosInstance;

  constructor(config: AxiosRequestConfig) {
    this.bitcoinApi = axios.create(config);
  }

  async httpGet(url: string, params: any = {}): Promise<any> {
    try {
      const response = await this.bitcoinApi.get(url, { params });
      return response.data;
    } catch (e) {
      return e.toJSON();
    }
  }

  async httpPost(url: string, data: any): Promise<any> {
    try {
      const response = await this.bitcoinApi.post(url, data);
      return response.data;
    } catch (e) {
      return e.toJSON();
    }
  }
}

export interface EsploraApiProviderOptions {
  network: NetworkType;
  url?: string;
}

export default class BitcoinEsploraApiProvider extends ApiInstance implements BitcoinApiProvider {
  _network: NetworkType;

  constructor(options: EsploraApiProviderOptions) {
    const { url, network } = options;
    super({
      baseURL: url || network == 'Mainnet' ? BTC_BASE_URI_MAINNET : BTC_BASE_URI_TESTNET,
    });
    this._network = network;
  }

  async getBalance(address: string) {
    const data: BtcAddressBalanceResponse = await this.httpGet(`/address/${address}`);
    const { chain_stats: chainStats, mempool_stats: mempoolStats } = data;
    const finalBalance = chainStats.funded_txo_sum - chainStats.spent_txo_sum;
    const unconfirmedBalance = mempoolStats.funded_txo_sum - mempoolStats.spent_txo_sum;
    return {
      address,
      finalBalance,
      finalNTx: chainStats.tx_count,
      totalReceived: chainStats.funded_txo_sum,
      totalSent: chainStats.spent_txo_sum,
      unconfirmedTx: mempoolStats.tx_count,
      unconfirmedBalance,
    };
  }

  async _getUnspentTransactions(address: string): Promise<esplora.UTXO[]> {
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

  async getAddressMempoolTransactions(address: string): Promise<esplora.BtcAddressMempool[]> {
    return this.httpGet(`/address/${address}/txs/mempool`);
  }

  async sendRawTransaction(rawTransaction: string): Promise<BtcTransactionBroadcastResponse> {
    const data: string = await this.httpPost('/tx', rawTransaction);
    return {
      tx: {
        hash: data,
      },
    };
  }

  async getLatestBlockHeight(): Promise<number> {
    const data: number = await this.httpGet('/blocks/tip/height');
    return data;
  }
}
