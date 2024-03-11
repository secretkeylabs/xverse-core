import { FungibleToken, Rune, RuneNum } from '../../types';
import { BigNumber } from '../../utils/bignumber';

export interface RunesApiInterface {
  /**
   * Get the balance of all rune tokens an address has
   * @param {string} address
   * @return {Promise<Record<string, BigNumber>>}
   */
  getRuneBalance(address: string): Promise<Record<string, BigNumber>>;

  /**
   * Get the rune details given its rune name
   * @param {string} runeName
   * @return {Promise<Rune>}
   */
  getRuneInfo(runeName: string): Promise<Rune>;

  /**
   * Get many rune details given a list of rune names
   * @param {string[]} runeNames
   * @return {Promise<Rune[]>}
   */
  getRuneInfos(runeNames: string[]): Promise<Record<string, Rune>>;

  /**
   * Get rune details in fungible token format
   * @param {string} address
   * @return {Promise<FungibleToken[]>}
   */
  getRuneFungibleTokens(address: string): Promise<FungibleToken[]>;

  /**
   * Get The rune num from its name
   * @param {string} runeName
   * @returns {Promise<RuneNum>}
   */
  getRuneNumFromName(runeName: string): Promise<RuneNum>;

  /**
   * Get The rune name from its num
   * @param {RuneNum} runeNum
   * @returns {Promise<string>}
   */
  getRuneNameFromNum(runeNum: RuneNum): Promise<string>;

  /**
   * Get The rune varint from its num
   * @param {BigNumber} runeNum
   * @returns {Promise<BigNumber[]>}
   */
  getRuneVarintFromNum(runeNum: BigNumber): Promise<number[]>;

  /**
   * Get the rune num from its varint
   * @param {number[]} varint
   * @returns {Promise<BigNumber>}
   */
  getRuneNumFromVarint(varint: number[]): Promise<BigNumber>;
}
