import { BaseToken } from '../shared/transaction';

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

export type Brc20Token = {
  ticker: string;
  name: string;
  supported: boolean;
  tokenFiatRate?: string;
};

export type Brc20TokensResponse = Brc20Token[];
