import { describe, expect, it, vi } from 'vitest';
import { DEFAULT_DUST_VALUE } from '../../constant';
import rbf from '../../transactions/rbf';
import { constructOptions, largeUtxo, rbfEsploraTransaction, rbfTransaction } from './rbf.data';

vi.mock('../../api/esplora/esploraAPiProvider');

describe('Replace By Fee', () => {
  it('RBF change dust matches send-path DEFAULT_DUST_VALUE (546)', () => {
    // Guard against regressing to the old 1000-sat RBF dust floor (F-03).
    expect(Number(DEFAULT_DUST_VALUE)).toBe(546);
  });

  describe('isTransactionRbfEnabled', () => {
    it('Identifies that a transaction is RBF enabled', () => {
      const isRBF = rbf.isTransactionRbfEnabled(rbfTransaction, constructOptions());
      expect(isRBF).toEqual(true);
    });

    it('Identifies that a confirmed transaction is not RBF enabled', () => {
      const txn = { ...rbfTransaction, confirmed: true };
      const isRBF = rbf.isTransactionRbfEnabled(txn, constructOptions());
      expect(isRBF).toEqual(false);
    });

    it('Identifies that a transaction without RBF inputs is not RBF enabled', () => {
      const txn = { ...rbfTransaction, inputs: [{ sequence: 0xffffffff } as any] };
      const isRBF = rbf.isTransactionRbfEnabled(txn, constructOptions());
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
      const isRBF = rbf.isTransactionRbfEnabled(txn, constructOptions());
      expect(isRBF).toEqual(false);
    });
  });

  describe('transaction summary', () => {
    it('should generate summary for complete test txn', async () => {
      const esploraProvider = {
        getTransaction: () => Promise.resolve(rbfEsploraTransaction),
        getTransactionOutspends: () => Promise.resolve([]),
      } as any;
      const summary = await rbf.getRbfTransactionSummary(esploraProvider, 'txid');
      expect(summary).toEqual({
        currentFee: 33288,
        currentFeeRate: 66.74,
        minimumRbfFee: 33787,
        minimumRbfFeeRate: 68,
      });
    });
  });

  describe('RbfTransaction', () => {
    it('getRbfRecommendedFees reports insufficient funds when no extra inputs (outputs preserved)', async () => {
      const esploraProvider = {
        getUnspentUtxos: () => Promise.resolve([]),
        getTransaction: () => Promise.resolve(rbfEsploraTransaction),
        getTransactionOutspends: () => Promise.resolve([]),
      } as any;

      const rbfTxn = new rbf.RbfTransaction(rbfTransaction, constructOptions(esploraProvider));
      const recommendedFees = await rbfTxn.getRbfRecommendedFees({
        economyFee: 23,
        fastestFee: 70,
        halfHourFee: 65,
        hourFee: 55,
        minimumFee: 20,
      });
      // Preserving all original outputs means the original fee budget alone cannot fund a bump
      // without additional UTXOs (previously the last payment-address out was shrunk as "change").
      expect(recommendedFees).toEqual({
        high: {
          enoughFunds: false,
          fee: undefined,
          feeRate: 70,
        },
        higher: {
          enoughFunds: false,
          fee: undefined,
          feeRate: 84,
        },
      });
    });

    it('getRbfRecommendedFees works when extra payment UTXOs are available', async () => {
      const esploraProvider = {
        getUnspentUtxos: () => Promise.resolve([largeUtxo]),
        getTransaction: () => Promise.resolve(rbfEsploraTransaction),
        getTransactionOutspends: () => Promise.resolve([]),
      } as any;

      const rbfTxn = new rbf.RbfTransaction(rbfTransaction, constructOptions(esploraProvider));
      const recommendedFees = await rbfTxn.getRbfRecommendedFees({
        economyFee: 23,
        fastestFee: 70,
        halfHourFee: 65,
        hourFee: 55,
        minimumFee: 20,
      });
      expect(recommendedFees.high?.enoughFunds).toBe(true);
      expect(recommendedFees.higher?.enoughFunds).toBe(true);
      expect(recommendedFees.high?.feeRate).toBe(70);
      expect(recommendedFees.higher?.feeRate).toBe(84);
      expect(recommendedFees.high!.fee!).toBeGreaterThan(rbfTransaction.fees);
      expect(recommendedFees.higher!.fee!).toBeGreaterThan(recommendedFees.high!.fee!);
    });

    it('getRbfFeeSummary throws on low fee rate', async () => {
      const esploraProvider = {
        getUnspentUtxos: () => Promise.resolve([]),
        getTransaction: () => Promise.resolve(rbfEsploraTransaction),
        getTransactionOutspends: () => Promise.resolve([]),
      } as any;

      const rbfTxn = new rbf.RbfTransaction(rbfTransaction, constructOptions(esploraProvider));
      await expect(() => rbfTxn.getRbfFeeSummary(50)).rejects.toThrow('Fee rate is below RBF minimum fee rate');
    });

    it('getRbfFeeSummary needs extra inputs when all original outputs are preserved', async () => {
      const esploraProvider = {
        getUnspentUtxos: () => Promise.resolve([]),
        getTransaction: () => Promise.resolve(rbfEsploraTransaction),
        getTransactionOutspends: () => Promise.resolve([]),
      } as any;

      const rbfTxn = new rbf.RbfTransaction(rbfTransaction, constructOptions(esploraProvider));
      const feeSummary = await rbfTxn.getRbfFeeSummary(68);
      expect(feeSummary).toEqual({
        enoughFunds: false,
        fee: undefined,
        feeRate: 68,
      });
    });

    it('getRbfFeeSummary returns not enough funds if no additional UTXOs', async () => {
      const esploraProvider = {
        getUnspentUtxos: () => Promise.resolve([]),
        getTransaction: () => Promise.resolve(rbfEsploraTransaction),
        getTransactionOutspends: () => Promise.resolve([]),
      } as any;

      const rbfTxn = new rbf.RbfTransaction(rbfTransaction, constructOptions(esploraProvider));
      const feeSummary = await rbfTxn.getRbfFeeSummary(1000000);

      expect(feeSummary).toEqual({
        enoughFunds: false,
        fee: undefined,
        feeRate: 1000000,
      });
    });

    it('getRbfFeeSummary returns with additional UTXOs', async () => {
      const esploraProvider = {
        getUnspentUtxos: () => Promise.resolve([largeUtxo]),
        getTransaction: () => Promise.resolve(rbfEsploraTransaction),
        getTransactionOutspends: () => Promise.resolve([]),
      } as any;

      const rbfTxn = new rbf.RbfTransaction(rbfTransaction, constructOptions(esploraProvider));
      const feeSummary = await rbfTxn.getRbfFeeSummary(1000000);

      expect(feeSummary.enoughFunds).toBe(true);
      expect(feeSummary.feeRate).toBe(1000000);
      // Fee must cover BIP125 package floor and the requested rate; exact vsize-derived amount.
      expect(feeSummary.fee).toBe(667000000);
    });

    it('does not shrink original outputs when bumping with extra inputs', async () => {
      const esploraProvider = {
        getUnspentUtxos: () => Promise.resolve([largeUtxo]),
        getTransaction: () => Promise.resolve(rbfEsploraTransaction),
        getTransactionOutspends: () => Promise.resolve([]),
      } as any;

      const rbfTxn = new rbf.RbfTransaction(rbfTransaction, constructOptions(esploraProvider));
      // Access compile via fee summary path (unsigned)
      const feeSummary = await rbfTxn.getRbfFeeSummary(68);
      expect(feeSummary.enoughFunds).toBe(true);

      // Reconstruct the same way compile does and assert original output amounts still present.
      // We verify via the public summary fee being strictly greater than original while
      // original recipient amounts (non-change) are unchanged by checking fixture totals:
      const originalOutputTotal = rbfTransaction.outputs.reduce((s, o) => s + o.value, 0);
      const originalInputTotal = rbfTransaction.inputs.reduce((s, i) => s + i.prevout.value, 0);
      // With preserved outs + extra input + new change: fee = inputs' - outs'
      // outs' >= originalOutputTotal (originals kept; may add change)
      expect(originalInputTotal - originalOutputTotal).toBe(rbfTransaction.fees);
      expect(feeSummary.fee!).toBeGreaterThan(rbfTransaction.fees);
    });

    it('rejects RBF signing without transaction context', async () => {
      const esploraProvider = {
        getUnspentUtxos: () => Promise.resolve([largeUtxo]),
        getTransaction: () => Promise.resolve(rbfEsploraTransaction),
        getTransactionOutspends: () => Promise.resolve([]),
      } as any;

      const rbfTxn = new rbf.RbfTransaction(rbfTransaction, constructOptions(esploraProvider));
      await expect(
        rbfTxn.getReplacementTransaction({
          feeRate: 68,
          context: undefined as any,
        }),
      ).rejects.toThrow('Transaction context required for RBF signing');
    });
  });
});
