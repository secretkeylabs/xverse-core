import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as StacksTransactions from '@stacks/transactions';
import { StacksNetwork } from '@stacks/network';
import * as TransactionUtils from '../../../transactions';
import * as APIUtils from '../../../api';
import { TransactionTypes } from '@stacks/connect';
import { walletAccounts } from '../../mocks/restore.mock';
import { AppInfo, StacksMainnet, StacksTestnet } from '../../../types';

vi.mock('./fees');
vi.mock('@stacks/transactions');

vi.mock('../../api');

const mockNetwork = {} as StacksNetwork;

describe('stxFeeReducer', () => {
  [
    {
      name: 'returns initialFee when no appInfo',
      inputs: { initialFee: BigInt(3), appInfo: null },
      expectedFee: BigInt(3),
    },
    {
      name: 'returns initialFee when no send multiplier and no threshold',
      inputs: {
        initialFee: BigInt(3),
        appInfo: {
          stxSendTxMultiplier: undefined,
          thresholdHighStacksFee: undefined,
        } as unknown as AppInfo,
      },
      expectedFee: BigInt(3),
    },
    {
      name: 'returns fee with multiplier applied if under threshold',
      inputs: {
        initialFee: BigInt(1),
        appInfo: {
          stxSendTxMultiplier: 3,
          thresholdHighStacksFee: 6,
        } as unknown as AppInfo,
      },
      expectedFee: BigInt(3),
    },
    {
      name: 'returns intialFee unmodified if multiplier is not an integer',
      inputs: {
        initialFee: BigInt(1),
        appInfo: {
          stxSendTxMultiplier: 0.5,
          thresholdHighStacksFee: 6,
        } as unknown as AppInfo,
      },
      expectedFee: BigInt(1),
    },
    {
      name: 'returns threshold fee if initialFee is higher',
      inputs: {
        initialFee: BigInt(10),
        appInfo: {
          stxSendTxMultiplier: 1,
          thresholdHighStacksFee: 6,
        } as unknown as AppInfo,
      },
      expectedFee: BigInt(6),
    },
    {
      name: 'returns threshold fee if fee after multiplier is higher',
      inputs: {
        initialFee: BigInt(2),
        appInfo: {
          stxSendTxMultiplier: 4,
          thresholdHighStacksFee: 6,
        } as unknown as AppInfo,
      },
      expectedFee: BigInt(6),
    },
  ].forEach(({ name, inputs, expectedFee }) => {
    it(name, () => {
      expect(TransactionUtils.stxFeeReducer(inputs)).toEqual(expectedFee);
    });
  });
});

