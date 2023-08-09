import { describe, expect, it } from 'vitest';
import { getUniquePendingTx } from 'api/helper';
import { StxMempoolTransactionData, StxTransactionData } from 'types/*';

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
