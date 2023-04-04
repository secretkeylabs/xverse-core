import BigNumber from "bignumber.js";
import { BtcAddressData, BtcTransactionBroadcastResponse } from "../../types";

export type FeeEstimates = { [index: string]: number };

export type TxStatus = {
  confirmed: boolean;
  block_hash?: string;
  block_height?: number;
  block_time?: number;
};

export type UTXO = {
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


export interface BitcoinApiProvider {
  /**
   * Get the balance of an account given its addresses.
   * @param {(string | Address)[]} addresses - A list of addresses.
   * @return {Promise<BigNumber, InvalidProviderResponseError>} If addresses is given,
   *  returns the cumulative balance of the given addresses. Otherwise returns the balance
   *  of the addresses that the signing provider controls.
   *  Rejects with InvalidProviderResponseError if provider's response is invalid.
   */
  getBalance(address: string): Promise<BtcAddressData>;
  /**
   * Get The unspent utxos of a given Address
   *
   * @param {string} address
   * @returns {Promise<UTXO[]>}
   */
  getUnspentUtxos(address: string): Promise<UTXO[]>;

  /**
   * Get The unspent utxos of a given Address
   *
   * @param {string} address
   * @returns {Promise<UTXO[]>}
   */
  getAddressTransactions(address: string): Promise<Transaction[]>;

  /**
   * Broadcast a signed transaction to the network.
   * @param {!string} rawTransaction - A raw transaction usually in the form of a
   *  hexadecimal string that represents the serialized transaction.
   * @return {Promise<string, InvalidProviderResponseError>} Resolves with an
   *  identifier for the broadcasted transaction.
   *  Rejects with InvalidProviderResponseError if provider's response is invalid.
   */
  sendRawTransaction(rawTransaction: string): Promise<BtcTransactionBroadcastResponse>;
}