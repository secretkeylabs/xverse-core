import * as btc from '@scure/btc-signer';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import EsploraProvider from '../../../../api/esplora/esploraAPiProvider';
import {
  ExtendedUtxo,
  LedgerP2trAddressContext,
  LedgerP2wpkhAddressContext,
  P2shAddressContext,
  P2trAddressContext,
  P2wpkhAddressContext,
  TransactionContext,
  createTransactionContext,
} from '../../../../transactions/bitcoin/context';
import { TestAddressContext, addresses } from './helpers';

vi.mock('../../../../api/esplora/esploraAPiProvider');

describe('TransactionContext', () => {
  const seedVault = vi.fn() as any;
  const utxoCache = vi.fn() as any;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should create context with different addresses', () => {
    const paymentAddressContext = new TestAddressContext(
      'p2wpkh',
      addresses[0].nestedSegwit,
      addresses[0].nestedSegwitPubKey,
      0n,
      seedVault,
      utxoCache,
    );
    const ordinalsAddressContext = new TestAddressContext(
      'p2wpkh',
      addresses[0].taproot,
      addresses[0].taprootPubKey,
      0n,
      seedVault,
      utxoCache,
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
      seedVault,
      utxoCache,
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
        seedVault,
        utxoCache,
      );
      const ordinalsAddressContext = new TestAddressContext(
        'p2wpkh',
        addresses[0].taproot,
        addresses[0].taprootPubKey,
        0n,
        seedVault,
        utxoCache,
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
        seedVault,
        utxoCache,
      );
      const ordinalsAddressContext = new TestAddressContext(
        'p2wpkh',
        addresses[0].taproot,
        addresses[0].taprootPubKey,
        0n,
        seedVault,
        utxoCache,
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
        seedVault,
        utxoCache,
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
        seedVault,
        utxoCache,
      );
      const ordinalsAddressContext = new TestAddressContext(
        'p2wpkh',
        addresses[0].taproot,
        addresses[0].taprootPubKey,
        0n,
        seedVault,
        utxoCache,
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
        seedVault,
        utxoCache,
      );
      const ordinalsAddressContext = new TestAddressContext(
        'p2wpkh',
        addresses[0].taproot,
        addresses[0].taprootPubKey,
        0n,
        seedVault,
        utxoCache,
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
        seedVault,
        utxoCache,
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
        seedVault,
        utxoCache,
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
        seedVault,
        utxoCache,
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

describe('ExtendedUtxo', () => {
  const utxoCache = {
    getUtxoByOutpoint: vi.fn(),
  } as any;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should construct correctly', () => {
    const dummyUtxo = { txid: 'txid', vout: 1 } as any;
    const esploraApi = new EsploraProvider({ network: 'Mainnet' });
    const extendedUtxo = new ExtendedUtxo(dummyUtxo, 'address', utxoCache, esploraApi);

    expect(extendedUtxo.outpoint).toEqual('txid:1');
    expect(extendedUtxo.utxo).toEqual(dummyUtxo);
  });

  it('should try get hex from esplora and cache it', async () => {
    const dummyUtxo = { txid: 'txid', vout: 1 } as any;
    const esploraApi = new EsploraProvider({ network: 'Mainnet' });
    const extendedUtxo = new ExtendedUtxo(dummyUtxo, 'address', utxoCache, esploraApi);

    const getHexMock = vi.mocked(vi.mocked(EsploraProvider).mock.instances[0].getTransactionHex);
    getHexMock.mockResolvedValueOnce('hex');

    let hex = await extendedUtxo.hex;

    expect(hex).toEqual('hex');
    expect(getHexMock).toHaveBeenCalledTimes(1);

    // refire the get, should come from cached value
    hex = await extendedUtxo.hex;
    expect(getHexMock).toHaveBeenCalledTimes(1);
  });

  it('should try get hex from esplora and reject if call fails', async () => {
    const dummyUtxo = { txid: 'txid', vout: 1 } as any;
    const esploraApi = new EsploraProvider({ network: 'Mainnet' });
    const extendedUtxo = new ExtendedUtxo(dummyUtxo, 'address', utxoCache, esploraApi);

    const getHexMock = vi.mocked(vi.mocked(EsploraProvider).mock.instances[0].getTransactionHex);
    getHexMock.mockRejectedValueOnce('Error!');

    await expect(() => extendedUtxo.hex).rejects.toThrow('Error!');
  });

  it('should get bundle data from cache', async () => {
    const dummyUtxo = { txid: 'txid', vout: 1 } as any;
    const esploraApi = new EsploraProvider({ network: 'Mainnet' });
    const extendedUtxo = new ExtendedUtxo(dummyUtxo, 'address', utxoCache, esploraApi);

    utxoCache.getUtxoByOutpoint.mockResolvedValueOnce('bundleData');

    const bundleData = await extendedUtxo.getBundleData();

    expect(bundleData).toEqual('bundleData');
    expect(utxoCache.getUtxoByOutpoint).toHaveBeenCalledTimes(1);
    expect(utxoCache.getUtxoByOutpoint).toHaveBeenCalledWith('txid:1', 'address');
  });

  it('should return false if not embellished with inscription or satribute', async () => {
    const dummyUtxo = { txid: 'txid', vout: 1 } as any;
    const esploraApi = new EsploraProvider({ network: 'Mainnet' });
    const extendedUtxo = new ExtendedUtxo(dummyUtxo, 'address', utxoCache, esploraApi);

    utxoCache.getUtxoByOutpoint.mockResolvedValueOnce({
      sat_ranges: [{ inscriptions: [], satributes: [] }],
    });

    const isEmbellished = await extendedUtxo.isEmbellished();

    expect(isEmbellished).toEqual(false);
  });

  it('should return true if isEmbellished with inscription', async () => {
    const dummyUtxo = { txid: 'txid', vout: 1 } as any;
    const esploraApi = new EsploraProvider({ network: 'Mainnet' });
    const extendedUtxo = new ExtendedUtxo(dummyUtxo, 'address', utxoCache, esploraApi);

    utxoCache.getUtxoByOutpoint.mockResolvedValueOnce({
      sat_ranges: [{ inscriptions: ['inscription'], satributes: [] }],
    });

    const isEmbellished = await extendedUtxo.isEmbellished();

    expect(isEmbellished).toEqual(true);
  });

  it('should return true if isEmbellished with satributes', async () => {
    const dummyUtxo = { txid: 'txid', vout: 1 } as any;
    const esploraApi = new EsploraProvider({ network: 'Mainnet' });
    const extendedUtxo = new ExtendedUtxo(dummyUtxo, 'address', utxoCache, esploraApi);

    utxoCache.getUtxoByOutpoint.mockResolvedValueOnce({
      sat_ranges: [{ inscriptions: [], satributes: ['satribute'] }],
    });

    const isEmbellished = await extendedUtxo.isEmbellished();

    expect(isEmbellished).toEqual(true);
  });
});

describe('createTransactionContext', () => {
  const seedVault = vi.fn() as any;
  const utxoCache = vi.fn() as any;

  it('creates transaction context with correct addresses - p2sh + p2tr', () => {
    const context = createTransactionContext({
      wallet: {
        accountIndex: 0n,
        btcAddress: addresses[0].nestedSegwit,
        btcPublicKey: addresses[0].nestedSegwitPubKey,
        ordinalsAddress: addresses[0].taproot,
        ordinalsPublicKey: addresses[0].taprootPubKey,
        accountType: 'software',
      },
      network: 'Mainnet',
      seedVault,
      utxoCache,
    });

    expect(context.paymentAddress instanceof P2shAddressContext).toEqual(true);
    expect(context.ordinalsAddress instanceof P2trAddressContext).toEqual(true);
  });

  it('creates transaction context with correct addresses - p2wpkh + p2tr', () => {
    const context = createTransactionContext({
      wallet: {
        accountIndex: 0n,
        btcAddress: addresses[0].nativeSegwit,
        btcPublicKey: addresses[0].nativeSegwitPubKey,
        ordinalsAddress: addresses[0].taproot,
        ordinalsPublicKey: addresses[0].taprootPubKey,
        accountType: 'software',
      },
      network: 'Mainnet',
      seedVault,
      utxoCache,
    });

    expect(context.paymentAddress instanceof P2wpkhAddressContext).toEqual(true);
    expect(context.ordinalsAddress instanceof P2trAddressContext).toEqual(true);
  });

  it('creates transaction context with correct addresses - p2wpkh + p2wpkh', () => {
    const context = createTransactionContext({
      wallet: {
        accountIndex: 0n,
        btcAddress: addresses[0].nativeSegwit,
        btcPublicKey: addresses[0].nativeSegwitPubKey,
        ordinalsAddress: addresses[0].nativeSegwit,
        ordinalsPublicKey: addresses[0].nativeSegwitPubKey,
        accountType: 'software',
      },
      network: 'Mainnet',
      seedVault,
      utxoCache,
    });

    expect(context.paymentAddress instanceof P2wpkhAddressContext).toEqual(true);
    expect(context.ordinalsAddress instanceof P2wpkhAddressContext).toEqual(true);
    expect(context.paymentAddress).toEqual(context.ordinalsAddress);
  });

  it('creates transaction context with correct addresses - ledger p2wpkh + p2tr', () => {
    const context = createTransactionContext({
      wallet: {
        accountIndex: 0n,
        btcAddress: addresses[0].nativeSegwit,
        btcPublicKey: addresses[0].nativeSegwitPubKey,
        ordinalsAddress: addresses[0].taproot,
        ordinalsPublicKey: addresses[0].taprootPubKey,
        accountType: 'ledger',
      },
      network: 'Mainnet',
      seedVault,
      utxoCache,
      ledgerTransport: vi.fn() as any,
    });

    expect(context.paymentAddress instanceof LedgerP2wpkhAddressContext).toEqual(true);
    expect(context.ordinalsAddress instanceof LedgerP2trAddressContext).toEqual(true);
  });
});
