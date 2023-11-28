import { describe, expect, it } from 'vitest';
import rbf from '../../transactions/rbf';

describe('Replace By Fee', () => {
  describe('isTransactionRbfEnabled', () => {
    it.each([
      ['single input max', [{ sequence: 0xffffffff }], false],
      ['single input max - 1', [{ sequence: 0xffffffff - 1 }], false],
      ['single input enabled high', [{ sequence: 0xffffffff - 2 }], true],
      ['single input enabled low', [{ sequence: 0 }], true],
      ['multi input all max and max - 1', [{ sequence: 0xffffffff }, { sequence: 0xffffffff - 1 }], false],
      [
        'multi input one enabled',
        [{ sequence: 0xffffffff }, { sequence: 0xffffffff - 1 }, { sequence: 0xffffffff - 2 }],
        true,
      ],
      ['multi input all enabled', [{ sequence: 0xffffffff - 2 }, { sequence: 0 }], true],
    ])('Identifies that a transaction is RBF enabled or not - %s', (_name, inputs, expected) => {
      const isRBF = rbf.isTransactionRbfEnabled({
        inputs,
      } as any);
      expect(isRBF).toEqual(expected);
    });
  });

  describe('transaction summary', () => {
    it('should generate correct summary', () => {
      const summary = rbf.getRbfTransactionSummary({
        weight: 440,
        inputs: [
          {
            prevout: {
              value: 100000,
            },
          },
          {
            prevout: {
              value: 50000,
            },
          },
        ],
        outputs: [
          {
            value: 80000,
          },
          {
            value: 50000,
          },
        ],
      } as any);
      expect(summary).toEqual({
        currentFee: 20000,
        currentFeeRate: 181.82,
        minimumRbfFee: 20110,
        minimumRbfFeeRate: 183,
      });
    });
  });
});
