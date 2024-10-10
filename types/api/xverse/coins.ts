import { BaseToken } from '../shared';

export interface Coin extends BaseToken {
  id?: number;
  contract: string;
  description?: string;
  decimals?: number;
  supported?: boolean;
  tokenFiatRate?: number | null;
  visible?: boolean;
  priceChangePercentage24h?: string | null;
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
}

export type Brc20TokensResponse = Brc20Token[];

export type SimplePriceResponse = {
  [tokenId: string]: {
    [fiatCurrency: string]: number;
  };
};
