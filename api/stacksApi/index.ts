import axios, { AxiosInstance, AxiosRequestConfig } from 'axios';
import { API_TIMEOUT_MILLI, HIRO_MAINNET_DEFAULT, HIRO_TESTNET_DEFAULT } from '../../constant';
import { StacksNetwork } from '../../types';
import {
  AccountDataResponse,
  AddressTransaction,
  AddressTransactionsV2ListResponse,
  MempoolTransaction,
  MempoolTransactionListResponse,
  Transaction,
} from '@stacks/stacks-blockchain-api-types';
import BigNumber from 'bignumber.js';

export interface StacksApiProviderOptions {
  network: StacksNetwork;
}

export class StacksApiProvider {
  StacksApi: AxiosInstance;

  _network: StacksNetwork;

  constructor(options: StacksApiProviderOptions) {
    const { network } = options;
    let baseURL = network.coreApiUrl;

    if (!baseURL) {
      if (!network.isMainnet()) {
        baseURL = HIRO_TESTNET_DEFAULT;
      }
      baseURL = HIRO_MAINNET_DEFAULT;
    }
    const axiosConfig: AxiosRequestConfig = { baseURL, timeout: API_TIMEOUT_MILLI };

    this._network = network;
    this.StacksApi = axios.create(axiosConfig);
  }

  private async httpGet<T>(
    url: string,
    params: unknown = {},
    reqConfig: Omit<AxiosRequestConfig, 'params'> = {},
  ): Promise<T> {
    const response = await this.StacksApi.get<T>(url, { ...reqConfig, params });
    return response.data;
  }

  private async httpPost<T>(url: string, data: unknown): Promise<T> {
    const response = await this.StacksApi.post(url, data);
    return response.data;
  }

  getAddressBalance = async (stxAddress: string) => {
    const apiUrl = `/v2/accounts/${stxAddress}?proof=0`;
    const response = await this.httpGet<AccountDataResponse>(apiUrl);
    const availableBalance = new BigNumber(response.balance);
    const lockedBalance = new BigNumber(response.locked);
    return {
      availableBalance,
      lockedBalance,
      totalBalance: availableBalance.plus(lockedBalance),
      nonce: response.nonce,
    };
  };

  getAddressTransactions = async ({
    stxAddress,
    offset,
    limit,
  }: {
    stxAddress: string;
    offset?: number;
    limit?: number;
  }): Promise<{
    list: AddressTransaction[];
    total: number;
  }> => {
    const apiUrl = `/extended/v2/address/${stxAddress}/transactions`;

    const response = await this.httpGet<AddressTransactionsV2ListResponse>(apiUrl, {
      params: {
        limit,
        offset,
      },
    });

    return {
      list: response.results,
      total: response.total,
    };
  };

  getAddressMempoolTransactions = async ({
    stxAddress,
    offset,
    limit,
  }: {
    stxAddress: string;
    network: StacksNetwork;
    offset: number;
    limit: number;
  }): Promise<{
    list: MempoolTransaction[];
    total: number;
  }> => {
    const apiUrl = `/extended/v1/tx/mempool?address=${stxAddress}`;

    const response = await this.httpGet<MempoolTransactionListResponse>(apiUrl, {
      params: {
        limit: limit,
        offset: offset,
      },
    });

    return {
      list: response.results,
      total: response.total,
    };
  };

  getTransaction = async (txid: string): Promise<Transaction> => {
    const response = await this.httpGet<Transaction>(`/extended/v1/tx/${txid}`, {
      method: 'GET',
    });
    return response;
  };
}

export default StacksApiProvider;
