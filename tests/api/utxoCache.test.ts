import MockDate from 'mockdate';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { UtxoCache, UtxoCacheStruct } from '../../api/utxoCache';

import { getAddressUtxoOrdinalBundles, getUtxoOrdinalBundle } from '../../api/ordinals';

import BigNumber from 'bignumber.js';
import { StorageAdapter } from '../../types';
import { JSONBig } from '../../utils/bignumber';

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
        runes: {
          MYRUNE: BigNumber(456),
          MYBIGRUNE: BigNumber('12345678901234567890234'),
        },
      },
      'txid2:1': {
        txid: 'txid2',
        vout: 1,
        block_height: 123,
        value: 456,
        sat_ranges: [],
        runes: {
          MYRUNE: BigNumber(123),
          MYBIGRUNE2: BigNumber('12345678901234567890'),
        },
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
    MockDate.set(0);
    mockStorageAdapter.get = vi
      .fn()
      .mockResolvedValueOnce(
        JSONBig.stringify({ version: UtxoCache.VERSION, syncTime: 0, utxos: mockCache, xVersion: 1 }),
      );

    const utxo = await utxoCache.getUtxoByOutpoint('txid1:0', 'address1');
    expect(utxo).toEqual(mockCache['txid1:0']);
  });

  it('should fetch utxo from API and cache it if it does not exist in cache', async () => {
    MockDate.set(0);
    mockStorageAdapter.get = vi
      .fn()
      .mockResolvedValue(JSONBig.stringify({ utxos: {}, syncTime: 0, version: UtxoCache.VERSION, xVersion: 1 }));

    const mockUtxo = {
      txid: 'txid1',
      vout: 0,
      block_height: 123,
      value: 456,
      sat_ranges: [],
      runes: {},
    };
    vi.mocked(getUtxoOrdinalBundle).mockResolvedValueOnce({ xVersion: 1, ...mockUtxo });

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
        version: UtxoCache.VERSION,
        xVersion: 1,
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
        runes: {
          MYBIGRUNE: BigNumber('12345678901234567890234'),
        },
      },
      {
        txid: 'txid2',
        vout: 0,
        block_height: 123,
        value: 456,
        sat_ranges: [],
        runes: {
          MYBIGRUNE: BigNumber('1234567890123456789023452445'),
        },
      },
    ];
    vi.mocked(getAddressUtxoOrdinalBundles).mockResolvedValueOnce({
      limit: 1,
      offset: 0,
      results: [mockUtxos[0]],
      total: 2,
      xVersion: 1,
    });
    vi.mocked(getAddressUtxoOrdinalBundles).mockResolvedValueOnce({
      limit: 1,
      offset: 1,
      results: [mockUtxos[1]],
      total: 2,
      xVersion: 1,
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
      JSONBig.stringify({
        version: UtxoCache.VERSION,
        syncTime: 0,
        utxos: {
          'txid1:0': mockUtxos[0],
          'txid2:0': mockUtxos[1],
        },
        xVersion: 1,
      }),
    );
  });

  it('should re-initialise cache if xVersion changes', async () => {
    MockDate.set(5);
    mockStorageAdapter.get = vi
      .fn()
      .mockResolvedValueOnce(
        JSON.stringify({ version: UtxoCache.VERSION, syncTime: 0, utxos: mockCache, xVersion: 1 }),
      );

    const mockUtxos = [
      {
        txid: 'txid1',
        vout: 0,
        block_height: 123,
        value: 456,
        sat_ranges: [],
        runes: {},
      },
      {
        txid: 'txid2',
        vout: 0,
        block_height: 123,
        value: 456,
        sat_ranges: [],
        runes: {},
      },
      {
        txid: 'txid3',
        vout: 0,
        block_height: 123,
        value: 456,
        sat_ranges: [],
        runes: {},
      },
    ];

    const mockUtxo = {
      txid: 'txid3',
      vout: 0,
      block_height: 123,
      value: 456,
      sat_ranges: [],
      runes: {},
    };
    vi.mocked(getUtxoOrdinalBundle).mockResolvedValueOnce({ xVersion: 2, ...mockUtxo });

    vi.mocked(getAddressUtxoOrdinalBundles).mockResolvedValueOnce({
      limit: 60,
      offset: 0,
      results: mockUtxos,
      total: 2,
      xVersion: 2,
    });

    const cachedValue = await utxoCache.getUtxoByOutpoint('txid3:0', 'address1');

    expect(cachedValue).toEqual(mockUtxo);

    expect(getUtxoOrdinalBundle).toHaveBeenCalledWith('Mainnet', 'txid3', 0);
    expect(getAddressUtxoOrdinalBundles).toHaveBeenCalledWith('Mainnet', 'address1', 0, 60, { hideUnconfirmed: true });
    expect(mockStorageAdapter.set).toHaveBeenCalledWith(
      'utxoCache-address1',
      JSONBig.stringify({
        version: UtxoCache.VERSION,
        syncTime: 5,
        utxos: {
          'txid1:0': mockUtxos[0],
          'txid2:0': mockUtxos[1],
          'txid3:0': mockUtxos[2],
        },
        xVersion: 2,
      }),
    );
  });

  it('should re-initialise cache if version changes', async () => {
    MockDate.set(5);
    mockStorageAdapter.get = vi
      .fn()
      .mockResolvedValueOnce(
        JSON.stringify({ version: UtxoCache.VERSION - 1, syncTime: 0, utxos: mockCache, xVersion: 1 }),
      );

    const mockUtxos = [
      {
        txid: 'txid1',
        vout: 0,
        block_height: 123,
        value: 456,
        sat_ranges: [],
        runes: {},
      },
      {
        txid: 'txid2',
        vout: 0,
        block_height: 123,
        value: 456,
        sat_ranges: [],
        runes: {},
      },
      {
        txid: 'txid3',
        vout: 0,
        block_height: 123,
        value: 456,
        sat_ranges: [],
        runes: {},
      },
    ];

    vi.mocked(getAddressUtxoOrdinalBundles).mockResolvedValueOnce({
      limit: 60,
      offset: 0,
      results: mockUtxos,
      total: 2,
      xVersion: 1,
    });

    const cachedValue = await utxoCache.getUtxoByOutpoint('txid3:0', 'address1');

    expect(cachedValue).toEqual(mockUtxos[2]);

    expect(getAddressUtxoOrdinalBundles).toHaveBeenCalledWith('Mainnet', 'address1', 0, 60, { hideUnconfirmed: true });
    expect(mockStorageAdapter.set).toHaveBeenCalledWith(
      'utxoCache-address1',
      JSONBig.stringify({
        version: UtxoCache.VERSION,
        syncTime: 5,
        utxos: {
          'txid1:0': mockUtxos[0],
          'txid2:0': mockUtxos[1],
          'txid3:0': mockUtxos[2],
        },
        xVersion: 1,
      }),
    );
  });

  it('should re-initialise cache if TTL expires', async () => {
    const msInYear = 1000 * 60 * 60 * 24 * 365;
    MockDate.set(msInYear);

    mockStorageAdapter.get = vi
      .fn()
      .mockResolvedValueOnce(
        JSON.stringify({ version: UtxoCache.VERSION, syncTime: 0, utxos: mockCache, xVersion: 1 }),
      );

    const mockUtxos = [
      {
        txid: 'txid1',
        vout: 0,
        block_height: 123,
        value: 456,
        sat_ranges: [],
        runes: {},
      },
      {
        txid: 'txid2',
        vout: 0,
        block_height: 123,
        value: 456,
        sat_ranges: [],
        runes: {},
      },
      {
        txid: 'txid3',
        vout: 0,
        block_height: 123,
        value: 456,
        sat_ranges: [],
        runes: {},
      },
    ];

    vi.mocked(getAddressUtxoOrdinalBundles).mockResolvedValueOnce({
      limit: 60,
      offset: 0,
      results: mockUtxos,
      total: 2,
      xVersion: 1,
    });

    const cachedValue = await utxoCache.getUtxoByOutpoint('txid3:0', 'address1');

    expect(cachedValue).toEqual(mockUtxos[2]);

    expect(getAddressUtxoOrdinalBundles).toHaveBeenCalledWith('Mainnet', 'address1', 0, 60, { hideUnconfirmed: true });
    expect(mockStorageAdapter.set).toHaveBeenCalledWith(
      'utxoCache-address1',
      JSONBig.stringify({
        version: UtxoCache.VERSION,
        syncTime: msInYear,
        utxos: {
          'txid1:0': mockUtxos[0],
          'txid2:0': mockUtxos[1],
          'txid3:0': mockUtxos[2],
        },
        xVersion: 1,
      }),
    );
  });
});
