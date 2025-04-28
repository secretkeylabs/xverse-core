import { FormatterArg } from '..';
import { BNCrypto } from '../helpers';

const strkMaxDecimals = 6;

const commonBNOptions = {
  decimalSeparator: '.',
  groupSeparator: ',',
};

export function cryptoStarknetStarknetFormatter({
  amount,
  options: { unit } = { unit: 'starknet' },
}: FormatterArg<'starknet' | 'fri'>): string {
  const amountString = amount.toString();
  const amountBN = BNCrypto(amountString);

  if (unit === 'starknet') {
    const amountBNStrk = amountBN.dividedBy(1e18);
    return amountBNStrk.toFormat(strkMaxDecimals, {
      ...commonBNOptions,
      suffix: ' STRK',
    });
  }

  return amountBN.toFormat(0, {
    ...commonBNOptions,
    suffix: ' fri',
  });
}
