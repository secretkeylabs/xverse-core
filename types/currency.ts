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
  | 'CAD'
  | 'CNY'
  | 'EUR'
  | 'USD'
  | 'ARS'
  | 'KRW'
  | 'HKD'
  | 'JPY'
  | 'SGD'
  | 'GBP'
  | 'BRL'
  | 'RUB'
  | 'AUD'
  | 'NGN'
  | 'TRY'
  | 'INR'
  | 'CHF'
  | 'VND'
  | 'PLN'
  | 'MYR'
  | 'TWD'
  | 'IDR'
  | 'HUF'
  | 'THB'
  | 'PHP'
  | 'PKR'
  | 'ZAR'
  | 'MXN';

export const currencySymbolMap: Record<SupportedCurrency, string> = {
  USD: '$',
  EUR: '€',
  CAD: '$',
  CNY: '¥',
  ARS: '$',
  KRW: '₩',
  HKD: '$',
  JPY: '¥',
  SGD: '$',
  GBP: '£',
  BRL: 'R$',
  RUB: '₽',
  AUD: '$',
  NGN: '₦', // Nigerian Naira
  TRY: 'TL', // Turkish Lira
  INR: '₨', // Indian Rupee
  CHF: 'CHF', // Swiss Franc
  VND: '₫', // Vietnamese Dong
  PLN: 'zł', // Polish Zloty
  MYR: 'RM', // Malaysian Ringgit
  TWD: 'NT$', // New Taiwan Dollar
  IDR: 'Rp', // Indonesian Rupiah
  HUF: 'Ft', // Hungarian Forint
  THB: '฿', // Thai Baht
  PHP: '₱', // Philippine Peso
  PKR: '₨', // Pakistani Rupee
  ZAR: 'R', // South African Rand
  MXN: '$', // Mexican Peso
};
