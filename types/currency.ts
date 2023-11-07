export type StxBtcCurrencyRate = {
  symbol: string;
  price: number;
};

export type BtcUsdCurrencyRate = {
  data: {
    base: string;
    currency: string;
    amount: number;
  };
};

export type SupportedCurrency =
  | 'USD'
  | 'EUR'
  | 'CAD'
  | 'CNY'
  | 'ARS'
  | 'KRW'
  | 'HKD'
  | 'JPY'
  | 'SGD'
  | 'GBP'
  | 'BRL'
  | 'RUB'
  | 'CHF';

export const currencySymbolMap: Record<SupportedCurrency, string> = {
  USD: '$',
  EUR: '€',
  CAD: '$',
  CNY: '¥',
  ARS: '$',
  KRW: '₩',
  HKD: 'HK$',
  JPY: '¥',
  SGD: 'S$',
  GBP: '£',
  BRL: 'R$',
  RUB: '₽',
  CHF: '₣',
};
