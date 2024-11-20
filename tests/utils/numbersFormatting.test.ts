import { describe, it, expect } from 'vitest';
import { formatBalance } from '../../utils/numbersFormatting';

describe('formatBalance', () => {
  it('should handle normal decimals with rounding to 6 places', () => {
    expect(formatBalance('123.4567891')).toBe('123.456789');
    expect(formatBalance('123.456789923')).toBe('123.45679');
    expect(formatBalance('123.45')).toBe('123.45');
    expect(formatBalance('0.999999999')).toBe('1.0');
  });

  it('should handle numbers with up to 3 leading zeros showing 6 decimals', () => {
    expect(formatBalance('0.0001234567')).toBe('0.000123');
    expect(formatBalance('0.000123456789')).toBe('0.000123');
    expect(formatBalance('123.000456789')).toBe('123.000457');
  });

  it('should use subscript notation for 4 or more leading zeros with 4 significant digits', () => {
    expect(formatBalance('0.00001234')).toBe('0.0₄1234');
    expect(formatBalance('0.00001')).toBe('0.0₄1000');
    expect(formatBalance('0.000001234567')).toBe('0.0₅1235');
    expect(formatBalance('0.00000001234567')).toBe('0.0₇1235');
    expect(formatBalance('123.00000001234')).toBe('123.0₇1234');
  });

  it('should handle all zeros after decimal point', () => {
    expect(formatBalance('123.000000000')).toBe('123.0₉');
    expect(formatBalance('0.000000000')).toBe('0.0₉');
  });

  it('should handle large numbers of leading zeros', () => {
    expect(formatBalance('0.000000000000006789')).toBe('0.0₁₄6789');
    expect(formatBalance('0.' + '0'.repeat(99999) + '6789')).toBe('0.0₉₉₉₉₉6789');
  });

  it('should handle numbers with commas', () => {
    expect(formatBalance('1234.4567891')).toBe('1,234.456789');
    expect(formatBalance('300000')).toBe('300,000');
    expect(formatBalance('300,000')).toBe('300,000');
    expect(formatBalance('198,867.33334')).toBe('198,867.33334');
  });
});
