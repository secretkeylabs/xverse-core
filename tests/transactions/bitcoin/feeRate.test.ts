import { describe, expect, it } from 'vitest';
import { assertValidFeeRate } from '../../../transactions/bitcoin/utils/feeRate';

describe('assertValidFeeRate', () => {
  it('accepts positive finite rates', () => {
    expect(() => assertValidFeeRate(1)).not.toThrow();
    expect(() => assertValidFeeRate(0.1)).not.toThrow();
    expect(() => assertValidFeeRate(1000)).not.toThrow();
  });

  it('rejects zero, negative, and non-finite', () => {
    expect(() => assertValidFeeRate(0)).toThrow('Invalid fee rate');
    expect(() => assertValidFeeRate(-1)).toThrow('Invalid fee rate');
    expect(() => assertValidFeeRate(Number.NaN)).toThrow('Invalid fee rate');
    expect(() => assertValidFeeRate(Number.POSITIVE_INFINITY)).toThrow('Invalid fee rate');
  });
});
