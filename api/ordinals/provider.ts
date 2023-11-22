import axios, { AxiosError, AxiosInstance, AxiosRequestConfig, Method } from 'axios';
import { HIRO_MAINNET_DEFAULT, HIRO_TESTNET_DEFAULT, XORD_URL } from '../../constant';
import * as ordinalsType from '../../types/api/ordinals';
import { NetworkType } from '../../types/network';
import { OrdinalsApiProvider } from './types';

export interface OrdinalsApiProviderOptions {
  network: NetworkType;
  url?: string;
}

const API_PREFIX = '/ordinals/v1/';

// if we fallback to hiro, we'll use it at maximum this many times before trying the other API
const MAX_FALLBACK_CALLS = 10;

export default class OrdinalsApi implements OrdinalsApiProvider {
  private network: NetworkType;

  private customClient?: AxiosInstance;

  private hiroClient!: AxiosInstance;

  private xordClient?: AxiosInstance;

  private fallbackCalls = 0;

  constructor(options: OrdinalsApiProviderOptions) {
    const { url, network } = options;
    this.network = network;

    if (url) {
      this.customClient = axios.create({
        baseURL: `${url}${API_PREFIX}`,
      });
    }

    this.xordClient = axios.create({
      baseURL: `${XORD_URL(network)}/v1`,
    });

    this.hiroClient = axios.create({
      baseURL: `${network == 'Mainnet' ? HIRO_MAINNET_DEFAULT : HIRO_TESTNET_DEFAULT}${API_PREFIX}`,
    });
  }

  private canFallback(): boolean {
    return !this.customClient && !!this.xordClient;
  }

  private shouldFallback(fallback = false): boolean {
    if (!this.canFallback()) return false;

    const shouldFallback = fallback || (this.fallbackCalls > 0 && this.fallbackCalls <= MAX_FALLBACK_CALLS);

    if (!shouldFallback) {
      this.fallbackCalls = 0;
    } else {
      this.fallbackCalls += 1;
    }

    return shouldFallback;
  }

  private getClient(shouldFallback: boolean): AxiosInstance {
    if (this.customClient) return this.customClient;

    if (!this.xordClient || shouldFallback) return this.hiroClient;

    return this.xordClient;
  }

  private async httpCall<T>(
    method: Method,
    url: string,
    reqConfig?: Omit<AxiosRequestConfig, 'url' | 'baseUrl' | 'method'>,
  ): Promise<T> {
    let shouldFallback = this.shouldFallback();

    let client = this.getClient(shouldFallback);
    const callParams = {
      method,
      url,
      ...reqConfig,
    };

    try {
      const response = await client.request<T>(callParams);

      return response.data;
    } catch (err) {
      const error = err as AxiosError;

      if ((shouldFallback || error.response?.status) ?? 0 < 500) {
        // we have already fallen back or the error is not server related
        throw error;
      }

      shouldFallback = this.shouldFallback(true);

      if (!shouldFallback) {
        // we cannot fallback
        throw error;
      }

      client = this.getClient(shouldFallback);

      const response = await client.request<T>(callParams);

      return response.data;
    }
  }

  async getAllInscriptions(address: string): Promise<ordinalsType.Inscription[]> {
    const firstPage = await this.getInscriptions(address, 0, 100);
    const results = [...firstPage.results];

    // we do this sequentially to avoid rate limiting
    while (results.length < firstPage.total) {
      const nextPage = await this.getInscriptions(address, results.length, firstPage.limit);
      results.push(...nextPage.results);
    }

    return results;
  }

  async getInscriptions(address: string, offset: number, limit: number): Promise<ordinalsType.InscriptionsList> {
    const url = 'inscriptions';
    const params = {
      address,
      offset,
      limit,
    };

    const data = await this.httpCall<ordinalsType.InscriptionsList>('get', url, { params });

    return data;
  }

  async getInscription(inscriptionId: string): Promise<ordinalsType.Inscription> {
    const url = `inscriptions/${inscriptionId}`;
    const inscription = await this.httpCall<ordinalsType.Inscription>('get', url);
    return inscription;
  }
}
