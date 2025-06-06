import { cryptoStarknetStarknetFormatter } from './formatters';

// NOTE: This type may be better suited in the types folder?
/**
 * The convention for the names is:
 * - fiat: `fiat/<currency-name>`
 * - crypto: `crypto/<chain-name>/<token-name>`
 */
export type Currency =
  // | 'fiat/united-states-dollar'
  // | 'fiat/euro'
  // | 'crypto/bitcoin/bitcoin'
  // | 'crypto/stacks/stacks'
  // | 'crypto/stacks/sbtc'
  'crypto/starknet/starknet';

export type Amount = string | number | bigint;

export type BaseOptions<Unit extends string = 'default'> = {
  locale?: string;
  currencyDisplay?: Intl.NumberFormatOptions['currencyDisplay'];
  unit?: Unit;
};

export type FormatterArg<Unit extends string = 'default', SpecificOptions extends object = object> = {
  amount: Amount;
  options?: BaseOptions<Unit> & SpecificOptions;
};

type FormatterArgs = {
  'fiat/united-states-dollar': FormatterArg<'dollar' | 'cent'>;
  'crypto/bitcoin/bitcoin': FormatterArg<'bitcoin' | 'satoshi'>;
  'crypto/starknet/starknet': FormatterArg<'starknet' | 'fri'>;
};

type Formatter<C extends Currency> = (args: FormatterArgs[C]) => string;

type Formatters = {
  [Key in Currency]: Formatter<Key>;
};

const formatters: Formatters = {
  'crypto/starknet/starknet': cryptoStarknetStarknetFormatter,
};

export function format<C extends Currency>({
  amount,
  currency,
  options,
}: {
  amount: Amount;
  currency: C;
  options?: FormatterArgs[C]['options'];
}): string {
  return formatters[currency]({
    amount,
    options,
  });
}

export * from './helpers';
