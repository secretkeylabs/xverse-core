import axios, { AxiosInstance, AxiosRequestConfig } from 'axios';
import { BTC_BASE_URI_MAINNET, BTC_BASE_URI_TESTNET } from '../../constant';
import { RecommendedFeeResponse } from '../../types';
import { BtcAddressBalanceResponse, BtcTransactionBroadcastResponse } from '../../types/api/blockcypher/wallet';
import * as esplora from '../../types/api/esplora';
import { NetworkType } from '../../types/network';
import { BitcoinApiProvider } from './types';

export interface EsploraApiProviderOptions {
  network: NetworkType;
  url?: string;
  fallbackUrl?: string;
}

export class BitcoinEsploraApiProvider implements BitcoinApiProvider {
  bitcoinApi: AxiosInstance;

  fallbackBitcoinApi?: AxiosInstance;

  _network: NetworkType;

  constructor(options: EsploraApiProviderOptions) {
    const { url, network, fallbackUrl } = options;
    const baseURL = url || (network === 'Mainnet' ? BTC_BASE_URI_MAINNET : BTC_BASE_URI_TESTNET);
    const axiosConfig: AxiosRequestConfig = { baseURL };

    this._network = network;
    this.bitcoinApi = axios.create(axiosConfig);

    if (fallbackUrl) {
      this.fallbackBitcoinApi = axios.create({ ...axiosConfig, baseURL: fallbackUrl });
      this.bitcoinApi.interceptors.response.use(
        // if the request succeeds, we do nothing.
        (response) => response,
        (error) => {
          if (!this.fallbackBitcoinApi) {
            return Promise.reject(error);
          }

          // if the request times out, we retry on the fallbackBitcoinApi
          if (error?.code === 'ECONNABORTED') {
            return this.fallbackBitcoinApi.request({
              ...error.config,
              baseURL: fallbackUrl,
            });
          }

          // if an address has > 500 UTXOs, mempool.space returns a 400 error,
          // so we retry on the fallbackBitcoinApi
          if (error?.response?.status >= 400) {
            return this.fallbackBitcoinApi.request({
              ...error.config,
              baseURL: fallbackUrl,
            });
          }
          return Promise.reject(error);
        },
      );
    }
  }

  async httpGet<T = any>(url: string, params: any = {}): Promise<T> {
    const response = await this.bitcoinApi.get<T>(url, { params });
    return response.data;
  }

  async httpPost<T = any>(url: string, data: any): Promise<T> {
    const response = await this.bitcoinApi.post(url, data);
    return response.data;
  }

  async getBalance(address: string) {
    const data = await this.httpGet<BtcAddressBalanceResponse>(`/address/${address}`);
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

  async getAddressData(address: string) {
    const data = await this.httpGet<BtcAddressBalanceResponse>(`/address/${address}`);
    return data;
  }

  async getUnspentUtxos(address: string): Promise<(esplora.UTXO & { address: string; blockHeight?: number })[]> {
    const data = await this.httpGet<esplora.UTXO[]>(`/address/${address}/utxo`);

    const utxoSets = data.map((utxo) => ({
      ...utxo,
      address,
      blockHeight: utxo.status.block_height,
    }));

    return utxoSets;
  }

  async _getAddressTransactionCount(address: string) {
    const data = await this.httpGet<esplora.Address>(`/address/${address}`);
    return data.chain_stats.tx_count + data.mempool_stats.tx_count;
  }

  async getAddressTransactions(address: string): Promise<esplora.Transaction[]> {
    return this.httpGet<esplora.Transaction[]>(`/address/${address}/txs`);
  }

  async getTransaction(txid: string): Promise<esplora.Transaction> {
    return this.httpGet<esplora.Transaction>(`/tx/${txid}`);
  }

  async getTransactionHex(txid: string): Promise<string> {
    return this.httpGet<string>(`/tx/${txid}/hex`);
  }

  async getAddressMempoolTransactions(address: string): Promise<esplora.BtcAddressMempool[]> {
    return this.httpGet<esplora.BtcAddressMempool[]>(`/address/${address}/txs/mempool`);
  }

  async sendRawTransaction(rawTransaction: string): Promise<BtcTransactionBroadcastResponse> {
    const data = await this.httpPost<string>('/tx', rawTransaction);
    return {
      tx: {
        hash: data,
      },
    };
  }

  async getTransactionOutspends(txid: string): Promise<esplora.TransactionOutspend[]> {
    return this.httpGet<esplora.TransactionOutspend[]>(`/tx/${txid}/outspends`);
  }

  /**
   * @deprecated use mempoolApi.getRecommendedFees instead
   */
  async getRecommendedFees(): Promise<RecommendedFeeResponse> {
    // !Note: This is not an esplora endpoint, it is a mempool.space endpoint
    // TODO: make sure nothign is using this and remove it from here. It exists in the mempool api file.
    const { data } = await axios.get<RecommendedFeeResponse>(
      `https://mempool.space/${this._network === 'Mainnet' ? '' : 'testnet/'}api/v1/fees/recommended`,
    );
    return data;
  }

  async getLatestBlockHeight(): Promise<number> {
    const data = await this.httpGet<number>('/blocks/tip/height');
    return data;
  }

  async getBlockHash(height: number): Promise<string> {
    const data = await this.httpGet<string>(`/block-height/${height}`);
    return data;
  }
}

export default BitcoinEsploraApiProvider;
