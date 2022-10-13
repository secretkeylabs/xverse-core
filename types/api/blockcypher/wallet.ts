export type BtcUtxoDataResponse = {
  tx_hash: string;
  block_height: number;
  tx_input_n: number;
  tx_output_n: number;
  value: number;
  ref_balance: number;
  spent: boolean;
  confirmations: number;
  confirmed: string;
  double_spend: boolean;
  double_spend_tx: string;
};

export type BtcAddressDataResponse = {
  address: string;
  total_received: number;
  total_sent: number;
  balance: number;
  unconfirmed_balance: number;
  final_balance: number;
  n_tx: number;
  unconfirmed_n_tx: number;
  final_n_tx: number;
  txrefs: Array<BtcUtxoDataResponse>;
};


export interface BtcTransactionBroadcastResponse {
  tx: {
    hash: string;
    addresses: Array<string>;
    total: number;
    fees: number;
    size: number;
    vsize: number;
    preference: string;
    received: string;
  };
}

export interface BtcBalance {
  balance: number;
}