import { ORDINALS_SERVICE_BASE_URL } from '../../constant';
import { NetworkType } from '../../types';
import { CreateEtchOrderRequest, CreateMintOrderRequest, CreateOrderResponse } from './types';

import axios, { AxiosError, AxiosInstance } from 'axios';

export class OrdinalsServiceApi {
  client: AxiosInstance;

  constructor(network?: NetworkType) {
    this.client = axios.create({
      baseURL: ORDINALS_SERVICE_BASE_URL(network),
    });
  }

  private parseError = (error: AxiosError) => {
    return {
      code: error.response?.status,
      message: JSON.stringify(error.response?.data),
    };
  };

  createMintOrder = async (mintOrderParams: CreateMintOrderRequest) => {
    try {
      const response = await this.client.post<CreateOrderResponse>('/runes/mint/orders', {
        ...mintOrderParams,
      });
      return {
        data: response.data,
      };
    } catch (error) {
      const err = error as AxiosError;
      return {
        error: this.parseError(err),
      };
    }
  };

  createEtchOrder = async (etchOrderParams: CreateEtchOrderRequest) => {
    try {
      const response = await this.client.post<CreateOrderResponse>('/runes/etch/orders', {
        ...etchOrderParams,
      });
      return {
        data: response.data,
      };
    } catch (error) {
      const err = error as AxiosError;
      return {
        error: this.parseError(err),
      };
    }
  };

  executeMint = async (orderId: string, fundTransactionId: string) => {
    try {
      const response = await this.client.post(`/runes/mint/orders/${orderId}/execute`, {
        fundTransactionId,
      });
      return {
        data: response.data,
      };
    } catch (error) {
      const err = error as AxiosError;
      return {
        error: this.parseError(err),
      };
    }
  };

  executeEtch = async (orderId: string, fundTransactionId: string) => {
    try {
      const response = await this.client.post(`/runes/etch/orders/${orderId}/execute`, {
        fundTransactionId,
      });
      return {
        data: response.data,
      };
    } catch (error) {
      const err = error as AxiosError;
      return {
        error: this.parseError(err),
      };
    }
  };
}

const testnetClient = new OrdinalsServiceApi('Testnet');
const mainnetClient = new OrdinalsServiceApi('Mainnet');

export const getOrdinalsServiceApiClient = (network: NetworkType = 'Mainnet') =>
  network === 'Mainnet' ? mainnetClient : testnetClient;
