import { BigNumber } from '../../../utils/bignumber';
import { FungibleToken } from '../shared';

type BigNullable = BigNumber | null;

export type EncodePayload = {
  edicts: Edict[];
  pointer?: number;
};

export type Rune = {
  entry: {
    block: BigNumber;
    burned: BigNumber;
    divisibility: BigNumber;
    etching: string;
    mints: BigNumber;
    number: BigNumber;
    premine: BigNumber;
    spaced_rune: string;
    symbol: string;
    terms: {
      amount: BigNullable;
      cap: BigNullable;
      height: [BigNullable, BigNullable];
      offset: [BigNullable, BigNullable];
    };
    timestamp: BigNumber;
  };
  id: string;
  mintable: boolean;
  parent: string | null;
};

export type Cenotaph = {
  etching?: BigNumber;
  flaws: number;
  mint?: string;
};

export type Artifact = {
  Cenotaph?: Cenotaph;
  Runestone?: Runestone;
};

export type Runestone = {
  edicts: Edict[];
  etching?: Etching;
  mint?: string | null;
  pointer?: BigNullable;
};

export type Edict = {
  id: string;
  amount: BigNumber;
  output: BigNumber;
};

export type Etching = {
  divisibility?: BigNumber;
  premine?: BigNumber;
  rune?: string;
  spacers: BigNumber;
  symbol?: string;
  terms?: Terms;
};

export type Terms = {
  amount?: BigNumber;
  cap?: BigNumber;
  height: [BigNullable, BigNullable];
  offset: [BigNullable, BigNullable];
};

export type SpacedRune = {
  rune_number: BigNumber;
  rune_name: string;
  spacers: BigNumber;
};

export type EncodeResponse = {
  payload: string;
  codecVersion: string;
};

export type GetRunesActivityForAddressEvent = {
  txid: string;
  amount: string;
  blockHeight: number;
  blockTimestamp: string;
  burned: boolean;
};

export type APIGetRunesActivityForAddressResponse = {
  items: GetRunesActivityForAddressEvent[];
  divisibility: number;
  runeName: string;
  total: number;
  offset: number;
  limit: number;
};

export type RuneBalance = {
  runeName: string;
  amount: BigNumber;
  divisibility: number;
  symbol: string;
  inscriptionId: string | null;
  id: string;
};

export const runeTokenToFungibleToken = (runeBalance: RuneBalance): FungibleToken => ({
  name: runeBalance.runeName,
  decimals: runeBalance.divisibility,
  principal: runeBalance.id,
  balance: runeBalance.amount.toString(),
  total_sent: '',
  total_received: '',
  assetName: runeBalance.runeName,
  visible: true,
  ticker: '',
  runeSymbol: runeBalance.symbol,
  runeInscriptionId: runeBalance.inscriptionId,
  protocol: 'runes',
});
