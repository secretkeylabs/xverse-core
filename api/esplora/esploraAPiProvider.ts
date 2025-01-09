import axios, { AxiosInstance, AxiosRequestConfig } from 'axios';
import axiosRetry from 'axios-retry';
import {
  XVERSE_BTC_BASE_URI_MAINNET,
  XVERSE_BTC_BASE_URI_REGTEST,
  XVERSE_BTC_BASE_URI_SIGNET,
  XVERSE_BTC_BASE_URI_TESTNET,
  XVERSE_BTC_BASE_URI_TESTNET4,
} from '../../constant';
import {
  Address,
  BtcAddressBalanceResponse,
  BtcAddressMempool,
  BtcTransactionBroadcastResponse,
  EsploraTransaction,
  NetworkType,
  TransactionOutspend,
  UTXO,
} from '../../types';
import { AxiosRateLimit } from '../../utils/axiosRateLimit';

export interface EsploraApiProviderOptions {
  network: NetworkType;
  url?: string;
  fallbackUrl?: string;
}

export class BitcoinEsploraApiProvider {
  bitcoinApi: AxiosInstance;

  rateLimiter: AxiosRateLimit;

  fallbackBitcoinApi?: AxiosInstance;

  fallbackRateLimiter?: AxiosRateLimit;

  _network: NetworkType;

  constructor(options: EsploraApiProviderOptions) {
    const { url, network, fallbackUrl } = options;
    let baseURL = url;

    if (!baseURL) {
      switch (network) {
        case 'Mainnet':
          baseURL = XVERSE_BTC_BASE_URI_MAINNET;
          break;
        case 'Testnet':
          baseURL = XVERSE_BTC_BASE_URI_TESTNET;
          break;
        case 'Testnet4':
          baseURL = XVERSE_BTC_BASE_URI_TESTNET4;
          break;
        case 'Signet':
          baseURL = XVERSE_BTC_BASE_URI_SIGNET;
          break;
        case 'Regtest':
          baseURL = XVERSE_BTC_BASE_URI_REGTEST;
          break;
        default:
          throw new Error('Invalid network');
      }
    }
    const axiosConfig: AxiosRequestConfig = { baseURL };

    this._network = network;
    this.bitcoinApi = axios.create(axiosConfig);

    this.rateLimiter = new AxiosRateLimit(this.bitcoinApi, {
      maxRPS: 10,
    });

    axiosRetry(this.bitcoinApi, {
      retries: 1,
      retryDelay: axiosRetry.exponentialDelay,
      retryCondition: (error) => {
        if (error?.response?.status === 429 || (error?.response?.status ?? 0) >= 500) {
          return true;
        }
        return false;
      },
    });

    if (fallbackUrl) {
      this.fallbackBitcoinApi = axios.create({ ...axiosConfig, baseURL: fallbackUrl });

      this.fallbackRateLimiter = new AxiosRateLimit(this.fallbackBitcoinApi, {
        maxRPS: 10,
      });

      this.bitcoinApi.interceptors.response.use(
        // if the request succeeds, we do nothing.
        (response) => response,
        (error) => {
          if (!this.fallbackBitcoinApi) {
            return Promise.reject(error);
          }

          const requestTimedOut = error?.code === 'ECONNABORTED';
          const serverError = error?.response?.status >= 500;
          const addressHasTooManyUtxos =
            error?.response?.status === 400 &&
            typeof error.response.data === 'string' &&
            error.response.data.includes('Too many unspent transaction outputs');
          const rateLimitError = error?.response?.status === 429;

          if (requestTimedOut || serverError || addressHasTooManyUtxos || rateLimitError) {
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

  private async httpGet<T>(
    url: string,
    params: unknown = {},
    reqConfig: Omit<AxiosRequestConfig, 'params'> = {},
  ): Promise<T> {
    const response = await this.bitcoinApi.get<T>(url, { ...reqConfig, params });
    return response.data;
  }

  private async httpPost<T>(url: string, data: unknown): Promise<T> {
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

  async getUnspentUtxos(address: string): Promise<(UTXO & { address: string; blockHeight?: number })[]> {
    const data = await this.httpGet<UTXO[]>(`/address/${address}/utxo`);

    const utxoSets = data.map((utxo) => ({
      ...utxo,
      address,
      blockHeight: utxo.status.block_height,
    }));

    return utxoSets;
  }

  async _getAddressTransactionCount(address: string) {
    const data = await this.httpGet<Address>(`/address/${address}`);
    return data.chain_stats.tx_count + data.mempool_stats.tx_count;
  }

  async getAddressTransactions(address: string): Promise<EsploraTransaction[]> {
    return this.httpGet<EsploraTransaction[]>(`/address/${address}/txs`);
  }

  async getTransaction(txid: string): Promise<EsploraTransaction> {
    // TODO: 404 return undefined
    return this.httpGet<EsploraTransaction>(`/tx/${txid}`);
  }

  async getTransactionHex(txid: string): Promise<string | undefined> {
    const response = await this.bitcoinApi.get<string>(`/tx/${txid}/hex`, {
      validateStatus: (status) => status >= 200 && (status < 300 || status === 404),
    });
    if (response.status === 404) return undefined;
    return response.data;
  }

  async getAddressMempoolTransactions(address: string): Promise<BtcAddressMempool[]> {
    return this.httpGet<BtcAddressMempool[]>(`/address/${address}/txs/mempool`);
  }

  async sendRawTransaction(rawTransaction: string): Promise<BtcTransactionBroadcastResponse> {
    const data = await this.httpPost<string>('/tx', rawTransaction);
    return {
      tx: {
        hash: data,
      },
    };
  }

  async getTransactionOutspends(txid: string): Promise<TransactionOutspend[] | undefined> {
    const response = await this.bitcoinApi.get<TransactionOutspend[]>(`/tx/${txid}/outspends`, {
      validateStatus: (status) => status >= 200 && (status < 300 || status === 404),
    });
    if (response.status === 404) return undefined;
    return response.data;
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
