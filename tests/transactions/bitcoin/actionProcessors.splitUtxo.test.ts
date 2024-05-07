import { describe, expect, it, vi } from 'vitest';

import { btcTransaction } from '../../../transactions';
import { applySplitUtxoActions } from '../../../transactions/bitcoin/actionProcessors';

describe('applySplitUtxoActions', () => {
  it('throws on already used UTXO', async () => {
    const transaction = { inputsLength: 1, getInput: vi.fn() };
    transaction.getInput.mockReturnValueOnce({
      txid: Buffer.from('f00d', 'hex'),
      index: 0,
    });

    await expect(() =>
      applySplitUtxoActions({} as any, {}, transaction as any, {}, [
        {
          type: btcTransaction.ActionType.SPLIT_UTXO,
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
      applySplitUtxoActions({} as any, {}, transaction as any, { excludeOutpointList: ['f00d:0'] }, [
        {
          type: btcTransaction.ActionType.SPLIT_UTXO,
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
      applySplitUtxoActions(context as any, {}, transaction as any, {}, [
        {
          type: btcTransaction.ActionType.SPLIT_UTXO,
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
      applySplitUtxoActions(context as any, {}, transaction as any, {}, [
        {
          type: btcTransaction.ActionType.SPLIT_UTXO,
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
      applySplitUtxoActions(context as any, {}, transaction as any, {}, [
        {
          type: btcTransaction.ActionType.SPLIT_UTXO,
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
      applySplitUtxoActions(context as any, {}, transaction as any, {}, [
        {
          type: btcTransaction.ActionType.SPLIT_UTXO,
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

    const { inputs, outputs } = await applySplitUtxoActions(context as any, {}, transaction as any, {}, [
      {
        type: btcTransaction.ActionType.SPLIT_UTXO,
        location: 'f00d:0:600',
        toAddress: 'address1',
      },
      {
        type: btcTransaction.ActionType.SPLIT_UTXO,
        location: 'f00d:0:5000',
        toAddress: 'address3',
      },
      {
        type: btcTransaction.ActionType.SPLIT_UTXO,
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
      type: 'address',
    });
    expect(outputs[1]).toEqual({
      amount: 1400,
      address: 'address1',
      type: 'address',
    });
    expect(outputs[2]).toEqual({
      amount: 3000,
      address: 'address2',
      type: 'address',
    });
    expect(outputs[3]).toEqual({
      amount: 5000,
      address: 'address3',
      type: 'address',
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

    const { inputs, outputs } = await applySplitUtxoActions(context as any, {}, transaction as any, {}, [
      {
        type: btcTransaction.ActionType.SPLIT_UTXO,
        location: 'f00d:0:600',
        toAddress: 'address1',
      },
      {
        type: btcTransaction.ActionType.SPLIT_UTXO,
        location: 'f00d:1:1000',
        toAddress: 'address4',
      },
      {
        type: btcTransaction.ActionType.SPLIT_UTXO,
        location: 'f00d:0:5000',
        toAddress: 'address3',
      },
      {
        type: btcTransaction.ActionType.SPLIT_UTXO,
        location: 'f00d:1:6000',
        toAddress: 'address5',
      },
      {
        type: btcTransaction.ActionType.SPLIT_UTXO,
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
      type: 'address',
    });
    expect(outputs[1]).toEqual({
      amount: 1400,
      address: 'address1',
      type: 'address',
    });
    expect(outputs[2]).toEqual({
      amount: 3000,
      address: 'address2',
      type: 'address',
    });
    expect(outputs[3]).toEqual({
      amount: 5000,
      address: 'address3',
      type: 'address',
    });
    expect(outputs[4]).toEqual({
      amount: 1000,
      address: 'walletAddress2',
      type: 'address',
    });
    expect(outputs[5]).toEqual({
      amount: 5000,
      address: 'address4',
      type: 'address',
    });
    expect(outputs[6]).toEqual({
      amount: 4000,
      address: 'address5',
      type: 'address',
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

    const { inputs, outputs } = await applySplitUtxoActions(context as any, {}, transaction as any, {}, [
      {
        type: btcTransaction.ActionType.SPLIT_UTXO,
        location: 'f00d:0:600',
        toAddress: 'address1',
      },
      {
        type: btcTransaction.ActionType.SPLIT_UTXO,
        location: 'f00d:0:5000',
        spendable: true,
      },
      {
        type: btcTransaction.ActionType.SPLIT_UTXO,
        location: 'f00d:1:1000',
        toAddress: 'address4',
      },
      {
        type: btcTransaction.ActionType.SPLIT_UTXO,
        location: 'f00d:1:6000',
        spendable: true,
      },
      {
        type: btcTransaction.ActionType.SPLIT_UTXO,
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
      type: 'address',
    });
    expect(outputs[1]).toEqual({
      amount: 1400,
      address: 'address1',
      type: 'address',
    });
    expect(outputs[2]).toEqual({
      amount: 3000,
      address: 'address2',
      type: 'address',
    });
    expect(outputs[3]).toEqual({
      amount: 5000,
      address: 'walletAddress1',
      type: 'address',
    });
    expect(outputs[4]).toEqual({
      amount: 1000,
      address: 'walletAddress2',
      type: 'address',
    });
    expect(outputs[5]).toEqual({
      amount: 5000,
      address: 'address4',
      type: 'address',
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

    const { inputs, outputs } = await applySplitUtxoActions(context as any, {}, transaction as any, {}, [
      {
        type: btcTransaction.ActionType.SPLIT_UTXO,
        location: 'f00d:0:600',
        toAddress: 'address1',
      },
      {
        type: btcTransaction.ActionType.SPLIT_UTXO,
        location: 'f00d:0:5000',
        spendable: true,
      },
      {
        type: btcTransaction.ActionType.SPLIT_UTXO,
        location: 'f00d:1:1000',
        toAddress: 'address4',
      },
      {
        type: btcTransaction.ActionType.SPLIT_UTXO,
        location: 'f00d:1:6000',
        toAddress: 'address5',
      },
      {
        type: btcTransaction.ActionType.SPLIT_UTXO,
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
      type: 'address',
    });
    expect(outputs[1]).toEqual({
      amount: 5000,
      address: 'address4',
      type: 'address',
    });
    expect(outputs[2]).toEqual({
      amount: 4000,
      address: 'address5',
      type: 'address',
    });
    expect(outputs[3]).toEqual({
      amount: 600,
      address: 'walletAddress2',
      type: 'address',
    });
    expect(outputs[4]).toEqual({
      amount: 1400,
      address: 'address1',
      type: 'address',
    });
    expect(outputs[5]).toEqual({
      amount: 3000,
      address: 'address2',
      type: 'address',
    });
  });
});
