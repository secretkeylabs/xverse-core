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

type TopRunes = Record<RuneBalance['id'], Omit<RuneBalance, 'priceChangePercentage24h' | 'currentPrice'>>;

export type TopTokens = {
  runes: TopRunes;
};

export type TopRunesResponse = Record<FungibleToken['principal'], FungibleToken>;

export type TopTokensResponse = {
  runes: TopRunesResponse;
};
