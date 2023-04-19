import { BtcAddressData, BtcTransactionBroadcastResponse } from "../../types";
import { BtcAddressMempool, Transaction, UTXO } from '../../types/api/esplora';
export interface BitcoinApiProvider {
  /**
   * Get the balance of an account given its addresses.
   * @param {string} address
   * @return {Promise<BtcAddressData>}
   */
  getBalance(address: string): Promise<BtcAddressData>;
  /**
   * Get The unspent utxos of a given Address
   * @param {string} address
   * @returns {Promise<UTXO[]>}
   */
  getUnspentUtxos(address: string): Promise<UTXO[]>;

  /**
   * Get The unspent utxos of a given Address
   * @param {string} address
   * @returns {Promise<UTXO[]>}
   */
  getAddressTransactions(address: string): Promise<Transaction[]>;

  /**
   * Get The unspent utxos of a given Address
   * @param {string} address
   * @returns {Promise<BtcAddressMempool[]>}
   */
  getAddressMempoolTransactions(address: string): Promise<BtcAddressMempool[]>;

  /**
   * Broadcast a signed transaction to the network.
   * @param {!string} rawTransaction - A raw transaction usually in the form of a
   *  hexadecimal string that represents the serialized transaction.
   * @return {Promise<BtcTransactionBroadcastResponse>} Resolves with an
   *  identifier for the broadcasted transaction.
   */
  sendRawTransaction(rawTransaction: string): Promise<BtcTransactionBroadcastResponse>;

  /**
   * Get Returns the height of the last block.
   * @returns {Promise<number>}
   */
  getLatestBlockHeight(address: string): Promise<number>;
}