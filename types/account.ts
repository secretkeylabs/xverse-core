export type AccountType = 'ledger' | 'software';

export type BtcPaymentType = 'nested' | 'native';

export type BtcAddressType = 'nested' | 'native' | 'taproot';

export type BtcAddress = {
  address: string;
  publicKey: string;
};

export type AccountBtcAddresses = {
  nested?: BtcAddress;
  native?: BtcAddress;
  taproot: BtcAddress;
};

export type Account = {
  id: number;
  deviceAccountIndex?: number;
  masterPubKey: string;
  accountType: AccountType;
  accountName?: string;

  stxAddress: string;
  stxPublicKey: string;
  bnsName?: string;

  btcAddresses: AccountBtcAddresses;
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

export const HistoricalDataPeriods = ['1d', '1w', '1m', '1y'] as const;
export type HistoricalDataParamsPeriod = (typeof HistoricalDataPeriods)[number];
export type HistoricalDataResponsePrice = { x: number; y: number; tooltipLabel: string };
export type HistoricalDataResponsePrices = HistoricalDataResponsePrice[];
