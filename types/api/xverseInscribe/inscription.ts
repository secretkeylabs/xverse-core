export type InscriptionCostEstimateRequest = {
  revealAddress: string;
  feeRate: number;
  inscriptionValue: number;
  contentLength: number;
  contentType?: string;
  repetitions?: number;
};

export type InscriptionCostEstimateResponse = {
  totalInscriptionValue: number;
  inscriptionValue: number;
  chainFee: number;
  serviceFee: number;
  vSize: number;
};

type InscriptionCreateOrderBaseRequest = {
  feeRate: number;
  revealAddress: string;
  inscriptionValue?: number;
  contentType?: string;
  repetitions?: number;
  appServiceFee?: number;
  appServiceFeeAddress?: string;
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
    totalInscriptionValue: number;
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
