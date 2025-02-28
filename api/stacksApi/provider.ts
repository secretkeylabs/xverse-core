import {
  AccountDataResponse,
  AddressBalanceResponse,
  AddressTransaction,
  AddressTransactionEventListResponse,
  AddressTransactionsV2ListResponse,
  GetRawTransactionResult,
  MempoolTransaction,
  MempoolTransactionListResponse,
  Transaction,
} from '@stacks/stacks-blockchain-api-types';
import axios, { AxiosInstance, AxiosRequestConfig } from 'axios';
import BigNumber from 'bignumber.js';
import { API_TIMEOUT_MILLI, HIRO_MAINNET_DEFAULT, HIRO_TESTNET_DEFAULT } from '../../constant';
import { NftHistoryResponse, StacksMainnet, StacksNetwork } from '../../types';
import { AxiosRateLimit } from '../../utils/axiosRateLimit';

export interface StacksApiProviderOptions {
  network: StacksNetwork;
}

const LIMIT = 100;
const OFFSET = 0;

export class StacksApiProvider {
  StacksApi: AxiosInstance;

  rateLimiter: AxiosRateLimit;

  _network: StacksNetwork;

  constructor(options: StacksApiProviderOptions) {
    const { network } = options;
    let baseURL = network.client.baseUrl;

    if (!baseURL) {
      if (!(network.chainId === StacksMainnet.chainId)) {
        baseURL = HIRO_TESTNET_DEFAULT;
      }
      baseURL = HIRO_MAINNET_DEFAULT;
    }
    const axiosConfig: AxiosRequestConfig = { baseURL, timeout: API_TIMEOUT_MILLI };

    this._network = network;
    this.StacksApi = axios.create(axiosConfig);

    // hiro has a max RPS of 50
    this.rateLimiter = new AxiosRateLimit(this.StacksApi, {
      maxRPS: 50,
    });
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
    const apiUrl = `/extended/v1/address/${stxAddress}/balances`;
    const response = await this.httpGet<AddressBalanceResponse>(apiUrl);
    const stacksBalance = response.stx;
    const balance = new BigNumber(stacksBalance.balance);
    const lockedBalance = new BigNumber(stacksBalance.locked);

    // @stacks/stacks-blockchain-api-types latest version is missing these two properties
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const unconfirmedInbound = new BigNumber((stacksBalance as any).pending_balance_inbound);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const unconfirmedOutbound = new BigNumber((stacksBalance as any).pending_balance_outbound);
    return {
      availableBalance: balance.minus(lockedBalance).minus(unconfirmedOutbound),
      lockedBalance,
      totalBalance: balance.plus(unconfirmedInbound).minus(unconfirmedOutbound),
    };
  };

  getAddressNonce = async (stxAddress: string) => {
    const apiUrl = `/v2/accounts/${stxAddress}?proof=0`;
    const response = await this.httpGet<AccountDataResponse>(apiUrl);
    return response.nonce;
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
      limit,
      offset,
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
    offset: number;
    limit: number;
  }): Promise<{
    list: MempoolTransaction[];
    total: number;
  }> => {
    const apiUrl = `/extended/v1/tx/mempool?address=${stxAddress}`;

    const response = await this.httpGet<MempoolTransactionListResponse>(apiUrl, {
      limit: limit,
      offset: offset,
    });

    return {
      list: response.results,
      total: response.total,
    };
  };

  getTransactionEvents = async ({
    txid,
    stxAddress,
    limit,
    offset,
  }: {
    txid: string;
    stxAddress: string;
    limit: number;
    offset: number;
  }): Promise<AddressTransactionEventListResponse> => {
    const apiUrl = `/extended/v2/addresses/${stxAddress}/transactions/${txid}/events`;
    const response = await this.httpGet<AddressTransactionEventListResponse>(apiUrl, {
      limit,
      offset,
    });
    return response;
  };

  getAllTransactions = async ({
    stxAddress,
    offset = OFFSET,
    limit = LIMIT,
  }: {
    stxAddress: string;
    offset: number;
    limit: number;
  }): Promise<(AddressTransaction | MempoolTransaction)[]> => {
    let allTransactions: (AddressTransaction | MempoolTransaction)[] = [];
    let hasMore = true;

    while (hasMore) {
      const [transactionsWithTransfers, mempoolTransactions] = await Promise.all([
        this.getAddressTransactions({ stxAddress, offset, limit }),
        this.getAddressMempoolTransactions({ stxAddress, limit, offset }),
      ]);

      const combinedTransactions = [...mempoolTransactions.list, ...transactionsWithTransfers.list];

      allTransactions = [...allTransactions, ...combinedTransactions];

      // Check if we received fewer transactions than the limit, indicating no more transactions
      if (combinedTransactions.length < limit) {
        hasMore = false;
      } else {
        offset += limit;
      }
    }

    return allTransactions;
  };

  getTransaction = async (txid: string): Promise<Transaction> => {
    const response = await this.httpGet<Transaction>(`/extended/v1/tx/${txid}`);
    return response;
  };

  getRawTransaction = async (txid: string): Promise<string> => {
    const response = await this.httpGet<GetRawTransactionResult>(`/extended/v1/tx/${txid}/raw`);
    return response.raw_tx;
  };

  getNftHistory = async (
    assetIdentifier: string,
    value: string,
    limit = 1,
    offset = 0,
  ): Promise<NftHistoryResponse> => {
    return this.httpGet<NftHistoryResponse>(`/extended/v1/tokens/nft/history`, {
      asset_identifier: assetIdentifier,
      value,
      limit,
      offset,
    });
  };
}

export default StacksApiProvider;
