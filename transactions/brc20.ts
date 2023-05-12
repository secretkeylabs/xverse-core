import BigNumber from 'bignumber.js';
import { Account } from 'types/account';

interface Brc20TransferOptions {
  // brc20 token name
  coinName: string;
  // brc20 token amount
  amount: BigNumber;
  // recipient Address
  recipientAddress: string;
  // sender Account
  account: Account;
  // sender Seed phrase
  seedPhrase: string;
}


/**
 * Description placeholder
 * @date 5/13/2023 - 12:23:56 AM
 *
 * @param {Brc20TransferOptions} options
 */
export const createBrc20TransferTxs = (options: Brc20TransferOptions) => {
    // check the sender balance for the coin amount required
    // generate a json with the transfer op with the required amount
    // create an inscription tx with the generated json
    // create an ordinal send tx with the inscription tx-id
};
