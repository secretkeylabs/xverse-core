export interface BtcAddressMempool {
  txid: string;
  vin: MempoolInput[];
  sequence: number;
}

export interface MempoolInput {
  txid: string;
  vout: number;
}

export type FeeEstimates = { [index: string]: number };

export type TxStatus = {
  confirmed: boolean;
  block_hash?: string;
  block_height?: number;
  block_time?: number;
};

export type UTXO = {
  address: string;
  txid: string;
  vout: number;
  status: TxStatus;
  value: number;
};

export type Address = {
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
};

export type Vout = {
  scriptpubkey: string;
  scriptpubkey_asm: string;
  scriptpubkey_type: string;
  scriptpubkey_address?: string;
  value: number;
};

export type Vin = {
  txid: string;
  vout: number;
  prevout: Vout;
  scriptsig: string;
  scriptsig_asm: string;
  is_coinbase: boolean;
  sequence: number;
};

export type Transaction = {
  txid: string;
  version: number;
  locktime: number;
  vin: Vin[];
  vout: Vout[];
  size: number;
  weight: number;
  fee: number;
  status: TxStatus;
};

export type Block = {
  id: string;
  height: number;
  version: number;
  timestamp: number;
  tx_count: number;
  size: number;
  weight: number;
  merlke_root: string;
  previousblockhash: string;
  mediantime: number;
  nonce: number;
  bits: number;
  difficulty: number;
};

export type RecommendedFeeResponse = {
  economyFee: number;
  fastestFee: number;
  halfHourFee: number;
  hourFee: number;
  minimumFee: number;
};
