import { beforeEach, describe, expect, it, vi } from 'vitest';
import { UtxoCache } from '../../api/utxoCache';

describe('UtxoCache', () => {
  const cacheStorageController = {
    get: vi.fn(),
    set: vi.fn(),
    remove: vi.fn(),
  };
  const utxoCache = new UtxoCache({ cacheStorageController });

  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe('getUtxoState', () => {
    it('should return the cached state if it exists', async () => {
      const cachedState = 'inscribed';
      utxoCache._getCache = vi.fn().mockResolvedValue({ utxoId: cachedState });

      const utxoId = 'utxoId';
      const state = await utxoCache.getUtxoState(utxoId);

      expect(state).toEqual(cachedState);
      expect(utxoCache._getCache).toHaveBeenCalledTimes(1);
      expect(utxoCache._getCache).toHaveBeenCalledWith();
    });

    it('should return the state from the blockchain if it is not cached', async () => {
      utxoCache._getCache = vi.fn().mockResolvedValue({});

      const utxoId = 'txid:1';
      const utxo = {
        inscriptions: [{ payload: 'payload' }],
        block_height: 1,
      };
      const getUtxoOrdinalBundle = vi.fn().mockResolvedValue(utxo);
      utxoCache._getUtxo = getUtxoOrdinalBundle;

      const state = await utxoCache.getUtxoState(utxoId);

      expect(state).toEqual('inscribed');
      expect(getUtxoOrdinalBundle).toHaveBeenCalledTimes(1);
      expect(getUtxoOrdinalBundle).toHaveBeenCalledWith('txid', 1);
      expect(cacheStorageController.set).toHaveBeenCalledTimes(1);
      expect(cacheStorageController.set).toHaveBeenCalledWith(
        utxoCache.CACHE_STORAGE_KEY,
        JSON.stringify({ [utxoId]: 'inscribed' }),
      );
    });

    it('should return "unknown" if the utxo is unconfirmed', async () => {
      utxoCache._getCache = vi.fn().mockResolvedValue({});

      const utxoId = 'txid:2';
      const utxo = {
        inscriptions: [],
        block_height: 0,
      };
      const getUtxoOrdinalBundle = vi.fn().mockResolvedValue(utxo);
      utxoCache._getUtxo = getUtxoOrdinalBundle;

      const state = await utxoCache.getUtxoState(utxoId);

      expect(state).toEqual('unknown');
      expect(getUtxoOrdinalBundle).toHaveBeenCalledTimes(1);
      expect(getUtxoOrdinalBundle).toHaveBeenCalledWith('txid', 2);
      expect(cacheStorageController.set).toHaveBeenCalledTimes(1);
      expect(cacheStorageController.set).toHaveBeenCalledWith(
        utxoCache.CACHE_STORAGE_KEY,
        JSON.stringify({ [utxoId]: 'unknown' }),
      );
    });

    it('should return "notInscribed" if the utxo is confirmed but not inscribed', async () => {
      utxoCache._getCache = vi.fn().mockResolvedValue({});

      const utxoId = 'txid:3';
      const utxo = {
        inscriptions: [],
        block_height: 1,
      };
      const getUtxoOrdinalBundle = vi.fn().mockResolvedValue(utxo);
      utxoCache._getUtxo = getUtxoOrdinalBundle;

      const state = await utxoCache.getUtxoState(utxoId);

      expect(state).toEqual('notInscribed');
      expect(getUtxoOrdinalBundle).toHaveBeenCalledTimes(1);
      expect(getUtxoOrdinalBundle).toHaveBeenCalledWith('txid', 3);
      expect(cacheStorageController.set).toHaveBeenCalledTimes(1);
      expect(cacheStorageController.set).toHaveBeenCalledWith(
        utxoCache.CACHE_STORAGE_KEY,
        JSON.stringify({ [utxoId]: 'notInscribed' }),
      );
    });
  });

  describe('setUtxoState', () => {
    it('should set the state in the cache', async () => {
      const utxoId = 'utxoId';
      const state = 'inscribed';

      await utxoCache.setUtxoState(utxoId, state);

      expect(utxoCache._getCache).toHaveBeenCalledTimes(1);
      expect(utxoCache._getCache).toHaveBeenCalledWith();
      expect(cacheStorageController.set).toHaveBeenCalledTimes(1);
      expect(cacheStorageController.set).toHaveBeenCalledWith(
        utxoCache.CACHE_STORAGE_KEY,
        JSON.stringify({ [utxoId]: state }),
      );
    });
  });

  describe('removeUtxoState', () => {
    it('should remove the state from the cache', async () => {
      const utxoId = 'utxoId';
      utxoCache._getCache = vi.fn().mockResolvedValue({ utxoId: 'notInscribed', utxoId2: 'inscribed' });
      await utxoCache.removeUtxoState(utxoId);

      expect(utxoCache._getCache).toHaveBeenCalledTimes(1);
      expect(utxoCache._getCache).toHaveBeenCalledWith();
      expect(cacheStorageController.set).toHaveBeenCalledTimes(1);
      expect(cacheStorageController.set).toHaveBeenCalledWith(
        utxoCache.CACHE_STORAGE_KEY,
        JSON.stringify({ utxoId2: 'inscribed' }),
      );
    });
  });

  describe('clear', () => {
    it('should remove the cache from storage', async () => {
      await utxoCache.clear();

      expect(cacheStorageController.remove).toHaveBeenCalledTimes(1);
      expect(cacheStorageController.remove).toHaveBeenCalledWith(utxoCache.CACHE_STORAGE_KEY);
    });
  });

  describe('getVersion', () => {
    it('should return the version from storage', async () => {
      const version = 1;
      cacheStorageController.get = vi.fn().mockResolvedValue(version.toString());

      const result = await utxoCache.getVersion();

      expect(result).toEqual(version);
      expect(cacheStorageController.get).toHaveBeenCalledTimes(1);
      expect(cacheStorageController.get).toHaveBeenCalledWith(utxoCache.CACHE_VERSION_STORAGE_KEY);
    });

    it('should return 0 if the version is not in storage', async () => {
      cacheStorageController.get = vi.fn().mockResolvedValue(null);

      const result = await utxoCache.getVersion();

      expect(result).toEqual(0);
      expect(cacheStorageController.get).toHaveBeenCalledTimes(1);
      expect(cacheStorageController.get).toHaveBeenCalledWith(utxoCache.CACHE_VERSION_STORAGE_KEY);
    });
  });

  describe('getAllUtxos', () => {
    it('should return the states of all UTXOs for the given address', async () => {
      // Mock the getAddressUtxoOrdinalBundles function to return some UTXOs
      const getAddressUtxoOrdinalBundles = vi.fn().mockResolvedValue({
        results: [
          { txid: 'txid1', vout: 0, inscriptions: [], block_height: 1 },
          { txid: 'txid2', vout: 1, inscriptions: [{ data: 'inscription' }], block_height: 2 },
        ],
      });
      utxoCache._getAddressUtxos = getAddressUtxoOrdinalBundles;

      const utxos = await utxoCache.getAllUtxos('address');

      expect(getAddressUtxoOrdinalBundles).toHaveBeenCalledWith('address');
      expect(utxos).toEqual({
        'txid1:0': 'notInscribed',
        'txid2:1': 'inscribed',
      });
    });

    it('should include UTXOs from the ordinals address if provided', async () => {
      // Mock the getAddressUtxoOrdinalBundles function to return some UTXOs
      const getAddressUtxoOrdinalBundles = vi.fn().mockResolvedValue({
        results: [{ txid: 'txid3', vout: 2, inscriptions: [], block_height: 3 }],
      });
      utxoCache._getAddressUtxos = getAddressUtxoOrdinalBundles;

      const utxos = await utxoCache.getAllUtxos('address', 'ordinalsAddress');

      expect(getAddressUtxoOrdinalBundles).toHaveBeenCalledWith('ordinalsAddress');
      expect(utxos).toEqual({
        'txid3:2': 'notInscribed',
      });
    });
  });

  describe('initCache', () => {
    it('should initialize the cache with the states of all utxos for the given address', async () => {
      const address = 'address';
      const utxos = {
        results: [
          { txid: 'txid1', vout: 0, inscriptions: [{ payload: 'payload' }], block_height: 1 },
          { txid: 'txid2', vout: 1, inscriptions: [], block_height: 1 },
          { txid: 'txid3', vout: 2, inscriptions: [{ payload: 'payload' }], block_height: 0 },
        ],
      };
      const getAddressUtxoOrdinalBundles = vi.fn().mockResolvedValue(utxos);
      utxoCache._getAddressUtxos = getAddressUtxoOrdinalBundles;

      await utxoCache.initCache(address);

      expect(getAddressUtxoOrdinalBundles).toHaveBeenCalledTimes(1);
      expect(getAddressUtxoOrdinalBundles).toHaveBeenCalledWith(address);
      expect(cacheStorageController.set).toHaveBeenCalledTimes(2);
      expect(cacheStorageController.set).toHaveBeenCalledWith(
        utxoCache.CACHE_VERSION_STORAGE_KEY,
        utxoCache.VERSION.toString(),
      );
      expect(cacheStorageController.set).toHaveBeenCalledWith(
        utxoCache.CACHE_STORAGE_KEY,
        JSON.stringify({
          'txid1:0': 'inscribed',
          'txid2:1': 'notInscribed',
          'txid3:2': 'unknown',
        }),
      );
    });
  });
});
