import * as btc from '@scure/btc-signer';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import EsploraProvider from '../../../api/esplora/esploraAPiProvider';
import { ExtendedUtxo } from '../../../transactions/bitcoin';
import {
  KeystoneP2trAddressContext,
  KeystoneP2wpkhAddressContext,
  LedgerP2trAddressContext,
  LedgerP2wpkhAddressContext,
  SoftwareP2shAddressContext,
  SoftwareP2trAddressContext,
  SoftwareP2wpkhAddressContext,
  TransactionContext,
} from '../../../transactions/bitcoin/context';
import { createTransactionContext } from '../../../transactions/bitcoin/contextFactory';
import { WalletId } from '../../../vaults';
import { TestAddressContext, addresses } from './helpers';

vi.mock('../../../api/esplora/esploraAPiProvider');

describe('TransactionContext', () => {
  const seedVault = vi.fn() as any;
  const utxoCache = vi.fn() as any;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should create context with different addresses', () => {
    const esploraProvider = new EsploraProvider({ network: 'Mainnet' });

    const paymentAddressContext = new TestAddressContext('p2wpkh', {
      accountType: 'software',
      walletId: 'walletId' as WalletId,
      address: addresses[0].nestedSegwit,
      publicKey: addresses[0].nestedSegwitPubKey,
      accountIndex: 0,
      seedVault,
      utxoCache,
      esploraApiProvider: esploraProvider,
      network: 'Mainnet',
      derivationType: 'index',
    });
    const ordinalsAddressContext = new TestAddressContext('p2wpkh', {
      accountType: 'software',
      walletId: 'walletId' as WalletId,
      address: addresses[0].taproot,
      publicKey: addresses[0].taprootPubKey,
      accountIndex: 0,
      seedVault,
      utxoCache,
      esploraApiProvider: esploraProvider,
      network: 'Mainnet',
      derivationType: 'index',
    });
    const context = new TransactionContext('Mainnet', esploraProvider, paymentAddressContext, ordinalsAddressContext);
    expect(context.paymentAddress).toStrictEqual(paymentAddressContext);
    expect(context.ordinalsAddress).toStrictEqual(ordinalsAddressContext);
  });

  it('should create context with same address', () => {
    const esploraProvider = new EsploraProvider({ network: 'Mainnet' });

    const addressContext = new TestAddressContext('p2wpkh', {
      accountType: 'software',
      walletId: 'walletId' as WalletId,
      address: addresses[0].nestedSegwit,
      publicKey: addresses[0].nestedSegwitPubKey,
      accountIndex: 0,
      seedVault,
      utxoCache,
      esploraApiProvider: esploraProvider,
      network: 'Mainnet',
      derivationType: 'index',
    });
    const context = new TransactionContext('Mainnet', esploraProvider, addressContext, addressContext);
    expect(context.paymentAddress).toStrictEqual(addressContext);
    expect(context.ordinalsAddress).toStrictEqual(addressContext);
  });

  describe('getUtxo', () => {
    it('getUtxo should check both addresses', async () => {
      const esploraProvider = new EsploraProvider({ network: 'Mainnet' });

      const paymentAddressContext = new TestAddressContext('p2wpkh', {
        accountType: 'software',
        walletId: 'walletId' as WalletId,
        address: addresses[0].nestedSegwit,
        publicKey: addresses[0].nestedSegwitPubKey,
        accountIndex: 0,
        seedVault,
        utxoCache,
        esploraApiProvider: esploraProvider,
        network: 'Mainnet',
        derivationType: 'index',
      });
      const ordinalsAddressContext = new TestAddressContext('p2wpkh', {
        accountType: 'software',
        walletId: 'walletId' as WalletId,
        address: addresses[0].taproot,
        publicKey: addresses[0].taprootPubKey,
        accountIndex: 0,
        seedVault,
        utxoCache,
        esploraApiProvider: esploraProvider,
        network: 'Mainnet',
        derivationType: 'index',
      });
      const context = new TransactionContext('Mainnet', esploraProvider, paymentAddressContext, ordinalsAddressContext);
      const utxo = await context.getUtxo('bob');
      expect(utxo).toEqual({});
      expect(paymentAddressContext.getUtxo).toHaveBeenCalledTimes(1);
      expect(paymentAddressContext.getUtxo).toHaveBeenCalledWith('bob');
      expect(ordinalsAddressContext.getUtxo).toHaveBeenCalledTimes(1);
      expect(ordinalsAddressContext.getUtxo).toHaveBeenCalledWith('bob');
    });

    it('getUtxo should check one address only if found', async () => {
      const esploraProvider = new EsploraProvider({ network: 'Mainnet' });

      const paymentAddressContext = new TestAddressContext('p2wpkh', {
        accountType: 'software',
        walletId: 'walletId' as WalletId,
        address: addresses[0].nestedSegwit,
        publicKey: addresses[0].nestedSegwitPubKey,
        accountIndex: 0,
        seedVault,
        utxoCache,
        esploraApiProvider: esploraProvider,
        network: 'Mainnet',
        derivationType: 'index',
      });
      const ordinalsAddressContext = new TestAddressContext('p2wpkh', {
        accountType: 'software',
        walletId: 'walletId' as WalletId,
        address: addresses[0].taproot,
        publicKey: addresses[0].taprootPubKey,
        accountIndex: 0,
        seedVault,
        utxoCache,
        esploraApiProvider: esploraProvider,
        network: 'Mainnet',
        derivationType: 'index',
      });
      paymentAddressContext.getUtxo.mockResolvedValueOnce({ txid: 'txid' });

      const context = new TransactionContext('Mainnet', esploraProvider, paymentAddressContext, ordinalsAddressContext);
      const utxo = await context.getUtxo('bob');
      expect(utxo).toEqual({ addressContext: paymentAddressContext, extendedUtxo: { txid: 'txid' } });
      expect(paymentAddressContext.getUtxo).toHaveBeenCalledTimes(1);
      expect(paymentAddressContext.getUtxo).toHaveBeenCalledWith('bob');
      expect(ordinalsAddressContext.getUtxo).toHaveBeenCalledTimes(0);
    });

    it('getUtxo should run only once if payments and ordinals address are the same', async () => {
      const esploraProvider = new EsploraProvider({ network: 'Mainnet' });

      const addressContext = new TestAddressContext('p2wpkh', {
        accountType: 'software',
        walletId: 'walletId' as WalletId,
        address: addresses[0].nestedSegwit,
        publicKey: addresses[0].nestedSegwitPubKey,
        accountIndex: 0,
        seedVault,
        utxoCache,
        esploraApiProvider: esploraProvider,
        network: 'Mainnet',
        derivationType: 'index',
      });

      const context = new TransactionContext('Mainnet', esploraProvider, addressContext, addressContext);
      const utxo = await context.getUtxo('bob');
      expect(utxo).toEqual({});
      expect(addressContext.getUtxo).toHaveBeenCalledTimes(1);
      expect(addressContext.getUtxo).toHaveBeenCalledWith('bob');
    });
  });

  describe('getInscriptionUtxo', () => {
    it('getInscriptionUtxo should check both addresses', async () => {
      const esploraProvider = new EsploraProvider({ network: 'Mainnet' });

      const paymentAddressContext = new TestAddressContext('p2wpkh', {
        accountType: 'software',
        walletId: 'walletId' as WalletId,
        address: addresses[0].nestedSegwit,
        publicKey: addresses[0].nestedSegwitPubKey,
        accountIndex: 0,
        seedVault,
        utxoCache,
        esploraApiProvider: esploraProvider,
        network: 'Mainnet',
        derivationType: 'index',
      });
      const ordinalsAddressContext = new TestAddressContext('p2wpkh', {
        accountType: 'software',
        walletId: 'walletId' as WalletId,
        address: addresses[0].taproot,
        publicKey: addresses[0].taprootPubKey,
        accountIndex: 0,
        seedVault,
        utxoCache,
        esploraApiProvider: esploraProvider,
        network: 'Mainnet',
        derivationType: 'index',
      });
      paymentAddressContext.getUtxos.mockResolvedValueOnce([]);
      ordinalsAddressContext.getUtxos.mockResolvedValueOnce([]);

      const context = new TransactionContext('Mainnet', esploraProvider, paymentAddressContext, ordinalsAddressContext);

      const resp = await context.getInscriptionUtxo('bob');

      expect(resp).toEqual({});
      expect(paymentAddressContext.getUtxos).toHaveBeenCalledTimes(1);
      expect(ordinalsAddressContext.getUtxos).toHaveBeenCalledTimes(1);
    });

    it('getInscriptionUtxo should check only first address if found', async () => {
      const esploraProvider = new EsploraProvider({ network: 'Mainnet' });

      const paymentAddressContext = new TestAddressContext('p2wpkh', {
        accountType: 'software',
        walletId: 'walletId' as WalletId,
        address: addresses[0].nestedSegwit,
        publicKey: addresses[0].nestedSegwitPubKey,
        accountIndex: 0,
        seedVault,
        utxoCache,
        esploraApiProvider: esploraProvider,
        network: 'Mainnet',
        derivationType: 'index',
      });
      const ordinalsAddressContext = new TestAddressContext('p2wpkh', {
        accountType: 'software',
        walletId: 'walletId' as WalletId,
        address: addresses[0].taproot,
        publicKey: addresses[0].taprootPubKey,
        accountIndex: 0,
        seedVault,
        utxoCache,
        esploraApiProvider: esploraProvider,
        network: 'Mainnet',
        derivationType: 'index',
      });
      const dummyExtendedUtxo = { getBundleData: () => ({ sat_ranges: [{ inscriptions: [{ id: 'bob' }] }] }) };
      paymentAddressContext.getUtxos.mockResolvedValueOnce([dummyExtendedUtxo]);

      const context = new TransactionContext('Mainnet', esploraProvider, paymentAddressContext, ordinalsAddressContext);

      const resp = await context.getInscriptionUtxo('bob');

      expect(resp).toEqual({ addressContext: paymentAddressContext, extendedUtxo: dummyExtendedUtxo });
      expect(paymentAddressContext.getUtxos).toHaveBeenCalledTimes(1);
      expect(ordinalsAddressContext.getUtxos).toHaveBeenCalledTimes(0);
    });

    it('getInscriptionUtxo should call only once if addresses are the same', async () => {
      const esploraProvider = new EsploraProvider({ network: 'Mainnet' });

      const paymentAddressContext = new TestAddressContext('p2wpkh', {
        accountType: 'software',
        walletId: 'walletId' as WalletId,
        address: addresses[0].nestedSegwit,
        publicKey: addresses[0].nestedSegwitPubKey,
        accountIndex: 0,
        seedVault,
        utxoCache,
        esploraApiProvider: esploraProvider,
        network: 'Mainnet',
        derivationType: 'index',
      });
      paymentAddressContext.getUtxos.mockResolvedValueOnce([]);

      const context = new TransactionContext('Mainnet', esploraProvider, paymentAddressContext, paymentAddressContext);

      const resp = await context.getInscriptionUtxo('bob');

      expect(resp).toEqual({});
      expect(paymentAddressContext.getUtxos).toHaveBeenCalledTimes(1);
    });
  });

  describe('addOutputAddress', () => {
    it('adds output address to the transaction with correct network - mainnet', () => {
      const esploraProvider = new EsploraProvider({ network: 'Mainnet' });

      const paymentAddressContext = new TestAddressContext('p2wpkh', {
        accountType: 'software',
        walletId: 'walletId' as WalletId,
        address: addresses[0].nestedSegwit,
        publicKey: addresses[0].nestedSegwitPubKey,
        accountIndex: 0,
        seedVault,
        utxoCache,
        esploraApiProvider: esploraProvider,
        network: 'Mainnet',
        derivationType: 'index',
      });
      const context = new TransactionContext('Mainnet', esploraProvider, paymentAddressContext, paymentAddressContext);

      const dummyTransaction = {
        outputsLength: 6,
        getOutput: vi.fn(),
        addOutputAddress: vi.fn(),
      } as any;

      dummyTransaction.getOutput.mockReturnValueOnce({ script: new Uint8Array([0x6a, 0x01, 0x5a]) });

      const result = context.addOutputAddress(dummyTransaction, 'bob', 1000n);

      expect(result).toEqual({
        script: ['RETURN', '5a'],
        scriptHex: '6a015a',
      });

      expect(dummyTransaction.getOutput).toHaveBeenCalledTimes(1);
      expect(dummyTransaction.getOutput).toHaveBeenCalledWith(5);
      expect(dummyTransaction.addOutputAddress).toHaveBeenCalledTimes(1);
      expect(dummyTransaction.addOutputAddress).toHaveBeenCalledWith('bob', 1000n, btc.NETWORK);
    });

    it('adds output address to the transaction with correct network - testnet', () => {
      const esploraProvider = new EsploraProvider({ network: 'Mainnet' });

      const paymentAddressContext = new TestAddressContext('p2wpkh', {
        accountType: 'software',
        walletId: 'walletId' as WalletId,
        address: addresses[0].nestedSegwit,
        publicKey: addresses[0].nestedSegwitPubKey,
        accountIndex: 0,
        seedVault,
        utxoCache,
        esploraApiProvider: esploraProvider,
        network: 'Mainnet',
        derivationType: 'index',
      });
      const context = new TransactionContext('Testnet', esploraProvider, paymentAddressContext, paymentAddressContext);

      const dummyTransaction = {
        outputsLength: 1,
        getOutput: vi.fn(),
        addOutputAddress: vi.fn(),
      } as any;

      dummyTransaction.getOutput.mockReturnValueOnce({ script: new Uint8Array([0x02, 0x5a, 0x69]) });

      const result = context.addOutputAddress(dummyTransaction, 'bob', 1000n);

      expect(result).toEqual({
        script: ['5a69'],
        scriptHex: '025a69',
      });

      expect(dummyTransaction.getOutput).toHaveBeenCalledTimes(1);
      expect(dummyTransaction.getOutput).toHaveBeenCalledWith(0);
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

    const response = {
      sat_ranges: [{ inscriptions: [], satributes: [] }],
    };
    utxoCache.getUtxoByOutpoint.mockResolvedValueOnce(response);

    const bundleData = await extendedUtxo.getBundleData();

    expect(bundleData).toEqual(response);
    expect(utxoCache.getUtxoByOutpoint).toHaveBeenCalledTimes(1);
    expect(utxoCache.getUtxoByOutpoint).toHaveBeenCalledWith('txid:1', 'address', false);
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
      sat_ranges: [{ inscriptions: [], satributes: ['UNCOMMON'] }],
    });

    const isEmbellished = await extendedUtxo.isEmbellished();

    expect(isEmbellished).toEqual(true);
  });
});

