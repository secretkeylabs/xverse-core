import { NetworkType } from 'types/network';

export type InscriptionCostEstimateRequest = {
  revealAddress: string;
  feeRate: number;
  inscriptionValue: number;
  contentLength: number;
  contentType: string;
};

export type InscriptionCostEstimateResponse = {
  inscriptionValue: number;
  chainFee: number;
  serviceFee: number;
  vSize: number;
};

type InscriptionCreateOrderBaseRequest = {
  feeRate: number;
  revealAddress: string;
  network: NetworkType;
  inscriptionValue?: number;
  contentType: string;
};

type InscriptionCreateTextOrderRequest = InscriptionCreateOrderBaseRequest & {
  contentString: string;
};

type InscriptionCreateBinaryOrderRequest = InscriptionCreateOrderBaseRequest & {
  contentBase64: string;
};

export type InscriptionCreateOrderRequest = InscriptionCreateTextOrderRequest | InscriptionCreateBinaryOrderRequest;

export type InscriptionCreateOrderResponse = {
  commitAddress: string;
  commitValue: number;
  commitValueBreakdown: {
    inscriptionValue: number;
    chainFee: number;
    serviceFee: number;
  };
};

export type InscriptionExecuteOrderRequest = {
  commitAddress: string;
  commitTransactionHex: string;
};

export type InscriptionExecuteOrderResponse = {
  revealTransactionId: string;
  revealUTXOVOut: number;
  revealUTXOValue: number;
};
