import { UTXO } from "../esplora";
import { TransactionData } from "../xverse/transaction";

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
  unconfirmed_txrefs: Array<BtcUtxoDataResponse>;
  txrefs: Array<BtcUtxoDataResponse>;
};

export interface BtcTransactionDataResponse {
  block_hash: string;
  block_height: string;
  block_index: number;
  hash: string;
  hex: string;
  addresses: string[];
  total: number;
  fees: number;
  size: number;
  preference: string;
  relayed_by: string;
  confirmed: string;
  received: string;
  ver: number;
  double_spend: boolean;
  vin_sz: number;
  vout_sz: number;
  data_protocol: string;
  confirmations: number;
  confidence: number;
  inputs: Input[];
  outputs: Output[];
}


export interface BtcTransactionData extends TransactionData {
  blockHash: string;
  blockHeight: string;
  blockIndex: number;
  txid: string;
  addresses: string[];
  total: number;
  fees: number;
  size: number;
  preference: string;
  relayedBy: string;
  confirmed: string;
  received: string;
  ver: number;
  doubleSpend: boolean;
  vinSz: number;
  voutSz: number;
  dataProtocol: string;
  confirmations: number;
  confidence: number;
  inputs: Input[];
  outputs: Output[];
  isOrdinal: boolean;
}

export interface Input {
  addresses: string[];
  output_index: number;
  output_value: number;
  witness?: string[];
}

export interface Output {
  addresses: string[];
  value: number;
}


export interface BtcTransactionBroadcastResponse {
  tx: {
    hash: string;
  };
}

export interface BtcBalance {
  balance: number;
}

export interface BtcAddressBalanceResponse {
  address: string;
  chain_stats: {
    funded_txo_count: number;
    funded_txo_sum: number;
    spent_txo_count: number;
    spent_txo_sum: number;
    tx_count: number;
  };
  mempool_stats: {
    funded_txo_count: number;
    funded_txo_sum: number;
    spent_txo_count: number;
    spent_txo_sum: number;
    tx_count: number;
  };
}

export interface BtcAddressData {
  address: string;
  totalReceived: number;
  totalSent: number;
  unconfirmedBalance: number;
  finalBalance: number;
  unconfirmedTx: number;
  finalNTx: number;
}

export interface BtcTransactionsDataResponse {
  address: string;
  total_received: number;
  total_sent: number;
  balance: number;
  unconfirmed_balance: number;
  final_balance: number;
  n_tx: number;
  unconfirmed_tx: number;
  final_n_tx: number;
  txs: Array<BtcTransactionDataResponse>;
  txrefs: Array<BtcUtxoDataResponse>;
  unconfirmed_txrefs: Array<BtcUtxoDataResponse>;
}

export interface BtcOrdinal {
  id: string;
  utxo: UTXO;
  confirmationTime: number,
}