import { BtcAddressData, BtcTransactionBroadcastResponse } from "../../types";
import { BtcAddressMempool, Transaction, UTXO } from '../../types/api/esplora';
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
   * Get The unspent utxos of a given Address
   *
   * @param {string} address
   * @returns {Promise<BtcAddressMempool[]>}
   */
  getAddressMempoolTransactions(address: string): Promise<BtcAddressMempool[]>;

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