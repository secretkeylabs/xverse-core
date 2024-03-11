import { beforeEach, describe, expect, it, vi } from 'vitest';

import { btcTransaction } from '../../../transactions';
import { applySendBtcActionsAndFee } from '../../../transactions/bitcoin/actionProcessors';
import {
  extractUsedOutpoints,
  getSortedAvailablePaymentUtxos,
  getTransactionTotals,
  getTransactionVSize,
  getVbytesForIO,
} from '../../../transactions/bitcoin/utils';

vi.mock('../../../transactions/bitcoin/utils');

describe('applySendBtcActionsAndFee', () => {
  const context = {
    changeAddress: 'paymentAddress',
    paymentAddress: {
      address: 'paymentAddress',
      addInput: vi.fn(),
    },
    addOutputAddress: vi.fn(),
  };

  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('throws on insufficient balance for action', async () => {
    const transaction = {
      inputsLength: 2,
      outputsLength: 1,
    };

    vi.mocked(extractUsedOutpoints).mockReturnValueOnce(new Set(['f00d:0', 'f00d:1']));
    vi.mocked(getSortedAvailablePaymentUtxos).mockResolvedValueOnce([]);
    vi.mocked(getTransactionTotals).mockResolvedValueOnce({ inputValue: 3000n, outputValue: 2000n });
    vi.mocked(getVbytesForIO).mockResolvedValueOnce({ inputSize: 100, outputSize: 100 });

    await expect(() =>
      applySendBtcActionsAndFee(
        context as any,
        {},
        transaction as any,
        {},
        [
          {
            type: btcTransaction.ActionType.SEND_BTC,
            toAddress: 'address',
            amount: 2000n,
            combinable: true,
          },
        ],
        10,
      ),
    ).rejects.toThrowError('No more UTXOs to use. Insufficient funds for this transaction');
  });

  it('throws on insufficient balance for fees', async () => {
    const transaction = {
      inputsLength: 2,
      outputsLength: 1,
    };

    vi.mocked(extractUsedOutpoints).mockReturnValueOnce(new Set(['f00d:0', 'f00d:1']));
    vi.mocked(getSortedAvailablePaymentUtxos).mockResolvedValueOnce([]);
    vi.mocked(getTransactionTotals).mockResolvedValueOnce({ inputValue: 3000n, outputValue: 2700n });
    vi.mocked(getVbytesForIO).mockResolvedValueOnce({ inputSize: 100, outputSize: 100 });
    vi.mocked(getTransactionVSize).mockResolvedValueOnce(260);
    vi.mocked(getTransactionVSize).mockResolvedValueOnce(190);

    await expect(() =>
      applySendBtcActionsAndFee(context as any, {}, transaction as any, {}, [], 10),
    ).rejects.toThrowError('No more UTXOs to use. Insufficient funds for this transaction');
  });

  it("doesn't alter the transaction if no actions and enough for fees", async () => {
    const transaction = {
      inputsLength: 2,
      outputsLength: 1,
    };

    vi.mocked(extractUsedOutpoints).mockReturnValueOnce(new Set(['f00d:0', 'f00d:1']));
    vi.mocked(getTransactionTotals).mockResolvedValueOnce({ inputValue: 3000n, outputValue: 1000n });
    vi.mocked(getVbytesForIO).mockResolvedValueOnce({ inputSize: 100, outputSize: 100 });
    vi.mocked(getTransactionVSize).mockResolvedValueOnce(260);
    vi.mocked(getTransactionVSize).mockResolvedValueOnce(190);

    const { inputs, outputs, actualFee } = await applySendBtcActionsAndFee(
      context as any,
      {},
      transaction as any,
      {},
      [],
      10,
    );

    expect(actualFee).toEqual(2000n);
    expect(inputs).toEqual([]);
    expect(outputs).toEqual([]);

    expect(extractUsedOutpoints).toHaveBeenCalledWith(transaction);
    expect(getTransactionTotals).toHaveBeenCalledWith(transaction);
    expect(getSortedAvailablePaymentUtxos).toHaveBeenCalledWith(context, new Set(['f00d:0', 'f00d:1']));
    expect(getVbytesForIO).toHaveBeenCalledWith(context, context.paymentAddress);
  });

  it('adds change if enough output with fees covered', async () => {
    const transaction = {
      inputsLength: 2,
      outputsLength: 1,
    };

    vi.mocked(extractUsedOutpoints).mockReturnValueOnce(new Set(['f00d:0', 'f00d:1']));
    vi.mocked(getTransactionTotals).mockResolvedValueOnce({ inputValue: 3000n, outputValue: 1000n });
    vi.mocked(getVbytesForIO).mockResolvedValueOnce({ inputSize: 100, outputSize: 20 });
    vi.mocked(getTransactionVSize).mockResolvedValueOnce(170);
    vi.mocked(getTransactionVSize).mockResolvedValueOnce(170);

    const { inputs, outputs, actualFee } = await applySendBtcActionsAndFee(
      context as any,
      {},
      transaction as any,
      {},
      [],
      5,
    );

    expect(actualFee).toEqual(850n);
    expect(inputs).toEqual([]);
    expect(outputs).toEqual([{ amount: 1150, address: 'paymentAddress' }]);

    expect(extractUsedOutpoints).toHaveBeenCalledWith(transaction);
    expect(getTransactionTotals).toHaveBeenCalledWith(transaction);
    expect(getSortedAvailablePaymentUtxos).toHaveBeenCalledWith(context, new Set(['f00d:0', 'f00d:1']));
    expect(getVbytesForIO).toHaveBeenCalledWith(context, context.paymentAddress);
    expect(getTransactionVSize).toHaveBeenCalledTimes(2);
    expect(getTransactionVSize).toHaveBeenCalledWith(context, transaction, 'paymentAddress');
    expect(getTransactionVSize).toHaveBeenCalledWith(context, transaction, 'paymentAddress', 1150n);
    expect(context.addOutputAddress).toHaveBeenCalledWith(transaction, 'paymentAddress', 1150n);
  });

  it('uses override change address', async () => {
    const transaction = {
      inputsLength: 2,
      outputsLength: 1,
    };

    vi.mocked(extractUsedOutpoints).mockReturnValueOnce(new Set(['f00d:0', 'f00d:1']));
    vi.mocked(getTransactionTotals).mockResolvedValueOnce({ inputValue: 3000n, outputValue: 1000n });
    vi.mocked(getVbytesForIO).mockResolvedValueOnce({ inputSize: 100, outputSize: 20 });
    vi.mocked(getTransactionVSize).mockResolvedValueOnce(170);
    vi.mocked(getTransactionVSize).mockResolvedValueOnce(170);

    const { inputs, outputs, actualFee } = await applySendBtcActionsAndFee(
      context as any,
      {},
      transaction as any,
      {},
      [],
      5,
      'overrideChangeAddress',
    );

    expect(actualFee).toEqual(850n);
    expect(inputs).toEqual([]);
    expect(outputs).toEqual([{ amount: 1150, address: 'overrideChangeAddress' }]);

    expect(extractUsedOutpoints).toHaveBeenCalledWith(transaction);
    expect(getTransactionTotals).toHaveBeenCalledWith(transaction);
    expect(getSortedAvailablePaymentUtxos).toHaveBeenCalledWith(context, new Set(['f00d:0', 'f00d:1']));
    expect(getVbytesForIO).toHaveBeenCalledWith(context, context.paymentAddress);
    expect(getTransactionVSize).toHaveBeenCalledTimes(2);
    expect(getTransactionVSize).toHaveBeenCalledWith(context, transaction, 'overrideChangeAddress');
    expect(getTransactionVSize).toHaveBeenCalledWith(context, transaction, 'overrideChangeAddress', 1150n);
    expect(context.addOutputAddress).toHaveBeenCalledWith(transaction, 'overrideChangeAddress', 1150n);
  });

  it('adds input UTXO if not enough to cover fees', async () => {
    const transaction = {
      inputsLength: 2,
      outputsLength: 1,
    };

    const dummyUtxo = {
      outpoint: 'f00d:3',
      utxo: {
        value: 10000,
        status: {
          confirmed: true,
        },
      },
    };

    vi.mocked(extractUsedOutpoints).mockReturnValueOnce(new Set(['f00d:0', 'f00d:1']));
    vi.mocked(getSortedAvailablePaymentUtxos).mockResolvedValueOnce([dummyUtxo as any]);
    vi.mocked(getTransactionTotals).mockResolvedValueOnce({ inputValue: 3000n, outputValue: 1000n });
    vi.mocked(getVbytesForIO).mockResolvedValueOnce({ inputSize: 100, outputSize: 20 });
    vi.mocked(getTransactionVSize).mockResolvedValue(210);

    const { inputs, outputs, actualFee } = await applySendBtcActionsAndFee(
      context as any,
      {},
      transaction as any,
      {},
      [],
      10,
    );

    expect(actualFee).toEqual(2100n);
    expect(inputs).toEqual([dummyUtxo]);
    expect(outputs).toEqual([{ amount: 9900, address: 'paymentAddress' }]);

    expect(extractUsedOutpoints).toHaveBeenCalledWith(transaction);
    expect(getTransactionTotals).toHaveBeenCalledWith(transaction);
    expect(getSortedAvailablePaymentUtxos).toHaveBeenCalledWith(context, new Set(['f00d:0', 'f00d:1']));
    expect(getVbytesForIO).toHaveBeenCalledWith(context, context.paymentAddress);
    expect(getTransactionVSize).toHaveBeenCalledTimes(4);
    expect(context.addOutputAddress).toHaveBeenCalledWith(transaction, 'paymentAddress', 9900n);
  });

  it('ignores input UTXO if it is dust at selected fee rate', async () => {
    const transaction = {
      inputsLength: 2,
      outputsLength: 1,
    };

    const dummyDustUtxo = {
      outpoint: 'f00d:3',
      utxo: {
        value: 990,
        status: {
          confirmed: true,
        },
      },
    };
    const dummyUtxo = {
      outpoint: 'f00d:3',
      utxo: {
        value: 10000,
        status: {
          confirmed: true,
        },
      },
    };

    vi.mocked(extractUsedOutpoints).mockReturnValueOnce(new Set(['f00d:0', 'f00d:1']));
    vi.mocked(getSortedAvailablePaymentUtxos).mockResolvedValueOnce([dummyUtxo, dummyDustUtxo] as any);
    vi.mocked(getTransactionTotals).mockResolvedValueOnce({ inputValue: 3000n, outputValue: 1000n });
    vi.mocked(getVbytesForIO).mockResolvedValueOnce({ inputSize: 100, outputSize: 20 });
    vi.mocked(getTransactionVSize).mockResolvedValue(210);

    const { inputs, outputs, actualFee } = await applySendBtcActionsAndFee(
      context as any,
      {},
      transaction as any,
      {},
      [],
      10,
    );

    expect(actualFee).toEqual(2100n);
    expect(inputs).toEqual([dummyUtxo]);
    expect(outputs).toEqual([{ amount: 9900, address: 'paymentAddress' }]);

    expect(extractUsedOutpoints).toHaveBeenCalledWith(transaction);
    expect(getTransactionTotals).toHaveBeenCalledWith(transaction);
    expect(getSortedAvailablePaymentUtxos).toHaveBeenCalledWith(context, new Set(['f00d:0', 'f00d:1']));
    expect(getVbytesForIO).toHaveBeenCalledWith(context, context.paymentAddress);
    expect(getTransactionVSize).toHaveBeenCalledTimes(4);
    expect(context.addOutputAddress).toHaveBeenCalledWith(transaction, 'paymentAddress', 9900n);
  });

  it('uses input UTXO if it is above dust threshold at selected fee rate', async () => {
    const transaction = {
      inputsLength: 2,
      outputsLength: 1,
    };

    const dummyDustUtxo = {
      outpoint: 'f00d:3',
      utxo: {
        value: 990,
        status: {
          confirmed: true,
        },
      },
    };
    const dummyUtxo = {
      outpoint: 'f00d:3',
      utxo: {
        value: 10000,
        status: {
          confirmed: true,
        },
      },
    };

    vi.mocked(extractUsedOutpoints).mockReturnValueOnce(new Set(['f00d:0', 'f00d:1']));
    vi.mocked(getSortedAvailablePaymentUtxos).mockResolvedValueOnce([dummyUtxo, dummyDustUtxo] as any);
    vi.mocked(getTransactionTotals).mockResolvedValueOnce({ inputValue: 3000n, outputValue: 1000n });
    vi.mocked(getVbytesForIO).mockResolvedValueOnce({ inputSize: 90, outputSize: 20 });
    vi.mocked(getTransactionVSize).mockResolvedValue(210);

    const { inputs, outputs, actualFee } = await applySendBtcActionsAndFee(
      context as any,
      {},
      transaction as any,
      {},
      [],
      10,
    );

    expect(actualFee).toEqual(2100n);
    expect(inputs).toEqual([dummyDustUtxo]);
    expect(outputs).toEqual([{ amount: 890, address: 'paymentAddress' }]);

    expect(extractUsedOutpoints).toHaveBeenCalledWith(transaction);
    expect(getTransactionTotals).toHaveBeenCalledWith(transaction);
    expect(getSortedAvailablePaymentUtxos).toHaveBeenCalledWith(context, new Set(['f00d:0', 'f00d:1']));
    expect(getVbytesForIO).toHaveBeenCalledWith(context, context.paymentAddress);
    expect(getTransactionVSize).toHaveBeenCalledTimes(4);
    expect(context.addOutputAddress).toHaveBeenCalledWith(transaction, 'paymentAddress', 890n);
  });

  it('uses unconfirmed UTXO if necessary and ignores dust', async () => {
    const transaction = {
      inputsLength: 2,
      outputsLength: 1,
    };

    const dummyDustUtxo = {
      outpoint: 'f00d:2',
      utxo: {
        value: 546,
        status: {
          confirmed: true,
        },
      },
    };
    const dummyUtxo = {
      outpoint: 'f00d:3',
      utxo: {
        value: 10000,
        status: {
          confirmed: false,
        },
      },
    };

    vi.mocked(extractUsedOutpoints).mockReturnValueOnce(new Set(['f00d:0', 'f00d:1']));
    vi.mocked(getSortedAvailablePaymentUtxos).mockResolvedValueOnce([dummyUtxo, dummyDustUtxo] as any);
    vi.mocked(getTransactionTotals).mockResolvedValueOnce({ inputValue: 3000n, outputValue: 10000n });
    vi.mocked(getVbytesForIO).mockResolvedValueOnce({ inputSize: 90, outputSize: 20 });
    vi.mocked(getTransactionVSize).mockResolvedValue(210);

    const { inputs, outputs, actualFee } = await applySendBtcActionsAndFee(
      context as any,
      {},
      transaction as any,
      { allowUnconfirmedInput: true },
      [],
      10,
    );

    expect(actualFee).toEqual(2100n);
    expect(inputs).toEqual([dummyUtxo]);
    expect(outputs).toEqual([{ amount: 900, address: 'paymentAddress' }]);

    expect(extractUsedOutpoints).toHaveBeenCalledWith(transaction);
    expect(getTransactionTotals).toHaveBeenCalledWith(transaction);
    expect(getSortedAvailablePaymentUtxos).toHaveBeenCalledWith(context, new Set(['f00d:0', 'f00d:1']));
    expect(getVbytesForIO).toHaveBeenCalledWith(context, context.paymentAddress);
    expect(getTransactionVSize).toHaveBeenCalledTimes(2);
    expect(context.addOutputAddress).toHaveBeenCalledWith(transaction, 'paymentAddress', 900n);
  });

  it('throws if only unconfirmed UTXO and dust available but use unconfirmed is false', async () => {
    const transaction = {
      inputsLength: 2,
      outputsLength: 1,
    };

    const dummyDustUtxo = {
      outpoint: 'f00d:2',
      utxo: {
        value: 546,
        status: {
          confirmed: true,
        },
      },
    };
    const dummyUtxo = {
      outpoint: 'f00d:3',
      utxo: {
        value: 10000,
        status: {
          confirmed: false,
        },
      },
    };

    vi.mocked(extractUsedOutpoints).mockReturnValueOnce(new Set(['f00d:0', 'f00d:1']));
    vi.mocked(getSortedAvailablePaymentUtxos).mockResolvedValueOnce([dummyUtxo, dummyDustUtxo] as any);
    vi.mocked(getTransactionTotals).mockResolvedValueOnce({ inputValue: 3000n, outputValue: 10000n });
    vi.mocked(getVbytesForIO).mockResolvedValueOnce({ inputSize: 90, outputSize: 20 });
    vi.mocked(getTransactionVSize).mockResolvedValue(210);

    await expect(() =>
      applySendBtcActionsAndFee(context as any, {}, transaction as any, { allowUnconfirmedInput: false }, [], 10),
    ).rejects.toThrowError('No more UTXOs to use. Insufficient funds for this transaction');
  });

  it('compiles correct outputs from actions', async () => {
    const transaction = {
      inputsLength: 2,
      outputsLength: 1,
    };

    const dummyDustUtxo = {
      outpoint: 'f00d:3',
      utxo: {
        value: 990,
        status: {
          confirmed: true,
        },
      },
    };
    const dummyUtxo = {
      outpoint: 'f00d:3',
      utxo: {
        value: 10000,
        status: {
          confirmed: true,
        },
      },
    };

    vi.mocked(extractUsedOutpoints).mockReturnValueOnce(new Set(['f00d:0', 'f00d:1']));
    vi.mocked(getSortedAvailablePaymentUtxos).mockResolvedValueOnce([dummyUtxo, dummyDustUtxo] as any);
    vi.mocked(getTransactionTotals).mockResolvedValueOnce({ inputValue: 3000n, outputValue: 1000n });
    vi.mocked(getVbytesForIO).mockResolvedValueOnce({ inputSize: 90, outputSize: 20 });
    vi.mocked(getTransactionVSize).mockResolvedValue(210);

    const { inputs, outputs, actualFee } = await applySendBtcActionsAndFee(
      context as any,
      {},
      transaction as any,
      {},
      [
        {
          type: btcTransaction.ActionType.SEND_BTC,
          toAddress: 'address',
          amount: 1000n,
          combinable: true,
        },
        {
          type: btcTransaction.ActionType.SEND_BTC,
          toAddress: 'address3',
          amount: 900n,
          combinable: false,
        },
        {
          type: btcTransaction.ActionType.SEND_BTC,
          toAddress: 'address',
          amount: 2000n,
          combinable: true,
        },
        {
          type: btcTransaction.ActionType.SEND_BTC,
          toAddress: 'address2',
          amount: 500n,
          combinable: true,
        },
        {
          type: btcTransaction.ActionType.SEND_BTC,
          toAddress: 'address',
          amount: 1000n,
          combinable: false,
        },
        {
          type: btcTransaction.ActionType.SEND_BTC,
          toAddress: 'address2',
          amount: 2000n,
          combinable: true,
        },
      ],
      10,
    );

    expect(actualFee).toEqual(2100n);
    expect(inputs).toEqual([dummyDustUtxo, dummyUtxo]);
    expect(outputs).toEqual([
      { amount: 3000, address: 'address' },
      { amount: 1000, address: 'address' },
      { amount: 900, address: 'address3' },
      { amount: 2500, address: 'address2' },
      // change
      {
        address: 'paymentAddress',
        amount: 3490,
      },
    ]);

    expect(extractUsedOutpoints).toHaveBeenCalledWith(transaction);
    expect(getTransactionTotals).toHaveBeenCalledWith(transaction);
    expect(getSortedAvailablePaymentUtxos).toHaveBeenCalledWith(context, new Set(['f00d:0', 'f00d:1']));
    expect(getVbytesForIO).toHaveBeenCalledWith(context, context.paymentAddress);
    expect(context.addOutputAddress).toHaveBeenCalledWith(transaction, 'address', 3000n);
    expect(context.addOutputAddress).toHaveBeenCalledWith(transaction, 'address', 1000n);
    expect(context.addOutputAddress).toHaveBeenCalledWith(transaction, 'address3', 900n);
    expect(context.addOutputAddress).toHaveBeenCalledWith(transaction, 'address2', 2500n);
    expect(context.addOutputAddress).toHaveBeenCalledWith(transaction, 'paymentAddress', 3490n);
  });
});
