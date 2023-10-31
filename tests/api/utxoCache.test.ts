import MockDate from 'mockdate';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { StorageAdapter, UtxoCache, UtxoCacheStruct } from '../../api/utxoCache';

import { getAddressUtxoOrdinalBundles, getUtxoOrdinalBundle } from '../../api/ordinals';

vi.mock('../../api/ordinals');

describe('UtxoCache', () => {
  let utxoCache: UtxoCache;
  let mockStorageAdapter: StorageAdapter;
  let mockCache: UtxoCacheStruct;

  beforeEach(() => {
    mockCache = {
      'txid1:0': {
        txid: 'txid1',
        vout: 0,
        block_height: 123,
        value: 456,
        sat_ranges: [],
      },
      'txid2:1': {
        txid: 'txid2',
        vout: 1,
        block_height: 123,
        value: 456,
        sat_ranges: [],
      },
    };
    mockStorageAdapter = {
      get: vi.fn(),
      set: vi.fn(),
      remove: vi.fn(),
    };
    utxoCache = new UtxoCache({
      cacheStorageController: mockStorageAdapter,
      network: 'Mainnet',
    });
  });

  it('should return cached utxo if it exists', async () => {
    mockStorageAdapter.get = vi
      .fn()
      .mockResolvedValueOnce(JSON.stringify({ version: 1, syncTime: 0, utxos: mockCache }));

    const utxo = await utxoCache.getUtxoByOutpoint('txid1:0', 'address1');
    expect(utxo).toEqual(mockCache['txid1:0']);
  });

  it('should fetch utxo from API and cache it if it does not exist in cache', async () => {
    mockStorageAdapter.get = vi.fn().mockResolvedValueOnce(JSON.stringify({ utxos: {}, syncTime: 0, version: 1 }));

    const mockUtxo = {
      txid: 'txid1',
      vout: 0,
      block_height: 123,
      value: 456,
      sat_ranges: [],
    };
    vi.mocked(getUtxoOrdinalBundle).mockResolvedValueOnce(mockUtxo);

    const cachedValue = await utxoCache.getUtxoByOutpoint('txid1:0', 'address1');
    expect(cachedValue).toEqual(mockUtxo);

    expect(getUtxoOrdinalBundle).toHaveBeenCalledWith('Mainnet', 'txid1', 0);
    expect(mockStorageAdapter.set).toHaveBeenCalledWith(
      'utxoCache-address1',
      JSON.stringify({
        utxos: {
          'txid1:0': mockUtxo,
        },
        syncTime: 0,
        version: 1,
      }),
    );
  });

  it('should initialise cache if it does not exist', async () => {
    mockStorageAdapter.get = vi.fn().mockResolvedValueOnce(null);

    const mockUtxos = [
      {
        txid: 'txid1',
        vout: 0,
        block_height: 123,
        value: 456,
        sat_ranges: [],
      },
      {
        txid: 'txid2',
        vout: 0,
        block_height: 123,
        value: 456,
        sat_ranges: [],
      },
    ];
    vi.mocked(getAddressUtxoOrdinalBundles).mockResolvedValueOnce({
      limit: 1,
      offset: 0,
      results: [mockUtxos[0]],
      total: 2,
    });
    vi.mocked(getAddressUtxoOrdinalBundles).mockResolvedValueOnce({
      limit: 1,
      offset: 1,
      results: [mockUtxos[1]],
      total: 2,
    });
    MockDate.set(0);

    const result = await utxoCache.getUtxo('txid1', 0, 'address1');

    expect(result).toEqual(mockUtxos[0]);

    // should get all pages
    expect(getAddressUtxoOrdinalBundles).toHaveBeenCalledTimes(2);
    expect(getAddressUtxoOrdinalBundles).toHaveBeenCalledWith('Mainnet', 'address1', 0, 60, { hideUnconfirmed: true });
    expect(getAddressUtxoOrdinalBundles).toHaveBeenCalledWith('Mainnet', 'address1', 1, 1, { hideUnconfirmed: true });

    expect(mockStorageAdapter.set).toHaveBeenCalledWith(
      'utxoCache-address1',
      JSON.stringify({
        version: 1,
        syncTime: 0,
        utxos: {
          'txid1:0': mockUtxos[0],
          'txid2:0': mockUtxos[1],
        },
      }),
    );
  });
});
