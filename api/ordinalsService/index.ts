import { ORDINALS_SERVICE_BASE_URL } from '../../constant';
import { NetworkType } from '../../types';
import { CreateEtchOrderRequest, CreateMintOrderRequest, CreateOrderResponse } from '../../types/api/ordinalsService';

import axios, { AxiosInstance } from 'axios';

export class OrdinalsServiceApi {
  client: AxiosInstance;

  constructor(network?: NetworkType) {
    this.client = axios.create({
      baseURL: ORDINALS_SERVICE_BASE_URL(network),
    });
  }

  createMintOrder = async (mintOrderParams: CreateMintOrderRequest) => {
    const response = await this.client.post<CreateOrderResponse>('/runes/mint/orders', {
      ...mintOrderParams,
    });
    return response.data;
  };

  createEtchOrder = async (etchOrderParams: CreateEtchOrderRequest) => {
    const response = await this.client.post<CreateOrderResponse>('/runes/etch/orders', {
      ...etchOrderParams,
    });
    return response.data;
  };

  executeMint = async (orderId: string, fundTransactionId: string) => {
    const response = await this.client.post(`/runes/mint/orders/${orderId}/execute`, {
      fundTransactionId,
    });
    return response.data;
  };

  executeEtch = async (orderId: string, fundTransactionId: string) => {
    const response = await this.client.post(`/runes/etch/orders/${orderId}/execute`, {
      fundTransactionId,
    });
    return response.data;
  };
}

const testnetClient = new OrdinalsServiceApi('Testnet');
const mainnetClient = new OrdinalsServiceApi('Mainnet');

export const getOrdinalsServiceApiClient = (network: NetworkType = 'Mainnet') =>
  network === 'Mainnet' ? mainnetClient : testnetClient;

export * from './config';
