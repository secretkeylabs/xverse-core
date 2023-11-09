import * as btc from '@scure/btc-signer';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AddressContext, TransactionContext } from '../context';
import type { SupportedAddressType } from '../types';
import { addresses } from './helpers';

describe('TransactionContext', () => {
  const seedVault = vi.fn() as any;
  const utxoCache = vi.fn() as any;

  class TestAddressContext extends AddressContext {
    constructor(type: SupportedAddressType, address: string, publicKey: string, accountIndex: bigint) {
      super(type, address, publicKey, 'Mainnet', accountIndex, seedVault, utxoCache);
    }

    getUtxos = vi.fn();

    getUnindexedUtxos = vi.fn();

    getCommonUtxos = vi.fn();

    getEmbellishedUtxos = vi.fn();

    getUtxo = vi.fn();

    getPrivateKey = vi.fn();

    getDerivationPath = vi.fn();

    addInput = vi.fn();

    signInputs = vi.fn();

    toDummyInputs = vi.fn();
  }

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should create context with different addresses', () => {
    const paymentAddressContext = new TestAddressContext(
      'p2wpkh',
      addresses[0].nestedSegwit,
      addresses[0].nestedSegwitPubKey,
      0n,
    );
    const ordinalsAddressContext = new TestAddressContext(
      'p2wpkh',
      addresses[0].taproot,
      addresses[0].taprootPubKey,
      0n,
    );
    const context = new TransactionContext('Mainnet', paymentAddressContext, ordinalsAddressContext);
    expect(context.paymentAddress).toStrictEqual(paymentAddressContext);
    expect(context.ordinalsAddress).toStrictEqual(ordinalsAddressContext);
  });

  it('should create context with same address', () => {
    const addressContext = new TestAddressContext(
      'p2wpkh',
      addresses[0].nestedSegwit,
      addresses[0].nestedSegwitPubKey,
      0n,
    );
    const context = new TransactionContext('Mainnet', addressContext, addressContext);
    expect(context.paymentAddress).toStrictEqual(addressContext);
    expect(context.ordinalsAddress).toStrictEqual(addressContext);
  });

  describe('getUtxo', () => {
    it('getUtxo should check both addresses', async () => {
      const paymentAddressContext = new TestAddressContext(
        'p2wpkh',
        addresses[0].nestedSegwit,
        addresses[0].nestedSegwitPubKey,
        0n,
      );
      const ordinalsAddressContext = new TestAddressContext(
        'p2wpkh',
        addresses[0].taproot,
        addresses[0].taprootPubKey,
        0n,
      );
      const context = new TransactionContext('Mainnet', paymentAddressContext, ordinalsAddressContext);
      const utxo = await context.getUtxo('bob');
      expect(utxo).toEqual({});
      expect(paymentAddressContext.getUtxo).toHaveBeenCalledTimes(1);
      expect(paymentAddressContext.getUtxo).toHaveBeenCalledWith('bob');
      expect(ordinalsAddressContext.getUtxo).toHaveBeenCalledTimes(1);
      expect(ordinalsAddressContext.getUtxo).toHaveBeenCalledWith('bob');
    });

    it('getUtxo should check one address only if found', async () => {
      const paymentAddressContext = new TestAddressContext(
        'p2wpkh',
        addresses[0].nestedSegwit,
        addresses[0].nestedSegwitPubKey,
        0n,
      );
      const ordinalsAddressContext = new TestAddressContext(
        'p2wpkh',
        addresses[0].taproot,
        addresses[0].taprootPubKey,
        0n,
      );
      paymentAddressContext.getUtxo.mockResolvedValueOnce({ txid: 'txid' });

      const context = new TransactionContext('Mainnet', paymentAddressContext, ordinalsAddressContext);
      const utxo = await context.getUtxo('bob');
      expect(utxo).toEqual({ addressContext: paymentAddressContext, extendedUtxo: { txid: 'txid' } });
      expect(paymentAddressContext.getUtxo).toHaveBeenCalledTimes(1);
      expect(paymentAddressContext.getUtxo).toHaveBeenCalledWith('bob');
      expect(ordinalsAddressContext.getUtxo).toHaveBeenCalledTimes(0);
    });

    it('getUtxo should run only once if payments and ordinals address are the same', async () => {
      const addressContext = new TestAddressContext(
        'p2wpkh',
        addresses[0].nestedSegwit,
        addresses[0].nestedSegwitPubKey,
        0n,
      );

      const context = new TransactionContext('Mainnet', addressContext, addressContext);
      const utxo = await context.getUtxo('bob');
      expect(utxo).toEqual({});
      expect(addressContext.getUtxo).toHaveBeenCalledTimes(1);
      expect(addressContext.getUtxo).toHaveBeenCalledWith('bob');
    });
  });

  describe('getInscriptionUtxo', () => {
    it('getInscriptionUtxo should check both addresses', async () => {
      const paymentAddressContext = new TestAddressContext(
        'p2wpkh',
        addresses[0].nestedSegwit,
        addresses[0].nestedSegwitPubKey,
        0n,
      );
      const ordinalsAddressContext = new TestAddressContext(
        'p2wpkh',
        addresses[0].taproot,
        addresses[0].taprootPubKey,
        0n,
      );
      paymentAddressContext.getUtxos.mockResolvedValueOnce([]);
      ordinalsAddressContext.getUtxos.mockResolvedValueOnce([]);

      const context = new TransactionContext('Mainnet', paymentAddressContext, ordinalsAddressContext);

      const resp = await context.getInscriptionUtxo('bob');

      expect(resp).toEqual({});
      expect(paymentAddressContext.getUtxos).toHaveBeenCalledTimes(1);
      expect(ordinalsAddressContext.getUtxos).toHaveBeenCalledTimes(1);
    });

    it('getInscriptionUtxo should check only first address if found', async () => {
      const paymentAddressContext = new TestAddressContext(
        'p2wpkh',
        addresses[0].nestedSegwit,
        addresses[0].nestedSegwitPubKey,
        0n,
      );
      const ordinalsAddressContext = new TestAddressContext(
        'p2wpkh',
        addresses[0].taproot,
        addresses[0].taprootPubKey,
        0n,
      );
      const dummyExtendedUtxo = { getBundleData: () => ({ sat_ranges: [{ inscriptions: [{ id: 'bob' }] }] }) };
      paymentAddressContext.getUtxos.mockResolvedValueOnce([dummyExtendedUtxo]);

      const context = new TransactionContext('Mainnet', paymentAddressContext, ordinalsAddressContext);

      const resp = await context.getInscriptionUtxo('bob');

      expect(resp).toEqual({ addressContext: paymentAddressContext, extendedUtxo: dummyExtendedUtxo });
      expect(paymentAddressContext.getUtxos).toHaveBeenCalledTimes(1);
      expect(ordinalsAddressContext.getUtxos).toHaveBeenCalledTimes(0);
    });

    it('getInscriptionUtxo should call only once if addresses are the same', async () => {
      const paymentAddressContext = new TestAddressContext(
        'p2wpkh',
        addresses[0].nestedSegwit,
        addresses[0].nestedSegwitPubKey,
        0n,
      );
      paymentAddressContext.getUtxos.mockResolvedValueOnce([]);

      const context = new TransactionContext('Mainnet', paymentAddressContext, paymentAddressContext);

      const resp = await context.getInscriptionUtxo('bob');

      expect(resp).toEqual({});
      expect(paymentAddressContext.getUtxos).toHaveBeenCalledTimes(1);
    });
  });

  describe('addOutputAddress', () => {
    it('adds output address to the transaction with correct network - mainnet', () => {
      const paymentAddressContext = new TestAddressContext(
        'p2wpkh',
        addresses[0].nestedSegwit,
        addresses[0].nestedSegwitPubKey,
        0n,
      );
      const context = new TransactionContext('Mainnet', paymentAddressContext, paymentAddressContext);

      const dummyTransaction = {
        addOutputAddress: vi.fn(),
      } as any;

      context.addOutputAddress(dummyTransaction, 'bob', 1000n);

      expect(dummyTransaction.addOutputAddress).toHaveBeenCalledTimes(1);
      expect(dummyTransaction.addOutputAddress).toHaveBeenCalledWith('bob', 1000n, btc.NETWORK);
    });

    it('adds output address to the transaction with correct network - testnet', () => {
      const paymentAddressContext = new TestAddressContext(
        'p2wpkh',
        addresses[0].nestedSegwit,
        addresses[0].nestedSegwitPubKey,
        0n,
      );
      const context = new TransactionContext('Testnet', paymentAddressContext, paymentAddressContext);

      const dummyTransaction = {
        addOutputAddress: vi.fn(),
      } as any;

      context.addOutputAddress(dummyTransaction, 'bob', 1000n);

      expect(dummyTransaction.addOutputAddress).toHaveBeenCalledTimes(1);
      expect(dummyTransaction.addOutputAddress).toHaveBeenCalledWith('bob', 1000n, btc.TEST_NETWORK);
    });
  });
});
