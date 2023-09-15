import BigNumber from 'bignumber.js';

export type Brc20Recipient = {
  address: string;
  amountBrc20: BigNumber;
  amountSats: BigNumber;
};
