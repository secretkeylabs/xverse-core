import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as StacksTransactions from '@stacks/transactions';
import { StacksNetwork } from '@stacks/network';
import * as TransactionUtils from '../../transactions';
import * as APIUtils from '../../api';

const mockTransaction = {
  payload: {
    payloadType: StacksTransactions.PayloadType.ContractCall,
  },
} as StacksTransactions.StacksTransaction;

vi.mock('@stacks/transactions');

vi.mock('../../api');

const mockNetwork = {} as StacksNetwork;

describe('estimateStacksTransactionWithFallback', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });
  it('should return estimated fees when estimation is successful', async () => {
    vi.spyOn(StacksTransactions, 'estimateTransactionByteLength').mockReturnValue(100);
    vi.spyOn(StacksTransactions, 'estimateTransaction').mockImplementation(async () => [
      { fee: 100, fee_rate: 1 },
      { fee: 200, fee_rate: 1 },
      { fee: 300, fee_rate: 1 },
    ]);

    const result = await TransactionUtils.estimateStacksTransactionWithFallback(mockTransaction, mockNetwork);
    expect(result).toEqual([
      { fee: 100, fee_rate: 1 },
      { fee: 200, fee_rate: 1 },
      { fee: 300, fee_rate: 1 },
    ]);
    expect(StacksTransactions.estimateTransactionByteLength).toHaveBeenCalledWith(mockTransaction);
    expect(StacksTransactions.estimateTransaction).toHaveBeenCalledWith(mockTransaction.payload, 100, mockNetwork);
  });

  it('should return mempool fees for ContractCall when estimation fails', async () => {
    vi.spyOn(StacksTransactions, 'estimateTransaction').mockRejectedValueOnce(new Error('NoEstimateAvailable'));
    vi.spyOn(APIUtils, 'getMempoolFeePriorities').mockResolvedValueOnce({
      contract_call: {
        low_priority: 46,
        medium_priority: 120,
        high_priority: 222,
        no_priority: 0,
      },
      all: {
        low_priority: 40,
        medium_priority: 90,
        high_priority: 200,
        no_priority: 0,
      },
      smart_contract: {
        low_priority: 50,
        medium_priority: 100,
        high_priority: 150,
        no_priority: 0,
      },
      token_transfer: {
        low_priority: 50,
        medium_priority: 100,
        high_priority: 150,
        no_priority: 0,
      },
    });

    const result = await TransactionUtils.estimateStacksTransactionWithFallback(mockTransaction, mockNetwork);
    expect(result).toEqual([{ fee: 46 }, { fee: 120 }, { fee: 222 }]);
    expect(StacksTransactions.estimateTransactionByteLength).toHaveBeenCalledWith(mockTransaction);
    expect(StacksTransactions.estimateTransaction).toHaveBeenCalledWith(mockTransaction.payload, 100, mockNetwork);
    expect(APIUtils.getMempoolFeePriorities).toHaveBeenCalledWith(mockNetwork);
  });

  it('should return mempool fees for TokenTransfer when estimation fails', async () => {
    const mockTransactionTokenTransfer = {
      payload: {
        payloadType: StacksTransactions.PayloadType.TokenTransfer,
      },
    } as StacksTransactions.StacksTransaction;
    vi.spyOn(StacksTransactions, 'estimateTransaction').mockRejectedValueOnce(new Error('NoEstimateAvailable'));
    vi.spyOn(APIUtils, 'getMempoolFeePriorities').mockResolvedValueOnce({
      contract_call: {
        low_priority: 46,
        medium_priority: 120,
        high_priority: 222,
        no_priority: 0,
      },
      all: {
        low_priority: 40,
        medium_priority: 90,
        high_priority: 200,
        no_priority: 0,
      },
      smart_contract: {
        low_priority: 50,
        medium_priority: 100,
        high_priority: 150,
        no_priority: 0,
      },
      token_transfer: {
        low_priority: 55,
        medium_priority: 200,
        high_priority: 300,
        no_priority: 0,
      },
    });

    const result = await TransactionUtils.estimateStacksTransactionWithFallback(
      mockTransactionTokenTransfer,
      mockNetwork,
    );
    expect(result).toEqual([{ fee: 55 }, { fee: 200 }, { fee: 300 }]);
    expect(StacksTransactions.estimateTransactionByteLength).toHaveBeenCalledWith(mockTransactionTokenTransfer);
    expect(StacksTransactions.estimateTransaction).toHaveBeenCalledWith(
      mockTransactionTokenTransfer.payload,
      100,
      mockNetwork,
    );
    expect(APIUtils.getMempoolFeePriorities).toHaveBeenCalledWith(mockNetwork);
  });

  it('should return general mempool fees when specific ones are not available', async () => {
    const mockTransactionTenure = {
      payload: {
        payloadType: StacksTransactions.PayloadType.TenureChange,
      },
    } as StacksTransactions.StacksTransaction;
    vi.spyOn(StacksTransactions, 'estimateTransaction').mockRejectedValueOnce(new Error('NoEstimateAvailable'));
    vi.spyOn(APIUtils, 'getMempoolFeePriorities').mockResolvedValueOnce({
      contract_call: {
        low_priority: 50,
        medium_priority: 100,
        high_priority: 150,
        no_priority: 0,
      },
      all: {
        low_priority: 40,
        medium_priority: 90,
        high_priority: 200,
        no_priority: 0,
      },
      smart_contract: {
        low_priority: 50,
        medium_priority: 100,
        high_priority: 150,
        no_priority: 0,
      },
      token_transfer: {
        low_priority: 50,
        medium_priority: 100,
        high_priority: 150,
        no_priority: 0,
      },
    });

    const result = await TransactionUtils.estimateStacksTransactionWithFallback(mockTransactionTenure, mockNetwork);
    expect(result).toEqual([{ fee: 40 }, { fee: 90 }, { fee: 200 }]);
    expect(StacksTransactions.estimateTransactionByteLength).toHaveBeenCalledWith(mockTransactionTenure);
    expect(StacksTransactions.estimateTransaction).toHaveBeenCalledWith(
      mockTransactionTenure.payload,
      100,
      mockNetwork,
    );
    expect(APIUtils.getMempoolFeePriorities).toHaveBeenCalledWith(mockNetwork);
  });
});
