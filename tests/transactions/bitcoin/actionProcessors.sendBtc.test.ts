import { beforeEach, describe, expect, it, vi } from 'vitest';

import { btcTransaction } from '../../../transactions';
import { applySendBtcActionsAndFee } from '../../../transactions/bitcoin/actionProcessors';
import {
  extractUsedOutpoints,
  getSortedAvailablePaymentUtxos,
  getTransactionTotals,
  getTransactionVSize,
} from '../../../transactions/bitcoin/utils';

vi.mock('../../../transactions/bitcoin/utils');

describe('applySendBtcActionsAndFee', () => {
  const context = {
    changeAddress: 'paymentAddress',
    paymentAddress: {
      address: 'paymentAddress',
      addInput: vi.fn(),
      getIOSizes: () => ({ inputSize: 91, outputSize: 32 }),
    },
    addOutputAddress: vi.fn(),
  };

  beforeEach(() => {
    vi.resetAllMocks();

    context.addOutputAddress.mockResolvedValue({
      script: ['DUMMY_SCRIPT'],
      scriptHex: 'DUMMY_SCRIPT_HEX',
    });
  });

  it('throws on insufficient balance for action', async () => {
    const transaction = {
      inputsLength: 2,
      outputsLength: 1,
    };

    vi.mocked(extractUsedOutpoints).mockReturnValueOnce(new Set(['f00d:0', 'f00d:1']));
    vi.mocked(getSortedAvailablePaymentUtxos).mockResolvedValue([]);
    vi.mocked(getTransactionTotals).mockResolvedValueOnce({ inputValue: 3000n, outputValue: 2000n });

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
    vi.mocked(getSortedAvailablePaymentUtxos).mockResolvedValue([]);
    vi.mocked(getTransactionTotals).mockResolvedValueOnce({ inputValue: 3000n, outputValue: 2700n });
    vi.mocked(getTransactionVSize).mockReturnValueOnce(260);
    vi.mocked(getTransactionVSize).mockReturnValueOnce(190);

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
    vi.mocked(getSortedAvailablePaymentUtxos).mockResolvedValue([]);
    vi.mocked(getTransactionVSize).mockReturnValueOnce(190);
    vi.mocked(getTransactionVSize).mockReturnValueOnce(260);
    vi.mocked(getTransactionVSize).mockReturnValueOnce(190);

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
    expect(getSortedAvailablePaymentUtxos).toHaveBeenCalledWith(context, new Set(['f00d:0', 'f00d:1']), true, 910);
    expect(getSortedAvailablePaymentUtxos).toHaveBeenCalledWith(context, new Set(['f00d:0', 'f00d:1']), false, 910);
  });

  it('adds change if enough output with fees covered', async () => {
    const transaction = {
      inputsLength: 2,
      outputsLength: 1,
    };

    vi.mocked(extractUsedOutpoints).mockReturnValueOnce(new Set(['f00d:0', 'f00d:1']));
    vi.mocked(getTransactionTotals).mockResolvedValueOnce({ inputValue: 3000n, outputValue: 1000n });
    vi.mocked(getSortedAvailablePaymentUtxos).mockResolvedValue([]);
    vi.mocked(getTransactionVSize).mockReturnValueOnce(100);
    vi.mocked(getTransactionVSize).mockReturnValueOnce(170);
    vi.mocked(getTransactionVSize).mockReturnValueOnce(170);

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
    expect(outputs).toEqual([{ amount: 1150, address: 'paymentAddress', type: 'address' }]);

    expect(extractUsedOutpoints).toHaveBeenCalledWith(transaction);
    expect(getTransactionTotals).toHaveBeenCalledWith(transaction);
    expect(getTransactionVSize).toHaveBeenCalledTimes(3);
    expect(getTransactionVSize).toHaveBeenCalledWith(context, transaction);
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
    vi.mocked(getSortedAvailablePaymentUtxos).mockResolvedValue([]);
    vi.mocked(getTransactionVSize).mockReturnValueOnce(100);
    vi.mocked(getTransactionVSize).mockReturnValueOnce(170);
    vi.mocked(getTransactionVSize).mockReturnValueOnce(170);

    const { inputs, outputs, actualFee } = await applySendBtcActionsAndFee(
      context as any,
      {},
      transaction as any,
      {
        overrideChangeAddress: 'overrideChangeAddress',
      },
      [],
      5,
    );

    expect(actualFee).toEqual(850n);
    expect(inputs).toEqual([]);
    expect(outputs).toEqual([{ amount: 1150, address: 'overrideChangeAddress', type: 'address' }]);

    expect(extractUsedOutpoints).toHaveBeenCalledWith(transaction);
    expect(getTransactionTotals).toHaveBeenCalledWith(transaction);
    expect(getTransactionVSize).toHaveBeenCalledTimes(3);
    expect(getTransactionVSize).toHaveBeenCalledWith(context, transaction);
    expect(getTransactionVSize).toHaveBeenCalledWith(context, transaction, 'overrideChangeAddress');
    expect(getTransactionVSize).toHaveBeenCalledWith(context, transaction, 'overrideChangeAddress', 1150n);
    expect(context.addOutputAddress).toHaveBeenCalledWith(transaction, 'overrideChangeAddress', 1150n);
  });

  it('adds input UTXO if not enough to cover fees', async () => {
    const transaction = {
      inputsLength: 2,
      outputsLength: 1,
    } as any;

    transaction.clone = () => transaction;

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
    vi.mocked(getTransactionVSize).mockReturnValue(210);

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
    expect(outputs).toEqual([{ amount: 9900, address: 'paymentAddress', type: 'address' }]);

    expect(extractUsedOutpoints).toHaveBeenCalledWith(transaction);
    expect(getTransactionTotals).toHaveBeenCalledWith(transaction);
    expect(getTransactionVSize).toHaveBeenCalledTimes(4);
    expect(context.addOutputAddress).toHaveBeenCalledWith(transaction, 'paymentAddress', 9900n);
  });

  it('uses unconfirmed UTXOs if necessary', async () => {
    const transaction = {
      inputsLength: 2,
      outputsLength: 1,
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
    vi.mocked(getSortedAvailablePaymentUtxos).mockResolvedValueOnce([]);
    vi.mocked(getSortedAvailablePaymentUtxos).mockResolvedValueOnce([dummyUtxo] as any);
    vi.mocked(getTransactionTotals).mockResolvedValueOnce({ inputValue: 3000n, outputValue: 10000n });
    vi.mocked(getTransactionVSize).mockReturnValue(210);

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
    expect(outputs).toEqual([{ amount: 900, address: 'paymentAddress', type: 'address' }]);

    expect(extractUsedOutpoints).toHaveBeenCalledWith(transaction);
    expect(getTransactionTotals).toHaveBeenCalledWith(transaction);
    expect(getSortedAvailablePaymentUtxos).toHaveBeenCalledWith(context, new Set(['f00d:0', 'f00d:1']), true, 910);
    expect(getSortedAvailablePaymentUtxos).toHaveBeenCalledWith(context, new Set(['f00d:0', 'f00d:1']), false, 910);
    expect(getTransactionVSize).toHaveBeenCalledTimes(3);
    expect(context.addOutputAddress).toHaveBeenCalledWith(transaction, 'paymentAddress', 900n);
  });

  it('throws if only unconfirmed UTXO and dust available but use unconfirmed is false', async () => {
    const transaction = {
      inputsLength: 2,
      outputsLength: 1,
    };

    vi.mocked(extractUsedOutpoints).mockReturnValueOnce(new Set(['f00d:0', 'f00d:1']));
    vi.mocked(getSortedAvailablePaymentUtxos).mockResolvedValue([]);
    vi.mocked(getTransactionTotals).mockResolvedValueOnce({ inputValue: 3000n, outputValue: 10000n });
    vi.mocked(getTransactionVSize).mockReturnValue(210);

    await expect(() =>
      applySendBtcActionsAndFee(context as any, {}, transaction as any, { allowUnconfirmedInput: false }, [], 10),
    ).rejects.toThrowError('No more UTXOs to use. Insufficient funds for this transaction');
    expect(getSortedAvailablePaymentUtxos).toHaveBeenCalledTimes(1);
  });

  it('compiles correct outputs from actions', async () => {
    const transaction = {
      inputsLength: 2,
      outputsLength: 1,
    } as any;

    transaction.clone = () => transaction;

    const dummyUtxo1 = {
      outpoint: 'f00d:3',
      utxo: {
        value: 990,
        status: {
          confirmed: true,
        },
      },
    };
    const dummyUtxo2 = {
      outpoint: 'f00d:3',
      utxo: {
        value: 10000,
        status: {
          confirmed: true,
        },
      },
    };

    vi.mocked(extractUsedOutpoints).mockReturnValueOnce(new Set(['f00d:0', 'f00d:1']));
    vi.mocked(getSortedAvailablePaymentUtxos).mockResolvedValueOnce([dummyUtxo1, dummyUtxo2] as any);
    vi.mocked(getTransactionTotals).mockResolvedValueOnce({ inputValue: 3000n, outputValue: 8400n });
    vi.mocked(getTransactionVSize).mockReturnValue(210);

    const { inputs, outputs, actualFee } = await applySendBtcActionsAndFee(
      context as any,
      {},
      transaction,
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
    expect(inputs).toEqual([dummyUtxo2]);
    expect(outputs).toEqual([
      { amount: 3000, address: 'address', type: 'address' },
      { amount: 1000, address: 'address', type: 'address' },
      { amount: 900, address: 'address3', type: 'address' },
      { amount: 2500, address: 'address2', type: 'address' },
      // change
      {
        address: 'paymentAddress',
        amount: 2500,
        type: 'address',
      },
    ]);

    expect(extractUsedOutpoints).toHaveBeenCalledWith(transaction);
    expect(getTransactionTotals).toHaveBeenCalledWith(transaction);
    expect(getSortedAvailablePaymentUtxos).toHaveBeenCalledWith(context, new Set(['f00d:0', 'f00d:1']), true, 910);
    expect(context.addOutputAddress).toHaveBeenCalledWith(transaction, 'address', 3000n);
    expect(context.addOutputAddress).toHaveBeenCalledWith(transaction, 'address', 1000n);
    expect(context.addOutputAddress).toHaveBeenCalledWith(transaction, 'address3', 900n);
    expect(context.addOutputAddress).toHaveBeenCalledWith(transaction, 'address2', 2500n);
    expect(context.addOutputAddress).toHaveBeenCalledWith(transaction, 'paymentAddress', 2500n);
  });
});
