import { describe, expect, it, vi } from 'vitest';

import { btcTransaction } from '../../../transactions';
import { applySendUtxoActions } from '../../../transactions/bitcoin/actionProcessors';

describe('applySendUtxoActions', () => {
  it('throws if excluded utxo is used for send', async () => {
    await expect(() =>
      applySendUtxoActions({} as any, { excludeOutpointList: ['txid:0'] }, { inputsLength: 0 } as any, [
        {
          type: btcTransaction.ActionType.SEND_UTXO,
          outpoint: 'txid:0',
          toAddress: 'address',
        },
      ]),
    ).rejects.toThrow('UTXO excluded but used in send UTXO action: txid:0');
  });

  it('throws if utxo not found', async () => {
    const context = {
      getUtxo: vi.fn(),
    };
    context.getUtxo.mockResolvedValueOnce({});

    await expect(() =>
      applySendUtxoActions(context as any, {}, { inputsLength: 0 } as any, [
        {
          type: btcTransaction.ActionType.SEND_UTXO,
          outpoint: 'txid:0',
          toAddress: 'address',
        },
      ]),
    ).rejects.toThrow('UTXO not found: txid:0');

    expect(context.getUtxo).toHaveBeenCalledWith('txid:0');
  });

  it('throws if utxo used in previous input', async () => {
    const context = {
      getUtxo: vi.fn(),
    };
    context.getUtxo.mockResolvedValueOnce({ addressContext: {}, extendedUtxo: {} });

    const transaction = { inputsLength: 1, getInput: vi.fn() };
    transaction.getInput.mockReturnValueOnce({
      txid: Buffer.from('f00d', 'hex'),
      index: 0,
    });

    await expect(() =>
      applySendUtxoActions(context as any, {}, transaction as any, [
        {
          type: btcTransaction.ActionType.SEND_UTXO,
          outpoint: 'f00d:0',
          toAddress: 'address',
        },
      ]),
    ).rejects.toThrow('UTXO already used: f00d:0');

    expect(transaction.getInput).toHaveBeenCalledWith(0);
    expect(context.getUtxo).toHaveBeenCalledWith('f00d:0');
  });

  it('throws if utxo sent twice', async () => {
    const context = {
      getUtxo: vi.fn(),
    };
    context.getUtxo.mockResolvedValue({ addressContext: { addInput: vi.fn() }, extendedUtxo: {} });

    const transaction = { inputsLength: 0 };

    await expect(() =>
      applySendUtxoActions(context as any, {}, transaction as any, [
        {
          type: btcTransaction.ActionType.SEND_UTXO,
          outpoint: 'f00d:0',
          toAddress: 'address',
          spendable: true,
        },
        {
          type: btcTransaction.ActionType.SEND_UTXO,
          outpoint: 'f00d:0',
          toAddress: 'address',
          spendable: true,
        },
      ]),
    ).rejects.toThrow('UTXO already used: f00d:0');

    expect(context.getUtxo).toHaveBeenCalledWith('f00d:0');
  });

  it('succeeds on valid send with no outputs if spendable', async () => {
    const addressContext = { addInput: vi.fn() };
    const context = {
      getUtxo: vi.fn(),
    };
    const utxo1 = {};
    context.getUtxo.mockResolvedValueOnce({ addressContext, extendedUtxo: utxo1 });
    const utxo2 = {};
    context.getUtxo.mockResolvedValueOnce({ addressContext, extendedUtxo: utxo2 });

    const transaction = { inputsLength: 0 };

    const { inputs, outputs } = await applySendUtxoActions(context as any, {}, transaction as any, [
      {
        type: btcTransaction.ActionType.SEND_UTXO,
        outpoint: 'f00d:0',
        toAddress: 'address',
        spendable: true,
      },
      {
        type: btcTransaction.ActionType.SEND_UTXO,
        outpoint: 'f00d:1',
        toAddress: 'address',
        spendable: true,
      },
    ]);

    expect(addressContext.addInput).toHaveBeenCalledWith(transaction, utxo1, {});
    expect(addressContext.addInput).toHaveBeenCalledWith(transaction, utxo2, {});
    expect(inputs).toHaveLength(2);
    expect(inputs[0]).toBe(utxo1);
    expect(inputs[1]).toBe(utxo2);
    expect(outputs).toHaveLength(0);
  });

  it('succeeds on valid send with 2 outputs if not spendable', async () => {
    const addressContext = { addInput: vi.fn() };
    const context = {
      getUtxo: vi.fn(),
      addOutputAddress: vi.fn(),
    };
    const utxo1 = {
      utxo: {
        value: 1000,
      },
    };
    context.getUtxo.mockResolvedValueOnce({ addressContext, extendedUtxo: utxo1 });
    const utxo2 = {
      utxo: {
        value: 2000,
      },
    };
    context.getUtxo.mockResolvedValueOnce({ addressContext, extendedUtxo: utxo2 });

    const transaction = { inputsLength: 0 };

    const { inputs, outputs } = await applySendUtxoActions(context as any, {}, transaction as any, [
      {
        type: btcTransaction.ActionType.SEND_UTXO,
        outpoint: 'f00d:0',
        toAddress: 'address1',
        spendable: false,
      },
      {
        type: btcTransaction.ActionType.SEND_UTXO,
        outpoint: 'f00d:1',
        toAddress: 'address2',
        spendable: false,
      },
    ]);

    expect(addressContext.addInput).toHaveBeenCalledWith(transaction, utxo1, {});
    expect(addressContext.addInput).toHaveBeenCalledWith(transaction, utxo2, {});
    expect(inputs).toHaveLength(2);
    expect(inputs[0]).toBe(utxo1);
    expect(inputs[1]).toBe(utxo2);
    expect(outputs).toHaveLength(2);
    expect(outputs[0].amount).toBe(1000);
    expect(outputs[0].address).toBe('address1');
    expect(outputs[1].amount).toBe(2000);
    expect(outputs[1].address).toBe('address2');
    expect(context.addOutputAddress).toHaveBeenCalledWith(transaction, 'address1', 1000n);
    expect(context.addOutputAddress).toHaveBeenCalledWith(transaction, 'address2', 2000n);
  });

  it('succeeds on valid send with 1 output if combinable and same address', async () => {
    const addressContext = { addInput: vi.fn() };
    const context = {
      getUtxo: vi.fn(),
      addOutputAddress: vi.fn(),
    };
    const utxo1 = {
      utxo: {
        value: 1000,
      },
    };
    context.getUtxo.mockResolvedValueOnce({ addressContext, extendedUtxo: utxo1 });
    const utxo2 = {
      utxo: {
        value: 2000,
      },
    };
    context.getUtxo.mockResolvedValueOnce({ addressContext, extendedUtxo: utxo2 });

    const transaction = { inputsLength: 0 };

    const { inputs, outputs } = await applySendUtxoActions(context as any, {}, transaction as any, [
      {
        type: btcTransaction.ActionType.SEND_UTXO,
        outpoint: 'f00d:0',
        toAddress: 'address',
        combinable: true,
      },
      {
        type: btcTransaction.ActionType.SEND_UTXO,
        outpoint: 'f00d:1',
        toAddress: 'address',
        combinable: true,
      },
    ]);

    expect(addressContext.addInput).toHaveBeenCalledWith(transaction, utxo1, {});
    expect(addressContext.addInput).toHaveBeenCalledWith(transaction, utxo2, {});
    expect(inputs).toHaveLength(2);
    expect(inputs[0]).toBe(utxo1);
    expect(inputs[1]).toBe(utxo2);
    expect(outputs).toHaveLength(1);
    expect(outputs[0].amount).toBe(3000);
    expect(outputs[0].address).toBe('address');
    expect(context.addOutputAddress).toHaveBeenCalledWith(transaction, 'address', 3000n);
  });

  it('succeeds on valid send with 2 output if combinable and different addresses', async () => {
    const addressContext = { addInput: vi.fn() };
    const context = {
      getUtxo: vi.fn(),
      addOutputAddress: vi.fn(),
    };
    const utxo1 = {
      utxo: {
        value: 1000,
      },
    };
    context.getUtxo.mockResolvedValueOnce({ addressContext, extendedUtxo: utxo1 });
    const utxo2 = {
      utxo: {
        value: 2000,
      },
    };
    context.getUtxo.mockResolvedValueOnce({ addressContext, extendedUtxo: utxo2 });

    const transaction = { inputsLength: 0 };

    const { inputs, outputs } = await applySendUtxoActions(context as any, {}, transaction as any, [
      {
        type: btcTransaction.ActionType.SEND_UTXO,
        outpoint: 'f00d:0',
        toAddress: 'address1',
        combinable: true,
      },
      {
        type: btcTransaction.ActionType.SEND_UTXO,
        outpoint: 'f00d:1',
        toAddress: 'address2',
        combinable: true,
      },
    ]);

    expect(addressContext.addInput).toHaveBeenCalledWith(transaction, utxo1, {});
    expect(addressContext.addInput).toHaveBeenCalledWith(transaction, utxo2, {});
    expect(inputs).toHaveLength(2);
    expect(inputs[0]).toBe(utxo1);
    expect(inputs[1]).toBe(utxo2);
    expect(outputs).toHaveLength(2);
    expect(outputs[0].amount).toBe(1000);
    expect(outputs[0].address).toBe('address1');
    expect(outputs[1].amount).toBe(2000);
    expect(outputs[1].address).toBe('address2');
    expect(context.addOutputAddress).toHaveBeenCalledWith(transaction, 'address1', 1000n);
    expect(context.addOutputAddress).toHaveBeenCalledWith(transaction, 'address2', 2000n);
  });

  it('succeeds on valid mixed input', async () => {
    const addressContext = { addInput: vi.fn() };
    const context = {
      getUtxo: vi.fn(),
      addOutputAddress: vi.fn(),
    };
    const utxo1 = {
      utxo: {
        value: 1000,
      },
    };
    context.getUtxo.mockResolvedValueOnce({ addressContext, extendedUtxo: utxo1 });
    const utxo2 = {
      utxo: {
        value: 2000,
      },
    };
    context.getUtxo.mockResolvedValueOnce({ addressContext, extendedUtxo: utxo2 });
    const utxo3 = {
      utxo: {
        value: 3000,
      },
    };
    context.getUtxo.mockResolvedValueOnce({ addressContext, extendedUtxo: utxo3 });
    const utxo4 = {
      utxo: {
        value: 4000,
      },
    };
    context.getUtxo.mockResolvedValueOnce({ addressContext, extendedUtxo: utxo4 });

    const transaction = { inputsLength: 0 };

    const { inputs, outputs } = await applySendUtxoActions(context as any, {}, transaction as any, [
      {
        type: btcTransaction.ActionType.SEND_UTXO,
        outpoint: 'f00d:0',
        toAddress: 'address1',
        combinable: true,
      },
      {
        type: btcTransaction.ActionType.SEND_UTXO,
        outpoint: 'f00d:1',
        toAddress: 'address1',
      },
      {
        type: btcTransaction.ActionType.SEND_UTXO,
        outpoint: 'f00d:2',
        toAddress: 'address1',
        combinable: true,
      },
      {
        type: btcTransaction.ActionType.SEND_UTXO,
        outpoint: 'f00d:3',
        toAddress: 'address2',
      },
    ]);

    expect(addressContext.addInput).toHaveBeenCalledWith(transaction, utxo1, {});
    expect(addressContext.addInput).toHaveBeenCalledWith(transaction, utxo2, {});
    expect(addressContext.addInput).toHaveBeenCalledWith(transaction, utxo3, {});
    expect(addressContext.addInput).toHaveBeenCalledWith(transaction, utxo4, {});
    expect(inputs).toHaveLength(4);
    expect(inputs[0]).toBe(utxo1);
    expect(inputs[1]).toBe(utxo2);
    expect(inputs[2]).toBe(utxo3);
    expect(inputs[3]).toBe(utxo4);
    expect(outputs).toHaveLength(3);
    expect(outputs[0].amount).toBe(1000);
    expect(outputs[0].address).toBe('address1');
    expect(outputs[1].amount).toBe(5000);
    expect(outputs[1].address).toBe('address1');
    expect(outputs[2].amount).toBe(4000);
    expect(outputs[2].address).toBe('address2');
    expect(context.addOutputAddress).toHaveBeenCalledWith(transaction, 'address1', 1000n);
    expect(context.addOutputAddress).toHaveBeenCalledWith(transaction, 'address1', 5000n);
    expect(context.addOutputAddress).toHaveBeenCalledWith(transaction, 'address2', 4000n);
  });
});
