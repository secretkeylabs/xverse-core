import { describe, expect, it, vi } from 'vitest';
import EsploraApiProvider from '../../api/esplora/esploraAPiProvider';
import rbf from '../../transactions/rbf';
import { largeUtxo, rbfEsploraTransaction, rbfTransaction, wallet } from './rbf.data';

vi.mock('../../api/esplora/esploraAPiProvider');

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
    it('should generate summary for complete test txn', async () => {
      vi.mocked(EsploraApiProvider).mockImplementation(
        () =>
          ({
            getTransaction: () => Promise.resolve(rbfEsploraTransaction),
            getTransactionOutspends: () => Promise.resolve([]),
          } as any),
      );
      const summary = await rbf.getRbfTransactionSummary('Mainnet', 'txid');
      expect(summary).toEqual({
        currentFee: 33288,
        currentFeeRate: 66.74,
        minimumRbfFee: 33787,
        minimumRbfFeeRate: 68,
      });
    });
  });

  describe('RbfTransaction', () => {
    it('getRbfRecommendedFees', async () => {
      vi.mocked(EsploraApiProvider).mockImplementation(
        () =>
          ({
            getUnspentUtxos: () => Promise.resolve([]),
            getTransaction: () => Promise.resolve(rbfEsploraTransaction),
            getTransactionOutspends: () => Promise.resolve([]),
          } as any),
      );

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

    it('getRbfFeeSummary throws on low fee rate', async () => {
      vi.mocked(EsploraApiProvider).mockImplementation(
        () =>
          ({
            getUnspentUtxos: () => Promise.resolve([]),
            getTransaction: () => Promise.resolve(rbfEsploraTransaction),
            getTransactionOutspends: () => Promise.resolve([]),
          } as any),
      );

      const rbfTxn = new rbf.RbfTransaction(rbfTransaction, wallet);
      await expect(() => rbfTxn.getRbfFeeSummary(50)).rejects.toThrow('Fee rate is below RBF minimum fee rate');
    });

    it('getRbfFeeSummary works with no extra inputs', async () => {
      vi.mocked(EsploraApiProvider).mockImplementation(
        () =>
          ({
            getUnspentUtxos: () => Promise.resolve([]),
            getTransaction: () => Promise.resolve(rbfEsploraTransaction),
            getTransactionOutspends: () => Promise.resolve([]),
          } as any),
      );

      const rbfTxn = new rbf.RbfTransaction(rbfTransaction, wallet);
      const feeSummary = await rbfTxn.getRbfFeeSummary(68);
      expect(feeSummary).toEqual({
        enoughFunds: true,
        fee: 36992,
        feeRate: 68,
      });
    });

    it('getRbfFeeSummary returns not enough funds if no additional UTXOs', async () => {
      vi.mocked(EsploraApiProvider).mockImplementation(
        () =>
          ({
            getUnspentUtxos: () => Promise.resolve([]),
            getTransaction: () => Promise.resolve(rbfEsploraTransaction),
            getTransactionOutspends: () => Promise.resolve([]),
          } as any),
      );

      const rbfTxn = new rbf.RbfTransaction(rbfTransaction, wallet);
      const feeSummary = await rbfTxn.getRbfFeeSummary(1000000);

      expect(feeSummary).toEqual({
        enoughFunds: false,
        fee: undefined,
        feeRate: 1000000,
      });
    });

    it('getRbfFeeSummary returns with additional UTXOs', async () => {
      vi.mocked(EsploraApiProvider).mockImplementation(
        () =>
          ({
            getUnspentUtxos: () => Promise.resolve([largeUtxo]),
            getTransaction: () => Promise.resolve(rbfEsploraTransaction),
            getTransactionOutspends: () => Promise.resolve([]),
          } as any),
      );

      const rbfTxn = new rbf.RbfTransaction(rbfTransaction, wallet);
      const feeSummary = await rbfTxn.getRbfFeeSummary(1000000);

      expect(feeSummary).toEqual({
        enoughFunds: true,
        fee: 635000000,
        feeRate: 1000000,
      });
    });
  });
});
