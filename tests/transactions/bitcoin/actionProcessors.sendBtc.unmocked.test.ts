import * as btc from '@scure/btc-signer';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ActionType } from '../../../transactions/bitcoin';
import { applySendBtcActionsAndFee } from '../../../transactions/bitcoin/actionProcessors';
import { addresses, rootKeyPair } from './helpers';

const testP2WPKH = btc.p2wpkh(rootKeyPair.publicKey);

describe('applySendBtcActionsAndFee', () => {
  let transaction: btc.Transaction;

  const paymentAddress = addresses[0].nestedSegwit;

  const context = {
    getUtxo: vi.fn(),
    changeAddress: addresses[0].nestedSegwit,
    paymentAddress: {
      address: paymentAddress,
      addInput: vi.fn(),
      getIOSizes: () => ({ inputSize: 91, outputSize: 32 }),
      getUtxos: vi.fn(),
    },
    addOutputAddress: vi.fn(),
  };

  const mockUtxos = {
    confirmed20k: {
      outpoint: '0000000000000000000000000000000000000000000000000000000000000001:0',
      utxo: {
        txid: '0000000000000000000000000000000000000000000000000000000000000001',
        vout: 0,
        value: 20000,
        status: {
          confirmed: true,
        },
      },
    },
    confirmed50k: {
      outpoint: '0000000000000000000000000000000000000000000000000000000000000003:0',
      utxo: {
        txid: '0000000000000000000000000000000000000000000000000000000000000003',
        vout: 0,
        value: 50000,
        status: {
          confirmed: true,
        },
      },
    },
    confirmed40k: {
      outpoint: '0000000000000000000000000000000000000000000000000000000000000002:0',
      utxo: {
        txid: '0000000000000000000000000000000000000000000000000000000000000002',
        vout: 0,
        value: 40000,
        status: {
          confirmed: true,
        },
      },
    },
    unconfirmed50k: {
      outpoint: '0000000000000000000000000000000000000000000000000000000000000004:0',
      utxo: {
        txid: '0000000000000000000000000000000000000000000000000000000000000004',
        vout: 0,
        value: 50000,
        status: {
          confirmed: false,
        },
      },
    },
  };

  beforeEach(() => {
    vi.resetAllMocks();

    context.paymentAddress.getUtxos.mockResolvedValue(Object.values(mockUtxos));

    context.getUtxo.mockImplementation(async (outpoint: string) => {
      const utxos = Object.values(mockUtxos);
      const utxo = utxos.find((u) => u.outpoint === outpoint);

      if (!utxo) {
        return {};
      }
      return { extendedUtxo: utxo, addressContext: context.paymentAddress };
    });

    context.paymentAddress.addInput.mockImplementation((tx, extendedUtxo) => {
      tx.addInput({
        txid: extendedUtxo.utxo.txid,
        index: extendedUtxo.utxo.vout,
        witnessUtxo: { script: testP2WPKH.script, amount: BigInt(extendedUtxo.utxo.value) },
      });
    });

    transaction = new btc.Transaction();
    transaction.addInput({
      txid: '0000000000000000000000000000000000000000000000000000000000000000',
      index: 0,
      witnessUtxo: { script: testP2WPKH.script, amount: 100000n },
    });
    transaction.addInput({
      txid: '0000000000000000000000000000000000000000000000000000000000000000',
      index: 1,
      witnessUtxo: { script: testP2WPKH.script, amount: 100000n },
    });

    context.addOutputAddress.mockImplementation((tx, address, amount) => {
      tx.addOutputAddress(address, amount);

      return {
        script: ['DUMMY_SCRIPT'],
        scriptHex: 'DUMMY_SCRIPT_HEX',
      };
    });
  });

  it("doesn't alter the transaction if no actions and enough for fees", async () => {
    transaction.addOutputAddress(addresses[1].nativeSegwit, 198200n);

    const { inputs, outputs, actualFee } = await applySendBtcActionsAndFee(context as any, {}, transaction, {}, [], 10);

    expect(inputs).toEqual([]);
    expect(outputs).toEqual([]);
    expect(actualFee).toEqual(1800n);
    expect(transaction.inputsLength).toEqual(2);
    expect(transaction.outputsLength).toEqual(1);
  });

  it('Adds change if txn already has enough inputs for fees', async () => {
    transaction.addOutputAddress(addresses[1].nativeSegwit, 180000n);

    const { inputs, outputs, actualFee } = await applySendBtcActionsAndFee(context as any, {}, transaction, {}, [], 10);

    expect(inputs).toEqual([]);
    expect(outputs).toEqual([
      {
        address: paymentAddress,
        amount: 17900,
        type: 'address',
        script: ['DUMMY_SCRIPT'],
        scriptHex: 'DUMMY_SCRIPT_HEX',
      },
    ]);
    expect(actualFee).toEqual(2100n);
    expect(transaction.inputsLength).toEqual(2);
    expect(transaction.outputsLength).toEqual(2);
    expect(transaction.getOutput(1).amount).toEqual(17900n);
  });

  it('Sends change to override address if specified', async () => {
    transaction.addOutputAddress(addresses[1].nativeSegwit, 180000n);

    const { inputs, outputs, actualFee } = await applySendBtcActionsAndFee(
      context as any,
      {},
      transaction,
      { overrideChangeAddress: addresses[1].nestedSegwit },
      [],
      10,
    );

    expect(inputs).toEqual([]);
    expect(outputs).toEqual([
      {
        address: addresses[1].nestedSegwit,
        amount: 17900,
        type: 'address',
        script: ['DUMMY_SCRIPT'],
        scriptHex: 'DUMMY_SCRIPT_HEX',
      },
    ]);
    expect(actualFee).toEqual(2100n);
    expect(transaction.inputsLength).toEqual(2);
    expect(transaction.outputsLength).toEqual(2);
    expect(transaction.getOutput(1).amount).toEqual(17900n);
  });

  it('Adds action output and additional UTXOs to cover costs', async () => {
    const { inputs, outputs, actualFee } = await applySendBtcActionsAndFee(
      context as any,
      {},
      transaction,
      {},
      [
        {
          toAddress: addresses[1].nativeSegwit,
          amount: 300000n,
          type: ActionType.SEND_BTC,
          combinable: true,
        },
      ],
      10,
    );

    expect(inputs).toEqual([mockUtxos.confirmed50k, mockUtxos.confirmed40k, mockUtxos.confirmed20k]);
    expect(outputs).toEqual([
      {
        address: addresses[1].nativeSegwit,
        amount: 300000,
        type: 'address',
        script: ['DUMMY_SCRIPT'],
        scriptHex: 'DUMMY_SCRIPT_HEX',
      },
      {
        address: paymentAddress,
        amount: 5860,
        type: 'address',
        script: ['DUMMY_SCRIPT'],
        scriptHex: 'DUMMY_SCRIPT_HEX',
      },
    ]);
    expect(actualFee).toEqual(4140n);
    expect(transaction.inputsLength).toEqual(5);
    expect(transaction.outputsLength).toEqual(2);
    expect(transaction.getOutput(0).amount).toEqual(300000n);
    expect(transaction.getOutput(1).amount).toEqual(5860n);
  });

  it('Adds action outputs combined correctly', async () => {
    const { inputs, outputs, actualFee } = await applySendBtcActionsAndFee(
      context as any,
      {},
      transaction,
      {},
      [
        {
          toAddress: addresses[1].nativeSegwit,
          amount: 100000n,
          type: ActionType.SEND_BTC,
          combinable: true,
        },
        {
          toAddress: addresses[1].nativeSegwit,
          amount: 100000n,
          type: ActionType.SEND_BTC,
          combinable: true,
        },
        {
          toAddress: addresses[1].nativeSegwit,
          amount: 50000n,
          type: ActionType.SEND_BTC,
          combinable: false,
        },
        {
          toAddress: addresses[1].taproot,
          amount: 50000n,
          type: ActionType.SEND_BTC,
          combinable: false,
        },
      ],
      10,
    );

    expect(inputs).toEqual([mockUtxos.confirmed50k, mockUtxos.confirmed40k, mockUtxos.confirmed20k]);
    expect(outputs).toEqual([
      {
        address: addresses[1].nativeSegwit,
        amount: 200000,
        type: 'address',
        script: ['DUMMY_SCRIPT'],
        scriptHex: 'DUMMY_SCRIPT_HEX',
      },
      {
        address: addresses[1].nativeSegwit,
        amount: 50000,
        type: 'address',
        script: ['DUMMY_SCRIPT'],
        scriptHex: 'DUMMY_SCRIPT_HEX',
      },
      {
        address: addresses[1].taproot,
        amount: 50000,
        type: 'address',
        script: ['DUMMY_SCRIPT'],
        scriptHex: 'DUMMY_SCRIPT_HEX',
      },
      {
        address: paymentAddress,
        amount: 5120,
        type: 'address',
        script: ['DUMMY_SCRIPT'],
        scriptHex: 'DUMMY_SCRIPT_HEX',
      },
    ]);
    expect(actualFee).toEqual(4880n);
    expect(transaction.inputsLength).toEqual(5);
    expect(transaction.outputsLength).toEqual(4);
    expect(transaction.getOutput(0).amount).toEqual(200000n);
    expect(transaction.getOutput(1).amount).toEqual(50000n);
    expect(transaction.getOutput(2).amount).toEqual(50000n);
    expect(transaction.getOutput(3).amount).toEqual(5120n);
  });

  it('Adds confirmed UTXOs only, if enough to cover costs', async () => {
    transaction.addOutputAddress(addresses[1].nativeSegwit, 300000n);

    const { inputs, outputs, actualFee } = await applySendBtcActionsAndFee(context as any, {}, transaction, {}, [], 10);

    expect(inputs).toEqual([mockUtxos.confirmed50k, mockUtxos.confirmed40k, mockUtxos.confirmed20k]);
    expect(outputs).toEqual([
      {
        address: paymentAddress,
        amount: 5860,
        type: 'address',
        script: ['DUMMY_SCRIPT'],
        scriptHex: 'DUMMY_SCRIPT_HEX',
      },
    ]);
    expect(actualFee).toEqual(4140n);
    expect(transaction.inputsLength).toEqual(5);
    expect(transaction.outputsLength).toEqual(2);
    expect(transaction.getOutput(1).amount).toEqual(5860n);
  });

  it('Does not add UTXO if it is already present in the txn', async () => {
    transaction.addInput({
      txid: mockUtxos.confirmed40k.utxo.txid,
      index: mockUtxos.confirmed40k.utxo.vout,
      witnessUtxo: { script: testP2WPKH.script, amount: BigInt(mockUtxos.confirmed40k.utxo.value) },
    });
    transaction.addOutputAddress(addresses[1].nativeSegwit, 300000n);

    const { inputs, outputs, actualFee } = await applySendBtcActionsAndFee(context as any, {}, transaction, {}, [], 10);

    expect(inputs).toEqual([mockUtxos.confirmed50k, mockUtxos.confirmed20k]);
    expect(outputs).toEqual([
      {
        address: paymentAddress,
        amount: 5860,
        type: 'address',
        script: ['DUMMY_SCRIPT'],
        scriptHex: 'DUMMY_SCRIPT_HEX',
      },
    ]);
    expect(actualFee).toEqual(4140n);
    expect(transaction.inputsLength).toEqual(5);
    expect(transaction.outputsLength).toEqual(2);
    expect(transaction.getOutput(1).amount).toEqual(5860n);
  });

  it('Adds specified UTXOs if specific ones are marked for forced include', async () => {
    transaction.addOutputAddress(addresses[1].nativeSegwit, 200000n);

    const { inputs, outputs, actualFee } = await applySendBtcActionsAndFee(
      context as any,
      {},
      transaction,
      { forceIncludeOutpointList: [mockUtxos.confirmed40k.outpoint] },
      [],
      10,
    );

    expect(inputs).toEqual([mockUtxos.confirmed40k]);
    expect(outputs).toEqual([
      {
        address: paymentAddress,
        amount: 37220,
        type: 'address',
        script: ['DUMMY_SCRIPT'],
        scriptHex: 'DUMMY_SCRIPT_HEX',
      },
    ]);
    expect(actualFee).toEqual(2780n);
    expect(transaction.inputsLength).toEqual(3);
    expect(transaction.outputsLength).toEqual(2);
    expect(transaction.getOutput(1).amount).toEqual(37220n);
  });

  it('Does not add specified UTXOs from forced include list if already in txn', async () => {
    transaction.addInput({
      txid: mockUtxos.confirmed40k.utxo.txid,
      index: mockUtxos.confirmed40k.utxo.vout,
      witnessUtxo: { script: testP2WPKH.script, amount: BigInt(mockUtxos.confirmed40k.utxo.value) },
    });
    transaction.addOutputAddress(addresses[1].nativeSegwit, 200000n);

    const { inputs, outputs, actualFee } = await applySendBtcActionsAndFee(
      context as any,
      {},
      transaction,
      { forceIncludeOutpointList: [mockUtxos.confirmed40k.outpoint] },
      [],
      10,
    );

    expect(inputs).toEqual([]);
    expect(outputs).toEqual([
      {
        address: paymentAddress,
        amount: 37220,
        type: 'address',
        script: ['DUMMY_SCRIPT'],
        scriptHex: 'DUMMY_SCRIPT_HEX',
      },
    ]);
    expect(actualFee).toEqual(2780n);
    expect(transaction.inputsLength).toEqual(3);
    expect(transaction.outputsLength).toEqual(2);
    expect(transaction.getOutput(1).amount).toEqual(37220n);
  });

  it('Adds unconfirmed UTXOs if not enough confirmed to cover costs', async () => {
    transaction.addOutputAddress(addresses[1].nativeSegwit, 310000n);

    const { inputs, outputs, actualFee } = await applySendBtcActionsAndFee(context as any, {}, transaction, {}, [], 10);

    expect(inputs).toEqual([mockUtxos.unconfirmed50k, mockUtxos.confirmed50k, mockUtxos.confirmed40k]);
    expect(outputs).toEqual([
      {
        address: paymentAddress,
        amount: 25860,
        type: 'address',
        script: ['DUMMY_SCRIPT'],
        scriptHex: 'DUMMY_SCRIPT_HEX',
      },
    ]);
    expect(actualFee).toEqual(4140n);
    expect(transaction.inputsLength).toEqual(5);
    expect(transaction.outputsLength).toEqual(2);
    expect(transaction.getOutput(1).amount).toEqual(25860n);
  });

  it('Throws on enough unconfirmed funds but useUnconfirmed false', async () => {
    transaction.addOutputAddress(addresses[1].nativeSegwit, 310000n);

    await expect(() =>
      applySendBtcActionsAndFee(context as any, {}, transaction, { allowUnconfirmedInput: false }, [], 10),
    ).rejects.toThrow('Insufficient funds');
  });

  it('Throws on not enough funds', async () => {
    transaction.addOutputAddress(addresses[1].nativeSegwit, 400000n);

    await expect(() => applySendBtcActionsAndFee(context as any, {}, transaction, {}, [], 10)).rejects.toThrow(
      'Insufficient funds',
    );
  });
});
