import { BigNumber } from '../../../utils/bignumber';
import { FungibleToken } from '../shared';

export interface Rune {
  entry: {
    burned: BigNumber;
    deadline: BigNumber | null;
    divisibility: BigNumber;
    end: BigNumber | null;
    etching: string;
    limit: BigNumber | null;
    mints: BigNumber;
    number: BigNumber;
    rune: string;
    spacers: BigNumber;
    supply: BigNumber;
    symbol: string | null;
    timestamp: BigNumber;
  };
  id: string;
  parent: string | null;
}

export const runeTokenToFungibleToken = (name: string, balance: BigNumber, decimals: number): FungibleToken => ({
  name,
  decimals,
  principal: name,
  balance: balance.toString(),
  total_sent: '',
  total_received: '',
  assetName: name,
  visible: true,
  ticker: '',
  protocol: 'runes',
});
