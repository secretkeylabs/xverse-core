import { beforeEach, describe, expect, it, vi } from 'vitest';
import { StorageAdapter, UtxoCache, UtxoCacheStruct } from '../../api/utxoCache';

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

  describe('getUtxo', () => {
    it('should return cached utxo if it exists', async () => {
      vi.spyOn(utxoCache as any, '_getCache').mockResolvedValueOnce({ version: 1, utxos: mockCache });
      const utxo = await utxoCache.getUtxo('txid1:0', 'address1');
      expect(utxo).toEqual(mockCache['txid1:0']);
    });

    it('should fetch utxo from API and cache it if it does not exist in cache', async () => {
      vi.spyOn(utxoCache as any, '_getCache').mockResolvedValueOnce({ utxos: {}, version: 1 });
      const mockUtxo = {
        txid: 'txid1',
        vout: 0,
        inscriptions: [],
        block_height: 123,
        value: 456,
        sats: [],
      };
      const mockGetUtxoOrdinalBundle = vi.fn().mockResolvedValueOnce(mockUtxo);
      vi.spyOn(utxoCache as any, '_getUtxo').mockImplementationOnce(mockGetUtxoOrdinalBundle);
      await utxoCache.getUtxo('txid1:0', 'address1');
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

  describe('setUtxo', () => {
    it('should set utxo in cache', async () => {
      vi.spyOn(utxoCache as any, '_getCache').mockResolvedValueOnce({ version: 1, utxos: mockCache });
      await utxoCache.setUtxo(
        'txid3:2',
        { txid: 'txid3', vout: 2, inscriptions: [], block_height: 123, value: 456, sats: [] },
        'address1',
        mockCache,
      );
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

  describe('removeUtxo', () => {
    it('should remove utxo from cache', async () => {
      vi.spyOn(utxoCache as any, '_getCache').mockResolvedValueOnce({ version: 1, utxos: mockCache });
      await utxoCache.removeUtxo('txid1:0', 'address1');
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
      const mockGetAddressUtxoOrdinalBundles = vi.fn().mockResolvedValueOnce([
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
      ]);
      vi.spyOn(utxoCache as any, '_getAddressUtxos').mockImplementationOnce(mockGetAddressUtxoOrdinalBundles);
      await utxoCache.initCache('address1');
      expect(mockGetAddressUtxoOrdinalBundles).toHaveBeenCalledWith('address1');
      expect(mockStorageAdapter.set).toHaveBeenCalledWith(
        'utxoCache-address1',
        JSON.stringify({
          version: 1,
          utxos: mockCache,
        }),
      );
    });

    it('should not fetch utxos if cache is already up to date', async () => {
      vi.spyOn(utxoCache as any, '_getCache').mockResolvedValueOnce({ version: 1, utxos: mockCache });
      const mockGetAddressUtxoOrdinalBundles = vi.fn();
      vi.spyOn(utxoCache as any, '_getUtxo').mockImplementationOnce(mockGetAddressUtxoOrdinalBundles);
      await utxoCache.initCache('address1');
      expect(mockGetAddressUtxoOrdinalBundles).not.toHaveBeenCalled();
      expect(mockStorageAdapter.set).not.toHaveBeenCalled();
    });
  });
});
