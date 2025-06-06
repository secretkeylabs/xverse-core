import { BaseToken, FungibleToken } from '../../fungibleTokens';
import { RuneBalance } from '../runes';

export interface Coin extends BaseToken {
  id?: number;
  contract: string;
  description?: string;
  decimals?: number;
  supported?: boolean;
  tokenFiatRate?: number | null;
  visible?: boolean;
}

export interface SignedUrlResponse {
  signedUrl: string;
}

export type CoinsResponse = Coin[];

export interface Brc20Token extends BaseToken {
  ticker: string;
  supported: boolean;
  tokenFiatRate?: string;
  priceChangePercentage24h?: string | null;
  currentPrice?: string | null;
}

export type Brc20TokensResponse = Brc20Token[];

export type SimplePriceResponse = {
  [tokenId: string]: {
    [fiatCurrency: string]: number;
  };
};

type TopRunes = Record<RuneBalance['id'], RuneBalance>;

export type PrincipalToFungibleToken = Record<FungibleToken['principal'], FungibleToken>;

export type TopTokens = {
  runes: TopRunes;
  stacks: PrincipalToFungibleToken;
  'brc-20': PrincipalToFungibleToken;
};

export type TopTokensResponse = {
  runes: PrincipalToFungibleToken;
  stacks: PrincipalToFungibleToken;
  'brc-20': PrincipalToFungibleToken;
};

export type TokenStatsAndInfoResponseType = {
  volume24h?: number;
  marketCap?: number;
  holders?: number;
  divisibility?: number;
  mintable?: boolean;
  mintLimit?: string;
  mintAmount?: string;
};
