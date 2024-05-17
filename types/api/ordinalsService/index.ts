export type CreateMintOrderRequest = {
  runeName: string;
  repeats: number;
  refundAddress: string;
  destinationAddress: string;
  feeRate: number;
  appServiceFee?: number;
  appServiceFeeAddress?: string;
};

export type CreateOrderResponse = {
  orderId: string;
  fundAddress: string;
  fundAmount: number;
};

export type CreateEtchOrderRequest = {
  runeName: string;
  divisibility?: number;
  symbol?: string;
  premine?: string;
  isMintable: boolean;
  terms?: {
    amount?: string;
    cap?: string;
    heightStart?: string;
    heightEnd?: string;
    offsetStart?: string;
    offsetEnd?: string;
  };

  inscriptionDetails?: {
    contentType: string;
    contentBase64: string;
  };
  delegateInscriptionId?: string;

  destinationAddress: string;
  refundAddress: string;
  feeRate: number;
  appServiceFee?: number;
  appServiceFeeAddress?: string;
};