describe('estimateStacksTransactionWithFallback', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return estimated fees when estimation is successful', async () => {
    const transaction = await TransactionUtils.generateUnsignedTx({
      payload: {
        amount: '102',
        memo: 'From demo app',
        network: StacksTestnet,
        publicKey: '034d917f6eb23798ff1dcfba8665f4542a1ea957e7b6587d79797a595c5bfba2f6',
        recipient: 'ST1X6M947Z7E58CNE0H8YJVJTVKS9VW0PHEG3NHN3',
        stxAddress: 'ST143SNE1S5GHKR9JN89BEVFK9W03S1FSNZ4RCVAY',
        txType: TransactionTypes.STXTransfer,
      },
      publicKey: walletAccounts[0].stxPublicKey,
      fee: 0,
      nonce: 0n,
    });
    console.log('first transaction', transaction);
    vi.spyOn(StacksTransactions, 'estimateTransactionByteLength').mockReturnValue(100);
    vi.spyOn(StacksTransactions, 'fetchFeeEstimateTransaction').mockImplementation(async () => [
      { fee: 100, fee_rate: 1 },
      { fee: 200, fee_rate: 1 },
      { fee: 300, fee_rate: 1 },
    ]);

    const result = await TransactionUtils.estimateStacksTransactionWithFallback(transaction, mockNetwork);
    expect(result).toEqual([
      { fee: 100, fee_rate: 1 },
      { fee: 200, fee_rate: 1 },
      { fee: 300, fee_rate: 1 },
    ]);
    expect(StacksTransactions.estimateTransactionByteLength).toHaveBeenCalledWith(transaction);
    expect(StacksTransactions.fetchFeeEstimateTransaction).toHaveBeenCalledWith(transaction.payload, 100, mockNetwork);
  });

  it('should return mempool fees for ContractCall when estimation fails', async () => {
    const contractAddress = 'SP3K8BC0PPEVCV7NZ6QSRWPQ2JE9E5B6N3PA0KBR9';
    const contractName = 'amm-swap-pool-v1-1';
    const functionName = 'get-value';
    const functionArgs = [
      '0616e685b016b3b6cd9ebf35f38e5ae29392e2acd51d0a746f6b656e2d77737478',
      '0616e685b016b3b6cd9ebf35f38e5ae29392e2acd51d176167653030302d676f7665726e616e63652d746f6b656e',
      '0100000000000000000000000005f5e100',
      '0100000000000000000000000002faf080',
      '0a010000000000000000000000001a612f25',
    ];

    const transaction = await TransactionUtils.generateUnsignedContractCallTx({
      payload: {
        txType: TransactionTypes.ContractCall,
        contractAddress,
        contractName,
        functionName,
        functionArgs,
        publicKey: walletAccounts[0].stxPublicKey,
        postConditions: [
          '000216483cd5c1c96119e132aa12b76df34f003c85f9af01000000000007a120',
          // eslint-disable-next-line max-len
          '010316e685b016b3b6cd9ebf35f38e5ae29392e2acd51d0f616c65782d7661756c742d76312d3116e685b016b3b6cd9ebf35f38e5ae29392e2acd51d176167653030302d676f7665726e616e63652d746f6b656e04616c657803000000001a612f25',
        ],
        network: StacksMainnet,
        postConditionMode: StacksTransactions.PostConditionMode.Allow,
      },
      publicKey: walletAccounts[0].stxPublicKey,
      fee: 0,
      nonce: 1n,
    });
    vi.spyOn(StacksTransactions, 'fetchFeeEstimateTransaction').mockRejectedValueOnce(new Error('NoEstimateAvailable'));
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

    const result = await TransactionUtils.estimateStacksTransactionWithFallback(transaction, mockNetwork);
    expect(result).toEqual([{ fee: 46 }, { fee: 120 }, { fee: 222 }]);
    expect(StacksTransactions.estimateTransactionByteLength).toHaveBeenCalledWith(transaction);
    expect(StacksTransactions.fetchFeeEstimateTransaction).toHaveBeenCalledWith(transaction.payload, 100, mockNetwork);
    expect(APIUtils.getMempoolFeePriorities).toHaveBeenCalledWith(mockNetwork);
  });

  it('should return mempool fees for TokenTransfer when estimation fails', async () => {
    const mockTransactionTokenTransfer = {
      payload: {
        payloadType: StacksTransactions.PayloadType.TokenTransfer,
      },
    } as StacksTransactions.StacksTransactionWire;
    vi.spyOn(StacksTransactions, 'fetchFeeEstimateTransaction').mockRejectedValueOnce(new Error('NoEstimateAvailable'));
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
    expect(StacksTransactions.fetchFeeEstimateTransaction).toHaveBeenCalledWith(
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
    } as StacksTransactions.StacksTransactionWire;
    vi.spyOn(StacksTransactions, 'fetchFeeEstimateTransaction').mockRejectedValueOnce(new Error('NoEstimateAvailable'));
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
    expect(StacksTransactions.fetchFeeEstimateTransaction).toHaveBeenCalledWith(
      mockTransactionTenure.payload,
      100,
      mockNetwork,
    );
    expect(APIUtils.getMempoolFeePriorities).toHaveBeenCalledWith(mockNetwork);
  });
});
