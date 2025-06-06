import { NetworkType } from '../../../types';

type Brc20TransferOrMintRequest = {
  operation: 'transfer' | 'mint';
  tick: string;
  amount: number;
};

type Brc20DeployRequest = {
  operation: 'deploy';
  tick: string;
  max: number;
  lim: number;
};

export type Brc20CostEstimateRequest = (Brc20TransferOrMintRequest | Brc20DeployRequest) & {
  revealAddress: string;
  feeRate: number;
  inscriptionValue?: number;
};

export type Brc20CostEstimateResponse = {
  inscriptionValue: number;
  chainFee: number;
  serviceFee: number;
  vSize: number;
};

export type Brc20CreateOrderRequest = (Brc20TransferOrMintRequest | Brc20DeployRequest) & {
  revealAddress: string;
  feeRate: number;
  network: NetworkType;
  inscriptionValue?: number;
};

export type Brc20CreateOrderResponse = {
  commitAddress: string;
  commitValue: number;
  commitValueBreakdown: {
    inscriptionValue: number;
    chainFee: number;
    serviceFee: number;
  };
};

export type Brc20ExecuteOrderRequest = {
  commitAddress: string;
  commitTransactionHex: string;
  skipFinalize?: boolean;
};

export type Brc20ExecuteOrderResponse = {
  revealTransactionId: string;
  revealUTXOVOut: 0;
  revealUTXOValue: number;
};

export type Brc20FinalizeTransferOrderRequest = {
  commitAddress: string;
  transferTransactionHex: string;
};

export type Brc20FinalizeTransferOrderResponse = {
  commitTransactionId: string;
  revealTransactionId: string;
  transferTransactionId: string;
};
