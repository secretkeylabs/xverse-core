import BigNumber from 'bignumber.js';

/**
 * Formats a given value as a localized number string.
 * If the value is undefined or null, returns a dash ('-').
 *
 * @param value - The value to format, which can be a string or a number.
 * @returns The formatted number string or a dash if the value is not provided.
 */
export const formatNumber = (value?: string | number) => {
  if (!value && value !== 0) return '-';
  const cleanValue = typeof value === 'string' ? value.replace(/,/g, '') : value;
  return new Intl.NumberFormat().format(Number(cleanValue));
};

export interface FormattedBalance {
  prefix: string;
  suffix?: {
    subscript: string;
    value: string;
  };
  isRounded: boolean;
}

/**
 * Formats a string which may contain many extremely large values or extremely high decimal places
 * Numbers with >= 4 leading zeros will return subscript notation.
 * Limits decimal places to 6 digits after removing leading zeros.
 * For regular decimals without leading zeros, limits to 6 decimal places.
 * any significant digit over 6 decimal places will be rounded down for safety.
 *
 * @param value - The number string to format.
 * @returns The formatted number string.
 */
export const formatBalance = (value: string): FormattedBalance => {
  const [integerPart, decimalPartRaw] = value.split('.');
  // remove zeros at end of raw decimal part
  const decimalPart = decimalPartRaw?.replace(/0+$/, '');

  // If there's no decimal part or it's all zeros, return just the formatted integer
  if (!decimalPart || /^0+$/.test(decimalPart)) {
    return {
      prefix: formatNumber(integerPart),
      isRounded: false,
    };
  }

  const leadingZerosMatch = decimalPart.match(/^0+/);
  const leadingZerosCount = leadingZerosMatch ? leadingZerosMatch[0].length : 0;

  // Handle regular decimals (3 or fewer leading zeros)
  if (leadingZerosCount <= 3) {
    const initialNumber = BigNumber(`0.${decimalPart}`);
    const flooredNum = initialNumber.dp(6, BigNumber.ROUND_FLOOR);
    const flooredParts = flooredNum.toString().split('.');

    return {
      prefix: `${formatNumber(integerPart)}.${flooredParts[1] || '0'}`,
      isRounded: initialNumber.gt(flooredNum),
    };
  }

  // Handle cases with 4 or more leading zeros
  const remainingDecimalPart = decimalPart.slice(leadingZerosCount);

  // Handle significant digits
  const significantDigits = remainingDecimalPart.slice(0, 4);
  const isRounded = remainingDecimalPart.length > 4;

  return {
    prefix: `${formatNumber(integerPart)}.0`,
    suffix: {
      subscript: leadingZerosCount.toString(),
      value: significantDigits,
    },
    isRounded,
  };
};
