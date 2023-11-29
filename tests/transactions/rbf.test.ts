import { describe, expect, it } from 'vitest';
import rbf from '../../transactions/rbf';
import { rbfTransaction, wallet } from './rbf.data';

describe('Replace By Fee', () => {
  describe('isTransactionRbfEnabled', () => {
    it('Identifies that a transaction is RBF enabled', () => {
      const isRBF = rbf.isTransactionRbfEnabled(rbfTransaction, wallet);
      expect(isRBF).toEqual(true);
    });

    it('Identifies that a confirmed transaction is not RBF enabled', () => {
      const txn = { ...rbfTransaction, confirmed: true };
      const isRBF = rbf.isTransactionRbfEnabled(txn, wallet);
      expect(isRBF).toEqual(false);
    });

    it('Identifies that a transaction without RBF inputs is not RBF enabled', () => {
      const txn = { ...rbfTransaction, inputs: [{ sequence: 0xffffffff } as any] };
      const isRBF = rbf.isTransactionRbfEnabled(txn, wallet);
      expect(isRBF).toEqual(false);
    });

    it('Identifies that a transaction with RBF inputs but not from wallet are not RBF enabled', () => {
      const txn = {
        ...rbfTransaction,
        inputs: [
          ...rbfTransaction.inputs,
          { sequence: 0xfffffffd, prevout: { scriptpubkey: 'otherAddressKey' } } as any,
        ],
      };
      const isRBF = rbf.isTransactionRbfEnabled(txn, wallet);
      expect(isRBF).toEqual(false);
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

    it('should generate summary for complete test txn', () => {
      const summary = rbf.getRbfTransactionSummary(rbfTransaction);
      expect(summary).toEqual({
        currentFee: 33288,
        currentFeeRate: 66.71,
        minimumRbfFee: 33787,
        minimumRbfFeeRate: 68,
      });
    });
  });

  describe('RbfTransaction', () => {
    it('getRbfRecommendedFees', async () => {
      const rbfTxn = new rbf.RbfTransaction(rbfTransaction, wallet);
      const recommendedFees = await rbfTxn.getRbfRecommendedFees({
        economyFee: 23,
        fastestFee: 70,
        halfHourFee: 65,
        hourFee: 55,
        minimumFee: 20,
      });
      expect(recommendedFees).toEqual({
        high: {
          enoughFunds: true,
          fee: 38080,
          feeRate: 70,
        },
        higher: {
          enoughFunds: true,
          fee: 45696,
          feeRate: 84,
        },
      });
    });
  });
});
