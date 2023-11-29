import { describe, expect, it } from 'vitest';
import rbf from '../../transactions/rbf';

describe('Replace By Fee', () => {
  describe('isTransactionRbfEnabled', () => {
    it.each([
      ['confirmed', [{ confirmed: true }], false],
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
        fees: 20000,
      } as any);
      expect(summary).toEqual({
        currentFee: 20000, // sum of inputs minus sum of outputs
        currentFeeRate: 181.82, // currentFee / vsize with vsize being weight / 4
        minimumRbfFee: 20110, // currentFee + vsize of txn
        minimumRbfFeeRate: 183, // minimumRbfFee / vsize
      });
    });
  });
});
