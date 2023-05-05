export interface BtcTransaction {
  txid: string;
  version: number;
  locktime: number;
  vin: BtcTxInput[];
  vout: BtcTxOutput[];
  size: number;
  weight: number;
  fee: number;
  status: BtcTxStatus;
}

export interface BtcTxStatus {
  confirmed: boolean;
  block_height: number;
  block_hash: string;
  block_time: number;
}

export interface BtcTxInput {
  txid: string;
  vout: number;
  prevout: Prevout;
  scriptsig: string;
  scriptsig_asm: string;
  is_coinbase: boolean;
  sequence: number;
  inner_redeemscript_asm: string;
}

export interface Prevout {
  scriptpubkey: string;
  scriptpubkey_asm: string;
  scriptpubkey_type: string;
  scriptpubkey_address: string;
  value: number;
}

export interface BtcTxOutput {
  scriptpubkey: string;
  scriptpubkey_asm: string;
  scriptpubkey_type: string;
  scriptpubkey_address: string;
  value: number;
}
