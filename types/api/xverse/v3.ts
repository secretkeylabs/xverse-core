export type TokenBalanceV3 = {
  tokenName: string;
  amount: string;
  divisibility?: number;
  symbol?: string;
  inscriptionId?: string | null;
  id?: string;
  mintable?: boolean;
}[];

export type TokenMarketDataV3 = {
  [k: string]: {
    priceChangePercentage24h?: string;
    currentPrice?: string;
    marketCap?: string;
    totalVolume?: string;
    inscriptionId?: string | null;
    id?: string;
    mintable?: boolean;
    supported?: boolean;
    tokenFiatRate?: string;
    tokenFiatRateCurrency?: string;
  };
};

export type GetRuneBalanceBody = {
  address: string;
  includeUnconfirmed: boolean;
};

export type GetRunesMarketDataBody = {
  currency: string;
  runeIds: string[];
};

export type GetBrc20BalanceBody = {
  address: string;
};

export type GetBrc20MarketDataBody = {
  currency: string;
  tickers: string[];
};

export type GetSip10MarketDataBody = {
  currency: string;
  contracts: string[];
};
