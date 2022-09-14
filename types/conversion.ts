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

export const currencySymbolMap: Record<string, string> = {
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
};
