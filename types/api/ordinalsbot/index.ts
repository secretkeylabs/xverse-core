export interface InscriptionRequestResponse {
  charge: {
    id: string;
    created_at: number;
    address: string;
    amount: number;
    fiat_value: number;
  };
  baseFee: number;
  chainFee: number;
  serviceFee: number;
  receiveAddress: string;
}
