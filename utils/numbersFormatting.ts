/**
 * Formats a given value as a localized number string.
 * If the value is undefined or null, returns a dash ('-').
 *
 * @param value - The value to format, which can be a string or a number.
 * @returns The formatted number string or a dash if the value is not provided.
 */
export const formatNumber = (value?: string | number) => {
  if (!value) return '-';
  const cleanValue = typeof value === 'string' ? value.replace(/,/g, '') : value;
  return new Intl.NumberFormat().format(Number(cleanValue));
}

/**
 * Formats a string which may contain many extremely large values or extremely high decimal places
 * Numbers with >= 4 leading zeros will return subscript notation.
 * Limits decimal places to 6 digits after removing leading zeros, with proper rounding.
 * For regular decimals without leading zeros, limits to 6 decimal places with rounding.
 *
 * @param value - The number string to format.
 * @returns The formatted number string.
 */
export const formatBalance = (value: string): string => {
  // Unicode subscript characters for numbers
  const unicodeSubChars = ['₀', '₁', '₂', '₃', '₄', '₅', '₆', '₇', '₈', '₉'];

  const [integerPart, decimalPart] = value.split('.');

  // If there's no decimal part, return the original value
  if (!decimalPart) return formatNumber(value);

  const leadingZerosMatch = decimalPart.match(/^0+/);
  const leadingZerosCount = leadingZerosMatch ? leadingZerosMatch[0].length : 0;

  // If there are 3 or fewer leading zeros, or no leading zeros,
  // truncate to 6 decimal places with rounding
  if (leadingZerosCount <= 3) {
    const roundedNum = Math.round(Number(`0.${decimalPart}`) * 1000000) / 1000000;
    if (roundedNum === 1) {
      return `${formatNumber(Number(integerPart) + 1)}.0`;
    }
    const roundedParts = roundedNum.toString().split('.');
    return `${formatNumber(integerPart)}.${roundedParts[1] || '0'}`;
  }

  // Handle cases with more than 3 leading zeros
  const countString = leadingZerosCount.toString();
  const truncatedCount = countString.slice(0, 5);
  const leadingZerosUnicode = truncatedCount
    .split('')
    .map((digit) => unicodeSubChars[parseInt(digit, 10)])
    .join('');

  const remainingDecimalPart = decimalPart.slice(leadingZerosCount);

  // Check if all remaining digits are zeros
  if (/^0+$/.test(remainingDecimalPart) || !remainingDecimalPart) {
    return `${formatNumber(integerPart)}.0${leadingZerosUnicode}`;
  }

  // Round to 4 decimal places properly for significant digits
  const roundedValue = (Math.round(Number(`0.${remainingDecimalPart}`) * 10000) / 10000)
    .toFixed(4)
    .slice(2); // Remove "0." from the start

  return `${formatNumber(integerPart)}.0${leadingZerosUnicode}${roundedValue}`;
};
