import axios from 'axios';

import {
  Brc20CostEstimateRequest,
  Brc20CostEstimateResponse,
  Brc20CreateOrderRequest,
  Brc20CreateOrderResponse,
  Brc20ExecuteOrderRequest,
  Brc20ExecuteOrderResponse,
  NetworkType,
} from 'types';

import { XVERSE_INSCRIBE_URL } from '../constant';

const apiClient = axios.create({
  baseURL: XVERSE_INSCRIBE_URL,
});

const getBrc20TransferFees = async (
  tick: string,
  amount: number,
  revealAddress: string,
  feeRate: number,
  inscriptionValue?: number,
): Promise<Brc20CostEstimateResponse> => {
  const requestBody: Brc20CostEstimateRequest = {
    operation: 'transfer',
    tick,
    amount,
    revealAddress,
    feeRate,
    inscriptionValue,
  };
  const response = await apiClient.post<Brc20CostEstimateResponse>('/v1/brc20/cost-estimate', requestBody);
  return response.data;
};

const createBrc20TransferOrder = async (
  tick: string,
  amount: number,
  revealAddress: string,
  feeRate: number,
  network: NetworkType,
  inscriptionValue?: number,
): Promise<Brc20CreateOrderResponse> => {
  const requestBody: Brc20CreateOrderRequest = {
    operation: 'transfer',
    tick,
    amount,
    revealAddress,
    feeRate,
    network,
    inscriptionValue,
  };
  const response = await apiClient.post<Brc20CreateOrderResponse>('/v1/brc20/cost-estimate', requestBody);
  return response.data;
};

const executeBrc20TransferOrder = async (
  commitAddress: string,
  commitTransactionHex: string,
): Promise<Brc20ExecuteOrderResponse> => {
  const requestBody: Brc20ExecuteOrderRequest = {
    commitAddress,
    commitTransactionHex,
  };
  const response = await apiClient.post<Brc20ExecuteOrderResponse>('/v1/brc20/cost-estimate', requestBody);
  return response.data;
};

export default {
  getBrc20TransferFees,
  createBrc20TransferOrder,
  executeBrc20TransferOrder,
};