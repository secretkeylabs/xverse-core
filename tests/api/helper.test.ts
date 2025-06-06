import { describe, expect, it } from 'vitest';
import { getUniquePendingTx, parseStxTransactionData } from '../../api/helper';
import {
  StxMempoolTransactionData,
  StxTransactionData,
  StxTransactionDataResponse,
  TransactionType,
} from '../../types';

describe('getUniquePendingTx', () => {
  [
    {
      name: 'returns empty for no pending transactions',
      inputs: {
        confirmedTransactions: [
          { senderAddress: 'address1', txid: 'tx1' } as StxTransactionData,
          { senderAddress: 'address1', txid: 'tx2' } as StxTransactionData,
        ],
        pendingTransactions: [],
      },
      expected: [],
    },
    {
      name: 'returns pending transactions not also seen in confirmed transactions',
      inputs: {
        confirmedTransactions: [
          { senderAddress: 'address1', txid: 'tx1' } as StxTransactionData,
          { senderAddress: 'address1', txid: 'tx2' } as StxTransactionData,
        ],
        pendingTransactions: [
          { senderAddress: 'address1', txid: 'tx2' } as StxMempoolTransactionData,
          { senderAddress: 'address1', txid: 'tx3' } as StxMempoolTransactionData,
        ],
      },
      expected: [{ senderAddress: 'address1', txid: 'tx3' } as StxMempoolTransactionData],
    },
    {
      name: 'returns unique pending transactions not also seen in confirmed transactions',
      inputs: {
        confirmedTransactions: [
          { senderAddress: 'address1', txid: 'tx1' } as StxTransactionData,
          { senderAddress: 'address1', txid: 'tx2' } as StxTransactionData,
        ],
        pendingTransactions: [
          { senderAddress: 'address1', txid: 'tx2' } as StxMempoolTransactionData,
          { senderAddress: 'address1', txid: 'tx3' } as StxMempoolTransactionData,
          { senderAddress: 'address1', txid: 'tx3' } as StxMempoolTransactionData,
        ],
      },
      expected: [{ senderAddress: 'address1', txid: 'tx3' } as StxMempoolTransactionData],
    },
    {
      name: 'returns only pending transactions which are not incoming',
      inputs: {
        confirmedTransactions: [
          { senderAddress: 'address1', txid: 'tx1' } as StxTransactionData,
          { senderAddress: 'address1', txid: 'tx2' } as StxTransactionData,
        ],
        pendingTransactions: [
          { senderAddress: 'address1', txid: 'tx2' } as StxMempoolTransactionData,
          { senderAddress: 'address1', txid: 'tx3' } as StxMempoolTransactionData,
          { senderAddress: 'address1', txid: 'tx3' } as StxMempoolTransactionData,
          { senderAddress: 'address1', txid: 'tx4', incoming: true } as StxMempoolTransactionData,
        ],
      },
      expected: [{ senderAddress: 'address1', txid: 'tx3' } as StxMempoolTransactionData],
    },
  ].forEach(({ name, inputs, expected }) => {
    it(name, () => {
      expect(getUniquePendingTx(inputs)).toEqual(expected);
    });
  });
});

describe('parseStxTransactionData', () => {
  it('does not throw if post condition has no asset', () => {
    const inputs = {
      responseTx: {
        tx_type: 'contract_call' as TransactionType,
        contract_call: {
          function_name: 'transfer',
        },
        post_conditions: [
          {
            type: '',
            amount: 0,
          },
        ],
      } as unknown as StxTransactionDataResponse,
      stxAddress: 'address1',
    };
    expect(() => parseStxTransactionData(inputs)).not.toThrow();
  });
});