describe('createTransactionContext', () => {
  const seedVault = vi.fn() as any;
  const utxoCache = vi.fn() as any;

  it('creates transaction context with correct addresses - p2sh + p2tr', () => {
    const esploraApiProvider = new EsploraProvider({ network: 'Mainnet' });
    const context = createTransactionContext({
      esploraApiProvider,
      account: {
        id: 0,
        walletId: 'walletId' as WalletId,
        accountType: 'software',
        stxAddress: '',
        masterPubKey: '',
        stxPublicKey: '',
        btcAddresses: {
          nested: {
            address: addresses[0].nestedSegwit,
            publicKey: addresses[0].nestedSegwitPubKey,
          },
          native: {
            address: addresses[0].nativeSegwit,
            publicKey: addresses[0].nativeSegwitPubKey,
          },
          taproot: {
            address: addresses[0].taproot,
            publicKey: addresses[0].taprootPubKey,
          },
        },
      },
      walletId: 'walletId' as WalletId,
      network: 'Mainnet',
      seedVault,
      utxoCache,
      btcPaymentAddressType: 'nested',
      derivationType: 'index',
    });

    expect(context.paymentAddress instanceof SoftwareP2shAddressContext).toEqual(true);
    expect(context.ordinalsAddress instanceof SoftwareP2trAddressContext).toEqual(true);
  });

  it('creates transaction context with correct addresses - p2wpkh + p2tr', () => {
    const esploraApiProvider = new EsploraProvider({ network: 'Mainnet' });
    const context = createTransactionContext({
      esploraApiProvider,
      account: {
        id: 0,
        walletId: 'walletId' as WalletId,
        accountType: 'software',
        stxAddress: '',
        masterPubKey: '',
        stxPublicKey: '',
        btcAddresses: {
          nested: {
            address: addresses[0].nestedSegwit,
            publicKey: addresses[0].nestedSegwitPubKey,
          },
          native: {
            address: addresses[0].nativeSegwit,
            publicKey: addresses[0].nativeSegwitPubKey,
          },
          taproot: {
            address: addresses[0].taproot,
            publicKey: addresses[0].taprootPubKey,
          },
        },
      },
      walletId: 'walletId' as WalletId,
      network: 'Mainnet',
      seedVault,
      utxoCache,
      btcPaymentAddressType: 'native',
      derivationType: 'index',
    });

    expect(context.paymentAddress instanceof SoftwareP2wpkhAddressContext).toEqual(true);
    expect(context.ordinalsAddress instanceof SoftwareP2trAddressContext).toEqual(true);
  });

  it('creates transaction context with correct addresses - ledger p2wpkh + p2tr', () => {
    const esploraApiProvider = new EsploraProvider({ network: 'Mainnet' });
    const context = createTransactionContext({
      esploraApiProvider,
      account: {
        id: 0,
        deviceAccountIndex: 0,
        accountType: 'ledger',
        stxAddress: '',
        masterPubKey: '',
        stxPublicKey: '',
        btcAddresses: {
          native: {
            address: addresses[0].nativeSegwit,
            publicKey: addresses[0].nativeSegwitPubKey,
          },
          taproot: {
            address: addresses[0].taproot,
            publicKey: addresses[0].taprootPubKey,
          },
        },
      },
      network: 'Mainnet',
      seedVault,
      utxoCache,
      btcPaymentAddressType: 'native',
      derivationType: 'index',
    });

    expect(context.paymentAddress instanceof LedgerP2wpkhAddressContext).toEqual(true);
    expect(context.ordinalsAddress instanceof LedgerP2trAddressContext).toEqual(true);
  });

  it('creates transaction context with correct addresses - keystone p2wpkh + p2tr', () => {
    const esploraApiProvider = new EsploraProvider({ network: 'Mainnet' });
    const context = createTransactionContext({
      esploraApiProvider,
      account: {
        id: 0,
        deviceAccountIndex: 0,
        accountType: 'keystone',
        stxAddress: '',
        masterPubKey: '',
        stxPublicKey: '',
        btcAddresses: {
          native: {
            address: addresses[0].nativeSegwit,
            publicKey: addresses[0].nativeSegwitPubKey,
          },
          taproot: {
            address: addresses[0].taproot,
            publicKey: addresses[0].taprootPubKey,
          },
        },
      },
      network: 'Mainnet',
      seedVault,
      utxoCache,
      btcPaymentAddressType: 'native',
      derivationType: 'index',
    });

    expect(context.paymentAddress instanceof KeystoneP2wpkhAddressContext).toEqual(true);
    expect(context.ordinalsAddress instanceof KeystoneP2trAddressContext).toEqual(true);
  });
});
