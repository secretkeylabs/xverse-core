import { beforeEach, describe, expect, it, vi } from 'vitest';
import { StorageAdapter, UtxoCache, UtxoCacheStruct } from '../../api/utxoCache';
import { UtxoOrdinalBundle } from '../../types/api/xverse/ordinals';

describe('UtxoCache', () => {
  let utxoCache: UtxoCache;
  let mockStorageAdapter: StorageAdapter;
  let mockCache: UtxoCacheStruct;

  beforeEach(() => {
    mockCache = {
      'txid1:0': {
        txid: 'txid1',
        vout: 0,
        inscriptions: [],
        block_height: 123,
        value: 456,
        sats: [],
      },
      'txid2:1': {
        txid: 'txid2',
        vout: 1,
        inscriptions: [],
        block_height: 123,
        value: 456,
        sats: [],
      },
    };
    mockStorageAdapter = {
      get: vi.fn(),
      set: vi.fn(),
      remove: vi.fn(),
    };
    utxoCache = new UtxoCache({
      cacheStorageController: mockStorageAdapter,
    });
  });

  describe('getUtxoState', () => {
    it('should return cached utxo if it exists', async () => {
      utxoCache._getCache = vi.fn().mockResolvedValueOnce({ utxos: mockCache, version: 1 });
      const utxo = await utxoCache.getUtxoState('txid1:0', 'address1');
      expect(utxo).toEqual(mockCache['txid1:0']);
    });

    it('should fetch utxo from API and cache it if it does not exist in cache', async () => {
      utxoCache._getCache = vi.fn().mockResolvedValueOnce(JSON.stringify({ version: 1, utxos: {} }));
      const mockUtxo = {
        txid: 'txid1',
        vout: 0,
        inscriptions: [],
        block_height: 123,
        value: 456,
        sats: [],
      };
      const mockGetUtxoOrdinalBundle = vi.fn().mockResolvedValueOnce(mockUtxo);
      utxoCache._getUtxo = mockGetUtxoOrdinalBundle;
      await utxoCache.getUtxoState('txid1:0', 'address1');
      expect(mockGetUtxoOrdinalBundle).toHaveBeenCalledWith('txid1', 0);
      expect(mockStorageAdapter.set).toHaveBeenCalledWith(
        'utxoCache-address1',
        JSON.stringify({
          version: 1,
          utxos: {
            'txid1:0': mockUtxo,
          },
        }),
      );
    });
  });

  describe('setUtxoState', () => {
    it('should set utxo state in cache', async () => {
      utxoCache._getCache = vi.fn().mockResolvedValueOnce({ version: 1, utxos: mockCache });
      await utxoCache.setUtxoState('txid3:2', mockCache['txid3:2'], 'address1', mockCache);
      expect(mockStorageAdapter.set).toHaveBeenCalledWith(
        'utxoCache-address1',
        JSON.stringify({
          version: 1,
          utxos: {
            ...mockCache,
            'txid3:2': { txid: 'txid3', vout: 2, inscriptions: [], block_height: 123, value: 456, sats: [] },
          },
        }),
      );
    });
  });

  describe('removeUtxoState', () => {
    it('should remove utxo state from cache', async () => {
      utxoCache._getCache = vi.fn().mockResolvedValueOnce({ version: 1, utxos: mockCache });
      await utxoCache.removeUtxoState('txid1:0', 'address1');
      expect(mockStorageAdapter.set).toHaveBeenCalledWith(
        'utxoCache-address1',
        JSON.stringify({
          version: 1,
          utxos: {
            'txid2:1': mockCache['txid2:1'],
          },
        }),
      );
    });
  });

  describe('initCache', () => {
    it('should fetch all utxos for address and cache them', async () => {
      const mockGetAddressUtxoOrdinalBundles = vi.fn().mockResolvedValueOnce({
        results: [
          {
            txid: 'txid1',
            vout: 0,
            inscriptions: [],
            block_height: 123,
            value: 456,
            sats: [],
          },
          {
            txid: 'txid2',
            vout: 1,
            inscriptions: [],
            block_height: 123,
            value: 456,
            sats: [],
          },
        ],
      });
      utxoCache._getAddressUtxos = mockGetAddressUtxoOrdinalBundles;
      await utxoCache.initCache('address1');
      expect(utxoCache._getAddressUtxos).toHaveBeenCalledWith('address1');
      expect(mockStorageAdapter.set).toHaveBeenCalledWith(
        'utxoCache-address1',
        JSON.stringify({
          version: 1,
          utxos: mockCache,
        }),
      );
    });

    it('should not fetch utxos if cache is already up to date', async () => {
      utxoCache._getCache = vi.fn().mockResolvedValueOnce({ version: 1, utxos: mockCache });
      const mockGetAddressUtxoOrdinalBundles = vi.fn();
      utxoCache._getAddressUtxos = mockGetAddressUtxoOrdinalBundles;
      await utxoCache.initCache('address1');
      expect(mockGetAddressUtxoOrdinalBundles).not.toHaveBeenCalled();
      expect(mockStorageAdapter.set).not.toHaveBeenCalled();
    });
  });
});
