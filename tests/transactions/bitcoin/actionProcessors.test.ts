import { hex } from '@scure/base';
import { describe, expect, it, vi } from 'vitest';

import { ActionType } from 'transactions';
import {
  applySendUtxoActions,
  applySplitUtxoActions,
  dummySignTransaction,
} from '../../../transactions/bitcoin/actionProcessors';

describe('dummySignTransaction', () => {
  it('should return the same transaction', async () => {
    const context = {
      paymentAddress: {
        toDummyInputs: vi.fn(),
      },
      ordinalsAddress: {
        toDummyInputs: vi.fn(),
      },
    };
    const transaction = {
      sign: vi.fn(),
    };

    await dummySignTransaction(context as any, transaction as any);

    const dummyPrivateKeyBuffer = hex.decode('0000000000000000000000000000000000000000000000000000000000000001');

    expect(context.paymentAddress.toDummyInputs).toHaveBeenCalledWith(transaction, dummyPrivateKeyBuffer);
    expect(context.ordinalsAddress.toDummyInputs).toHaveBeenCalledWith(transaction, dummyPrivateKeyBuffer);
    expect(transaction.sign).toHaveBeenCalledWith(dummyPrivateKeyBuffer);
  });
});

describe('applySendUtxoActions', () => {
  it('throws if excluded utxo is used for send', async () => {
    await expect(() =>
      applySendUtxoActions({} as any, { excludeOutpointList: ['txid:0'] }, { inputsLength: 0 } as any, [
        {
          type: ActionType.SEND_UTXO,
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
          type: ActionType.SEND_UTXO,
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
          type: ActionType.SEND_UTXO,
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
          type: ActionType.SEND_UTXO,
          outpoint: 'f00d:0',
          toAddress: 'address',
          spendable: true,
        },
        {
          type: ActionType.SEND_UTXO,
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
        type: ActionType.SEND_UTXO,
        outpoint: 'f00d:0',
        toAddress: 'address',
        spendable: true,
      },
      {
        type: ActionType.SEND_UTXO,
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
        type: ActionType.SEND_UTXO,
        outpoint: 'f00d:0',
        toAddress: 'address1',
        spendable: false,
      },
      {
        type: ActionType.SEND_UTXO,
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
        type: ActionType.SEND_UTXO,
        outpoint: 'f00d:0',
        toAddress: 'address',
        combinable: true,
      },
      {
        type: ActionType.SEND_UTXO,
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
        type: ActionType.SEND_UTXO,
        outpoint: 'f00d:0',
        toAddress: 'address1',
        combinable: true,
      },
      {
        type: ActionType.SEND_UTXO,
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
        type: ActionType.SEND_UTXO,
        outpoint: 'f00d:0',
        toAddress: 'address1',
        combinable: true,
      },
      {
        type: ActionType.SEND_UTXO,
        outpoint: 'f00d:1',
        toAddress: 'address1',
      },
      {
        type: ActionType.SEND_UTXO,
        outpoint: 'f00d:2',
        toAddress: 'address1',
        combinable: true,
      },
      {
        type: ActionType.SEND_UTXO,
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

describe('applySplitUtxoActions', () => {
  it('throws on already used UTXO', async () => {
    const transaction = { inputsLength: 1, getInput: vi.fn() };
    transaction.getInput.mockReturnValueOnce({
      txid: Buffer.from('f00d', 'hex'),
      index: 0,
    });

    await expect(() =>
      applySplitUtxoActions({} as any, {}, transaction as any, [
        {
          type: ActionType.SPLIT_UTXO,
          location: 'f00d:0:0',
          toAddress: 'address',
        },
      ]),
    ).rejects.toThrow('UTXO already used: f00d:0');

    expect(transaction.getInput).toHaveBeenCalledWith(0);
  });

  it('throws on excluded UTXO split', async () => {
    const transaction = { inputsLength: 0 };

    await expect(() =>
      applySplitUtxoActions({} as any, { excludeOutpointList: ['f00d:0'] }, transaction as any, [
        {
          type: ActionType.SPLIT_UTXO,
          location: 'f00d:0:0',
          toAddress: 'address',
        },
      ]),
    ).rejects.toThrow('UTXO excluded but used in split UTXO action: f00d:0');
  });

  it('throws on UTXO not found', async () => {
    const context = {
      getUtxo: vi.fn(),
    };
    context.getUtxo.mockResolvedValueOnce({});
    const transaction = { inputsLength: 0 };

    await expect(() =>
      applySplitUtxoActions(context as any, {}, transaction as any, [
        {
          type: ActionType.SPLIT_UTXO,
          location: 'f00d:0:0',
          toAddress: 'address',
        },
      ]),
    ).rejects.toThrow('UTXO for outpoint not found: f00d:0');
  });

  it('throws on negative offset split', async () => {
    const addressContext = { addInput: vi.fn() };
    const context = {
      getUtxo: vi.fn(),
    };
    context.getUtxo.mockResolvedValueOnce({ extendedUtxo: { outpoint: 'f00d:0' }, addressContext });
    const transaction = { inputsLength: 0 };

    await expect(() =>
      applySplitUtxoActions(context as any, {}, transaction as any, [
        {
          type: ActionType.SPLIT_UTXO,
          location: 'f00d:0:-1',
          toAddress: 'address',
        },
      ]),
    ).rejects.toThrow('Cannot split offset -1 on  f00d:0 as it is negative');
  });

  it('throws on below dust offset split', async () => {
    const addressContext = { addInput: vi.fn() };
    const context = {
      getUtxo: vi.fn(),
    };
    context.getUtxo.mockResolvedValueOnce({ extendedUtxo: { outpoint: 'f00d:0' }, addressContext });
    const transaction = { inputsLength: 0 };

    await expect(() =>
      applySplitUtxoActions(context as any, {}, transaction as any, [
        {
          type: ActionType.SPLIT_UTXO,
          location: 'f00d:0:100',
          toAddress: 'address',
        },
      ]),
    ).rejects.toThrow('Cannot split offset 100 on  f00d:0 as it the first output would be below dust');
  });

  it('throws on not enough sats split', async () => {
    const addressContext = { addInput: vi.fn() };
    const context = {
      getUtxo: vi.fn(),
      addOutputAddress: vi.fn(),
    };
    context.getUtxo.mockResolvedValueOnce({
      extendedUtxo: { outpoint: 'f00d:0', utxo: { value: 1000 } },
      addressContext,
    });
    const transaction = { inputsLength: 0 };

    await expect(() =>
      applySplitUtxoActions(context as any, {}, transaction as any, [
        {
          type: ActionType.SPLIT_UTXO,
          location: 'f00d:0:600',
          toAddress: 'address',
        },
      ]),
    ).rejects.toThrow('Cannot split offset 600 on  f00d:0 as there are not enough sats');
  });

  it('successfully splits valid actions on single UTXO', async () => {
    const addressContext = { addInput: vi.fn() };
    const context = {
      getUtxo: vi.fn(),
      addOutputAddress: vi.fn(),
    };
    const dummyExtendedUtxo = { outpoint: 'f00d:0', utxo: { value: 10000, address: 'walletAddress' } };
    context.getUtxo.mockResolvedValueOnce({
      extendedUtxo: dummyExtendedUtxo,
      addressContext,
    });
    const transaction = { inputsLength: 0 };

    const { inputs, outputs } = await applySplitUtxoActions(context as any, {}, transaction as any, [
      {
        type: ActionType.SPLIT_UTXO,
        location: 'f00d:0:600',
        toAddress: 'address1',
      },
      {
        type: ActionType.SPLIT_UTXO,
        location: 'f00d:0:5000',
        toAddress: 'address3',
      },
      {
        type: ActionType.SPLIT_UTXO,
        location: 'f00d:0:2000',
        toAddress: 'address2',
      },
    ]);
    expect(inputs.length).toBe(1);
    expect(inputs[0]).toBe(dummyExtendedUtxo);
    expect(outputs.length).toBe(4);
    expect(outputs[0]).toEqual({
      amount: 600,
      address: 'walletAddress',
    });
    expect(outputs[1]).toEqual({
      amount: 1400,
      address: 'address1',
    });
    expect(outputs[2]).toEqual({
      amount: 3000,
      address: 'address2',
    });
    expect(outputs[3]).toEqual({
      amount: 5000,
      address: 'address3',
    });
  });

  it('successfully splits valid actions on multiple UTXOs', async () => {
    const addressContext = { addInput: vi.fn() };
    const context = {
      getUtxo: vi.fn(),
      addOutputAddress: vi.fn(),
    };
    const dummyExtendedUtxo1 = { outpoint: 'f00d:0', utxo: { value: 10000, address: 'walletAddress1' } };
    context.getUtxo.mockResolvedValueOnce({
      extendedUtxo: dummyExtendedUtxo1,
      addressContext,
    });
    const dummyExtendedUtxo2 = { outpoint: 'f00d:1', utxo: { value: 10000, address: 'walletAddress2' } };
    context.getUtxo.mockResolvedValueOnce({
      extendedUtxo: dummyExtendedUtxo2,
      addressContext,
    });
    const transaction = { inputsLength: 0 };

    const { inputs, outputs } = await applySplitUtxoActions(context as any, {}, transaction as any, [
      {
        type: ActionType.SPLIT_UTXO,
        location: 'f00d:0:600',
        toAddress: 'address1',
      },
      {
        type: ActionType.SPLIT_UTXO,
        location: 'f00d:1:1000',
        toAddress: 'address4',
      },
      {
        type: ActionType.SPLIT_UTXO,
        location: 'f00d:0:5000',
        toAddress: 'address3',
      },
      {
        type: ActionType.SPLIT_UTXO,
        location: 'f00d:1:6000',
        toAddress: 'address5',
      },
      {
        type: ActionType.SPLIT_UTXO,
        location: 'f00d:0:2000',
        toAddress: 'address2',
      },
    ]);
    expect(inputs.length).toBe(2);
    expect(inputs[0]).toBe(dummyExtendedUtxo1);
    expect(inputs[1]).toBe(dummyExtendedUtxo2);
    expect(outputs.length).toBe(7);
    expect(outputs[0]).toEqual({
      amount: 600,
      address: 'walletAddress1',
    });
    expect(outputs[1]).toEqual({
      amount: 1400,
      address: 'address1',
    });
    expect(outputs[2]).toEqual({
      amount: 3000,
      address: 'address2',
    });
    expect(outputs[3]).toEqual({
      amount: 5000,
      address: 'address3',
    });
    expect(outputs[4]).toEqual({
      amount: 1000,
      address: 'walletAddress2',
    });
    expect(outputs[5]).toEqual({
      amount: 5000,
      address: 'address4',
    });
    expect(outputs[6]).toEqual({
      amount: 4000,
      address: 'address5',
    });
  });

  it('successfully splits valid actions with spendable utxos', async () => {
    const addressContext = { addInput: vi.fn() };
    const context = {
      getUtxo: vi.fn(),
      addOutputAddress: vi.fn(),
    };
    const dummyExtendedUtxo1 = { outpoint: 'f00d:0', utxo: { value: 10000, address: 'walletAddress1' } };
    context.getUtxo.mockResolvedValueOnce({
      extendedUtxo: dummyExtendedUtxo1,
      addressContext,
    });
    const dummyExtendedUtxo2 = { outpoint: 'f00d:1', utxo: { value: 10000, address: 'walletAddress2' } };
    context.getUtxo.mockResolvedValueOnce({
      extendedUtxo: dummyExtendedUtxo2,
      addressContext,
    });
    const transaction = { inputsLength: 0 };

    const { inputs, outputs } = await applySplitUtxoActions(context as any, {}, transaction as any, [
      {
        type: ActionType.SPLIT_UTXO,
        location: 'f00d:0:600',
        toAddress: 'address1',
      },
      {
        type: ActionType.SPLIT_UTXO,
        location: 'f00d:0:5000',
        spendable: true,
      },
      {
        type: ActionType.SPLIT_UTXO,
        location: 'f00d:1:1000',
        toAddress: 'address4',
      },
      {
        type: ActionType.SPLIT_UTXO,
        location: 'f00d:1:6000',
        spendable: true,
      },
      {
        type: ActionType.SPLIT_UTXO,
        location: 'f00d:0:2000',
        toAddress: 'address2',
      },
    ]);
    expect(inputs.length).toBe(2);
    expect(inputs[0]).toBe(dummyExtendedUtxo1);
    expect(inputs[1]).toBe(dummyExtendedUtxo2);
    expect(outputs.length).toBe(6);
    expect(outputs[0]).toEqual({
      amount: 600,
      address: 'walletAddress1',
    });
    expect(outputs[1]).toEqual({
      amount: 1400,
      address: 'address1',
    });
    expect(outputs[2]).toEqual({
      amount: 3000,
      address: 'address2',
    });
    expect(outputs[3]).toEqual({
      amount: 5000,
      address: 'walletAddress1',
    });
    expect(outputs[4]).toEqual({
      amount: 1000,
      address: 'walletAddress2',
    });
    expect(outputs[5]).toEqual({
      amount: 5000,
      address: 'address4',
    });
  });

  it('successfully splits valid actions and places spendable utxos at end', async () => {
    const addressContext = { addInput: vi.fn() };
    const context = {
      getUtxo: vi.fn(),
      addOutputAddress: vi.fn(),
    };
    const dummyExtendedUtxo1 = { outpoint: 'f00d:0', utxo: { value: 10000, address: 'walletAddress1' } };
    context.getUtxo.mockResolvedValueOnce({
      extendedUtxo: dummyExtendedUtxo1,
      addressContext,
    });
    const dummyExtendedUtxo2 = { outpoint: 'f00d:1', utxo: { value: 10000, address: 'walletAddress2' } };
    context.getUtxo.mockResolvedValueOnce({
      extendedUtxo: dummyExtendedUtxo2,
      addressContext,
    });
    const transaction = { inputsLength: 0 };

    const { inputs, outputs } = await applySplitUtxoActions(context as any, {}, transaction as any, [
      {
        type: ActionType.SPLIT_UTXO,
        location: 'f00d:0:600',
        toAddress: 'address1',
      },
      {
        type: ActionType.SPLIT_UTXO,
        location: 'f00d:0:5000',
        spendable: true,
      },
      {
        type: ActionType.SPLIT_UTXO,
        location: 'f00d:1:1000',
        toAddress: 'address4',
      },
      {
        type: ActionType.SPLIT_UTXO,
        location: 'f00d:1:6000',
        toAddress: 'address5',
      },
      {
        type: ActionType.SPLIT_UTXO,
        location: 'f00d:0:2000',
        toAddress: 'address2',
      },
    ]);
    expect(inputs.length).toBe(2);
    expect(inputs[0]).toBe(dummyExtendedUtxo1);
    expect(inputs[1]).toBe(dummyExtendedUtxo2);
    expect(outputs.length).toBe(6);
    expect(outputs[0]).toEqual({
      amount: 1000,
      address: 'walletAddress1',
    });
    expect(outputs[1]).toEqual({
      amount: 5000,
      address: 'address4',
    });
    expect(outputs[2]).toEqual({
      amount: 4000,
      address: 'address5',
    });
    expect(outputs[3]).toEqual({
      amount: 600,
      address: 'walletAddress2',
    });
    expect(outputs[4]).toEqual({
      amount: 1400,
      address: 'address1',
    });
    expect(outputs[5]).toEqual({
      amount: 3000,
      address: 'address2',
    });
  });
});
