export type AccountType = 'ledger' | 'software';

export interface Account {
  id: number;
  stxAddress: string;
  btcAddress: string;
  ordinalsAddress: string;
  masterPubKey: string;
  stxPublicKey: string;
  btcPublicKey: string;
  ordinalsPublicKey: string;
  bnsName?: string;
  accountType?: AccountType;
  accountName?: string;
  deviceAccountIndex?: number;
}

export type NotificationBanner = {
  id: string;
  name: string;
  url: string;
  icon: string;
  description: string;
};

export type CoinsMarket = {
  id: string;
  symbol: string;
  name: string;
  image: string;
  current_price: number;
  market_cap: number;
  market_cap_rank: number;
  fully_diluted_valuation: number;
  total_volume: number;
  high_24h: number;
  low_24h: number;
  price_change_24h: number;
  price_change_percentage_24h: number;
  market_cap_change_24h: number;
  market_cap_change_percentage_24h: number;
  circulating_supply: number;
  total_supply: number;
  max_supply: number;
  ath: number;
  ath_change_percentage: number;
  ath_date: string;
  atl: number;
  atl_change_percentage: number;
  atl_date: string;
  roi: number;
  last_updated: string;
};

export type ExchangeRateList = {
  [currency: string]: string;
};

export type ExchangeRateAvailableCurrencies = 'USD' | 'BTC' | 'STX';
