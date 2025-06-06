import axios, { AxiosInstance, CancelToken } from 'axios';
import { getXClientVersion } from '../utils/xClientVersion';
import {
  Brc20CostEstimateRequest,
  Brc20CostEstimateResponse,
  Brc20CreateOrderRequest,
  Brc20CreateOrderResponse,
  Brc20ExecuteOrderRequest,
  Brc20ExecuteOrderResponse,
  Brc20FinalizeTransferOrderRequest,
  Brc20FinalizeTransferOrderResponse,
  InscriptionCostEstimateRequest,
  InscriptionCostEstimateResponse,
  InscriptionCreateOrderRequest,
  InscriptionCreateOrderResponse,
  InscriptionExecuteOrderRequest,
  InscriptionExecuteOrderResponse,
  NetworkType,
} from '../types';
import { XVERSE_INSCRIBE_URL } from '../constant';

// TODO create a provider class
const apiClients: Partial<Record<NetworkType, AxiosInstance>> = {};

const getXverseInscribeClient = (network: NetworkType): AxiosInstance => {
  if (!apiClients[network]) {
    apiClients[network] = axios.create({
      baseURL: XVERSE_INSCRIBE_URL(network),
      headers: {
        'X-Client-Version': getXClientVersion() || undefined,
      },
    });
  }
  return apiClients[network] as AxiosInstance;
};

const getInscriptionFeeEstimate = async (
  network: NetworkType,
  requestBody: InscriptionCostEstimateRequest,
): Promise<InscriptionCostEstimateResponse> => {
  const response = await getXverseInscribeClient(network).post<InscriptionCostEstimateResponse>(
    '/v2/inscriptions/cost-estimate',
    requestBody,
  );
  return response.data;
};

const createInscriptionOrder = async (
  network: NetworkType,
  requestBody: InscriptionCreateOrderRequest,
): Promise<InscriptionCreateOrderResponse> => {
  const response = await getXverseInscribeClient(network).post<InscriptionCreateOrderResponse>(
    '/v2/inscriptions/place-order',
    requestBody,
  );
  return response.data;
};
const executeInscriptionOrder = async (
  network: NetworkType,
  requestBody: InscriptionExecuteOrderRequest,
): Promise<InscriptionExecuteOrderResponse> => {
  const response = await getXverseInscribeClient(network).post<InscriptionExecuteOrderResponse>(
    '/v2/inscriptions/execute-order',
    requestBody,
  );
  return response.data;
};

const getBrc20TransferFees = async (
  tick: string,
  amount: number,
  revealAddress: string,
  feeRate: number,
  network: NetworkType,
  inscriptionValue?: number,
  cancelToken?: CancelToken,
): Promise<Brc20CostEstimateResponse> => {
  const requestBody: Brc20CostEstimateRequest = {
    operation: 'transfer',
    tick,
    amount,
    revealAddress,
    feeRate,
    inscriptionValue,
  };
  const response = await getXverseInscribeClient(network).post<Brc20CostEstimateResponse>(
    '/v1/brc20/cost-estimate',
    requestBody,
    {
      cancelToken,
    },
  );
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
  const response = await getXverseInscribeClient(network).post<Brc20CreateOrderResponse>(
    '/v1/brc20/place-order',
    requestBody,
  );
  return response.data;
};

const getBrc20MintFees = async (
  tick: string,
  amount: number,
  revealAddress: string,
  feeRate: number,
  network: NetworkType,
  inscriptionValue?: number,
  cancelToken?: CancelToken,
): Promise<Brc20CostEstimateResponse> => {
  const requestBody: Brc20CostEstimateRequest = {
    operation: 'mint',
    tick,
    amount,
    revealAddress,
    feeRate,
    inscriptionValue,
  };
  const response = await getXverseInscribeClient(network).post<Brc20CostEstimateResponse>(
    '/v1/brc20/cost-estimate',
    requestBody,
    {
      cancelToken: cancelToken,
    },
  );
  return response.data;
};

const createBrc20MintOrder = async (
  tick: string,
  amount: number,
  revealAddress: string,
  feeRate: number,
  network: NetworkType,
  inscriptionValue?: number,
): Promise<Brc20CreateOrderResponse> => {
  const requestBody: Brc20CreateOrderRequest = {
    operation: 'mint',
    tick,
    amount,
    revealAddress,
    feeRate,
    network,
    inscriptionValue,
  };
  const response = await getXverseInscribeClient(network).post<Brc20CreateOrderResponse>(
    '/v1/brc20/place-order',
    requestBody,
  );
  return response.data;
};

const getBrc20DeployFees = async (
  tick: string,
  max: number,
  limit: number,
  revealAddress: string,
  feeRate: number,
  network: NetworkType,
  inscriptionValue?: number,
): Promise<Brc20CostEstimateResponse> => {
  const requestBody: Brc20CostEstimateRequest = {
    operation: 'deploy',
    tick,
    lim: limit,
    max: max,
    revealAddress,
    feeRate,
    inscriptionValue,
  };
  const response = await getXverseInscribeClient(network).post<Brc20CostEstimateResponse>(
    '/v1/brc20/cost-estimate',
    requestBody,
  );
  return response.data;
};

const createBrc20DeployOrder = async (
  tick: string,
  max: number,
  limit: number,
  revealAddress: string,
  feeRate: number,
  network: NetworkType,
  inscriptionValue?: number,
): Promise<Brc20CreateOrderResponse> => {
  const requestBody: Brc20CreateOrderRequest = {
    operation: 'deploy',
    tick,
    lim: limit,
    max: max,
    revealAddress,
    feeRate,
    network,
    inscriptionValue,
  };
  const response = await getXverseInscribeClient(network).post<Brc20CreateOrderResponse>(
    '/v1/brc20/place-order',
    requestBody,
  );
  return response.data;
};

const executeBrc20Order = async (
  network: NetworkType,
  commitAddress: string,
  commitTransactionHex: string,
  skipFinalize?: boolean,
): Promise<Brc20ExecuteOrderResponse> => {
  const requestBody: Brc20ExecuteOrderRequest = {
    commitAddress,
    commitTransactionHex,
    skipFinalize,
  };
  const response = await getXverseInscribeClient(network).post<Brc20ExecuteOrderResponse>(
    '/v1/brc20/execute-order',
    requestBody,
  );
  return response.data;
};

const finalizeBrc20TransferOrder = async (
  network: NetworkType,
  commitAddress: string,
  transferTransactionHex: string,
): Promise<Brc20FinalizeTransferOrderResponse> => {
  const requestBody: Brc20FinalizeTransferOrderRequest = {
    commitAddress,
    transferTransactionHex,
  };
  const response = await getXverseInscribeClient(network).post<Brc20FinalizeTransferOrderResponse>(
    '/v1/brc20/finalize-order',
    requestBody,
  );
  return response.data;
};

export default {
  getInscriptionFeeEstimate,
  createInscriptionOrder,
  executeInscriptionOrder,
  getBrc20TransferFees,
  createBrc20TransferOrder,
  getBrc20MintFees,
  createBrc20MintOrder,
  getBrc20DeployFees,
  createBrc20DeployOrder,
  executeBrc20Order,
  finalizeBrc20TransferOrder,
};
