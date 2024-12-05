import { describe, it, expect } from 'vitest';
import { formatBalance } from '../../utils/numbersFormatting';

describe('formatBalance', () => {
  it('should handle normal decimals up to 6 places', () => {
    expect(formatBalance('123.4567891')).toEqual({
      prefix: '123.456789',
      isRounded: true,
    });
    expect(formatBalance('123.456789923')).toEqual({
      prefix: '123.456789',
      isRounded: true,
    });
    expect(formatBalance('123.45')).toEqual({
      prefix: '123.45',
      isRounded: false,
    });
    expect(formatBalance('0.999999999')).toEqual({
      prefix: '0.999999',
      isRounded: true,
    });
  });

  it('should handle numbers with up to 3 leading zeros showing 6 decimals', () => {
    expect(formatBalance('0.0001234567')).toEqual({
      prefix: '0.000123',
      isRounded: true,
    });
    expect(formatBalance('0.000123456789')).toEqual({
      prefix: '0.000123',
      isRounded: true,
    });
    expect(formatBalance('123.000456789')).toEqual({
      prefix: '123.000456',
      isRounded: true,
    });
    expect(formatBalance('123.000456')).toEqual({
      prefix: '123.000456',
      isRounded: false,
    });
  });

  it('should use subscript notation for 4 or more leading zeros with 4 significant digits', () => {
    expect(formatBalance('0.00001234')).toEqual({
      prefix: '0.0',
      suffix: {
        subscript: '4',
        value: '1234',
      },
      isRounded: false,
    });
    expect(formatBalance('0.00001')).toEqual({
      prefix: '0.0',
      suffix: {
        subscript: '4',
        value: '1',
      },
      isRounded: false,
    });
    expect(formatBalance('0.000001234567')).toEqual({
      prefix: '0.0',
      suffix: {
        subscript: '5',
        value: '1234',
      },
      isRounded: true,
    });
    expect(formatBalance('0.00000001234567')).toEqual({
      prefix: '0.0',
      suffix: {
        subscript: '7',
        value: '1234',
      },
      isRounded: true,
    });
    expect(formatBalance('123.00000001234')).toEqual({
      prefix: '123.0',
      suffix: {
        subscript: '7',
        value: '1234',
      },
      isRounded: false,
    });
  });

  it('should handle all zeros after decimal point', () => {
    expect(formatBalance('123.000000000')).toEqual({
      prefix: '123',
      isRounded: false,
    });
    expect(formatBalance('0.000000000')).toEqual({
      prefix: '0',
      isRounded: false,
    });
  });

  it('should handle large numbers of leading zeros', () => {
    expect(formatBalance('0.000000000000006789')).toEqual({
      prefix: '0.0',
      suffix: {
        subscript: '14',
        value: '6789',
      },
      isRounded: false,
    });
    expect(formatBalance('0.' + '0'.repeat(99999) + '6789')).toEqual({
      prefix: '0.0',
      suffix: {
        subscript: '99999',
        value: '6789',
      },
      isRounded: false,
    });
  });

  it('should handle numbers with commas', () => {
    expect(formatBalance('1234.4567891')).toEqual({
      prefix: '1,234.456789',
      isRounded: true,
    });
    expect(formatBalance('300000')).toEqual({
      prefix: '300,000',
      isRounded: false,
    });
    expect(formatBalance('300,000')).toEqual({
      prefix: '300,000',
      isRounded: false,
    });
    expect(formatBalance('198,867.33334')).toEqual({
      prefix: '198,867.33334',
      isRounded: false,
    });
  });
});
