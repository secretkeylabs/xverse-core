import { Mutex } from 'async-mutex';
import { isAxiosError } from 'axios';
import BigNumber from 'bignumber.js';
import {
  ExtendedStorageAdapter,
  NetworkType,
  isApiSatributeKnown,
  type UtxoOrdinalBundle,
  type UtxoOrdinalBundleApi,
} from '../types';
import { JSONBigOnDemand } from '../utils/bignumber';
import BitcoinEsploraApiProvider from './esplora/esploraAPiProvider';
import { getAddressUtxoOrdinalBundles, getUtxoOrdinalBundle } from './ordinals';

export type UtxoCacheStruct<R extends BigNumber | number = BigNumber> = {
  [utxoId: string]: UtxoOrdinalBundle<R>;
};

type UtxoCacheStorage<R extends BigNumber | number = BigNumber> = {
  version: number;
  xVersion: number;
  syncTime: number;
  syncedOffset?: number;
  syncComplete?: boolean;
  utxos: UtxoCacheStruct<R>;
};

type UtxoCacheConfig = {
  cacheStorageController: ExtendedStorageAdapter;
  network: NetworkType;
  electrsApi: BitcoinEsploraApiProvider;
};

// TODO: refactor below classes so the local cache manages the cache storage controller
class LocalCache {
  private _cache: Map<string, { value: UtxoCacheStorage; lastAccessed: number }> = new Map();

  private static readonly MAX_CACHED_ITEMS = 3; // we store max 3 address caches in memory

  get = (address: string): UtxoCacheStorage | undefined => {
    const cache = this._cache.get(address);
    if (!cache) {
      return undefined;
    }
    cache.lastAccessed = Date.now();
    return cache.value;
  };

  set = (address: string, value: UtxoCacheStorage): void => {
    this._cache.set(address, { value, lastAccessed: Date.now() });

    if (Object.values(this._cache).length > LocalCache.MAX_CACHED_ITEMS) {
      this._clearOldestCacheEntry();
    }
  };

  remove = (address: string): void => {
    this._cache.delete(address);
  };

  private _clearOldestCacheEntry() {
    let oldestKey: string | undefined;
    let oldestTime: number | undefined;

    for (const [key, cache] of this._cache.entries()) {
      if (!oldestTime || cache.lastAccessed < oldestTime) {
        oldestTime = cache.lastAccessed;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this._cache.delete(oldestKey);
    }
  }
}

export class UtxoCache {
  private readonly _cacheStorageController: ExtendedStorageAdapter;

  private readonly _network: NetworkType;

  private readonly _electrsApi: BitcoinEsploraApiProvider;

  private readonly _addressMutexes: { [address: string]: Mutex } = {};

  private readonly _writeMutex = new Mutex();

  private readonly _localCache = new LocalCache();

  static readonly VERSION = 4;

  static readonly UTXO_CACHE_KEY_PREFIX = 'utxoCache';

  static readonly ORDINAL_UTXO_QUERY_LIMIT = 500;

  static readonly CACHE_TTL = 1000 * 60 * 60 * 24 * 7; // 7 days

  static readonly CACHE_RESYNC_TTL = 1000 * 60 * 60 * 24 * 1; // 1 day

  constructor(config: UtxoCacheConfig) {
    this._cacheStorageController = config.cacheStorageController;
    this._network = config.network;
    this._electrsApi = config.electrsApi;
  }

  private _getAddressCacheStorageKey = (address: string): string =>
    `${UtxoCache.UTXO_CACHE_KEY_PREFIX}-${this._network}-${address}`;

  private _clearExpiredCaches = async (newXVersion?: number): Promise<void> => {
    const keys = await this._cacheStorageController.getAllKeys();
    const cacheKeys = keys.filter((key) => key.startsWith(UtxoCache.UTXO_CACHE_KEY_PREFIX));
    const now = Date.now();

    for (const cacheKey of cacheKeys) {
      const cache = await this._getCacheDataByKey(cacheKey);

      if (
        !cache ||
        now - cache.syncTime > UtxoCache.CACHE_TTL ||
        cache.version !== UtxoCache.VERSION ||
        (newXVersion !== undefined && cache.xVersion !== newXVersion)
      ) {
        await this._cacheStorageController.remove(cacheKey);
      }
    }
  };

  private _clearOldestCacheEntry = async (): Promise<void> => {
    const keys = await this._cacheStorageController.getAllKeys();
    const cacheKeys = keys.filter((key) => key.startsWith(UtxoCache.UTXO_CACHE_KEY_PREFIX));
    let oldestCacheTime: number | undefined;
    let oldestCacheKey: string | undefined;

    for (const cacheKey of cacheKeys) {
      const cache = await this._getCacheDataByKey(cacheKey);

      if (!cache) {
        await this._cacheStorageController.remove(cacheKey);
        continue;
      }

      if (!oldestCacheTime) {
        oldestCacheTime = cache.syncTime;
        oldestCacheKey = cacheKey;
        continue;
      }

      if (cache.syncTime < oldestCacheTime) {
        oldestCacheTime = cache.syncTime;
        oldestCacheKey = cacheKey;
      }
    }

    if (oldestCacheKey) {
      await this._cacheStorageController.remove(oldestCacheKey);
    }
  };

  private _getAddressMutex = (address: string): Mutex => {
    if (!this._addressMutexes[address]) {
      this._addressMutexes[address] = new Mutex();
    }
    return this._addressMutexes[address];
  };

  private _getCacheDataByKey = async (cacheKey: string): Promise<UtxoCacheStorage | undefined> => {
    const cacheStr = await this._cacheStorageController.get(cacheKey);
    if (cacheStr) {
      try {
        const cache = JSONBigOnDemand.parse(cacheStr) as UtxoCacheStorage<BigNumber | number>;

        // convert all rune amounts to BigNumber for runes
        for (const utxoOutpoint in cache.utxos) {
          for (const [, details] of cache.utxos[utxoOutpoint].runes ?? []) {
            details.amount = BigNumber(details.amount);
          }
        }

        // we can safely cast here since we just converted all runes to BigNumber
        return cache as UtxoCacheStorage;
      } catch (err) {
        console.error(err);
      }
    }
    return undefined;
  };

  private _getAddressCache = async (address: string): Promise<UtxoCacheStorage | undefined> => {
    const inMemoryCache = this._localCache.get(address);

    if (inMemoryCache) {
      return inMemoryCache;
    }

    const cacheKey = this._getAddressCacheStorageKey(address);
    const cachedData = await this._getCacheDataByKey(cacheKey);

    if (cachedData) {
      // check if cache TTL is expired or version is old
      const now = Date.now();
      if (now - cachedData.syncTime > UtxoCache.CACHE_TTL || cachedData.version !== UtxoCache.VERSION) {
        await this._cacheStorageController.remove(cacheKey);
        return undefined;
      }

      this._localCache.set(address, cachedData);
    }

    return cachedData;
  };

  private _setAddressCache = async (
    address: string,
    addressCache: UtxoCacheStorage | undefined,
    lock = false,
    depth = 0,
  ): Promise<void> => {
    const releaseWrite = lock ? await this._writeMutex.acquire() : undefined;

    try {
      if (!addressCache) {
        await this._cacheStorageController.remove(this._getAddressCacheStorageKey(address));
        this._localCache.remove(address);
        return;
      }

      await this._cacheStorageController.set(
        this._getAddressCacheStorageKey(address),
        JSONBigOnDemand.stringify(addressCache),
      );
      this._localCache.set(address, addressCache);
    } catch (err) {
      // check if quota is reached. If so, try clean up other caches and retry on next run
      if (err instanceof Error && this._cacheStorageController.isErrorQuotaExceeded?.(err)) {
        await this._clearOldestCacheEntry();

        if (depth < 5) {
          // try set again (with limit to avoid infinite loop) after we've cleared the oldest cache
          await this._setAddressCache(address, addressCache, false, depth + 1);
        }
      }
    } finally {
      releaseWrite?.();
    }
  };

  private _setCachedItem = async (address: string, outpoint: string, utxo: UtxoOrdinalBundle): Promise<void> => {
    const releaseWrite = await this._writeMutex.acquire();

    try {
      const cache = await this._getAddressCache(address);
      if (!cache) {
        // this should never happen as init would run first
        return;
      }
      cache.utxos[outpoint] = utxo;
      await this._setAddressCache(address, cache);
    } finally {
      releaseWrite();
    }
  };

  private _mapUtxoApiBundleToBundle = (utxo: UtxoOrdinalBundleApi): UtxoOrdinalBundle => ({
    ...utxo,
    sat_ranges: utxo.sat_ranges.map((satRange) => ({
      ...satRange,
      satributes: satRange.satributes.filter(isApiSatributeKnown),
    })),
    runes: (utxo.runes ?? []).map(([runeName, details]) => [
      runeName,
      { ...details, amount: BigNumber(details.amount) },
    ]),
  });

  private _getUtxo = async (
    txid: string,
    vout: number,
  ): Promise<[xVersion: number, bundle: UtxoOrdinalBundle] | [undefined, undefined]> => {
    try {
      const apiBundleData = await getUtxoOrdinalBundle(this._network, txid, vout);

      const { xVersion, ...utxo } = apiBundleData;
      return [xVersion, this._mapUtxoApiBundleToBundle(utxo)];
    } catch (err) {
      if (isAxiosError(err) && err.response?.status === 404) {
        return [undefined, undefined];
      }

      throw err;
    }
  };

  /** This should only be called from the _syncCache function */
  private _resyncCache = async (address: string, cache: UtxoCacheStorage): Promise<void> => {
    try {
      const currentUtxoIds = new Set(Object.keys(cache.utxos));

      if (currentUtxoIds.size < UtxoCache.ORDINAL_UTXO_QUERY_LIMIT * 2) {
        // if we have fewer than 2x the limit, we can just reinitialise
        this._setAddressCache(address, undefined, true);
        return await this._initCache(address);
      }

      const utxoIds = (await this._electrsApi.getUnspentUtxos(address))
        .filter((utxo) => utxo.status.confirmed)
        .map((utxo) => `${utxo.txid}:${utxo.vout}`);
      const utxoIdSet = new Set(utxoIds);
      const cacheUtxoIds = Object.keys(cache.utxos);
      const cacheUtxoIdSet = new Set(cacheUtxoIds);

      const carryThroughIds = cacheUtxoIds.filter((x) => utxoIdSet.has(x));
      const newIds = utxoIds.filter((x) => !cacheUtxoIdSet.has(x));

      if (newIds.length === 0 && carryThroughIds.length === cacheUtxoIds.length) {
        // if we have no new utxos and all the utxos we have are still valid, we
        //  just re-set the sync time and don't need to do anything more
        await this._setAddressCache(
          address,
          {
            ...cache,
            syncTime: Date.now(),
          },
          true,
        );
        return;
      }

      const updatedUtxos: UtxoCacheStruct = {};

      for (const id of carryThroughIds) {
        updatedUtxos[id] = cache.utxos[id];
      }

      await this._setAddressCache(
        address,
        {
          ...cache,
          utxos: updatedUtxos,
        },
        true,
      );

      let retrieved = 0;
      for (const id of newIds) {
        const [txid, vout] = id.split(':');
        const [xVersion, bundle] = await this._getUtxo(txid, Number(vout));

        if (cache.xVersion !== xVersion) {
          // if server deployed update, the xVersion will be bumped, so we need to clear the caches and start again
          await this._clearExpiredCaches(xVersion);
          return;
        }

        if (bundle && bundle.block_height) {
          updatedUtxos[id] = bundle;
        }

        // store every 10th utxo to minimise the number of writes, but still maintain progress in case of failure
        // or wallet closing
        if (++retrieved % 10 === 0) {
          await this._setAddressCache(
            address,
            {
              ...cache,
              utxos: updatedUtxos,
            },
            true,
          );
        }
      }

      await this._setAddressCache(
        address,
        {
          ...cache,
          utxos: updatedUtxos,
          syncTime: Date.now(),
        },
        true,
      );
    } catch (e) {
      // if we fail to resync, we bail on this resync and let the next one try again
      return;
    }
  };

  /** This should only be called from the _syncCache or _resyncCache function */
  private _initCache = async (address: string, { startOffset = 0, startXVersion = -1 } = {}): Promise<void> => {
    let offset = startOffset;
    let totalCount = offset + 1;
    let limit = UtxoCache.ORDINAL_UTXO_QUERY_LIMIT;
    let xVersion = startXVersion === -1 ? undefined : startXVersion;

    while (offset < totalCount) {
      const response = await getAddressUtxoOrdinalBundles(this._network, address, offset, limit, {
        hideUnconfirmed: true,
      });

      const { results, total, limit: actualLimit, xVersion: serverXVersion } = response;

      if (xVersion && xVersion !== serverXVersion) {
        // the server has a new version, so we need to clear the caches and start again
        await this._clearExpiredCaches(serverXVersion);
        return;
      }

      const releaseWrite = await this._writeMutex.acquire();
      try {
        const currentCache = await this._getAddressCache(address);

        if (currentCache && currentCache.syncedOffset !== offset) {
          // something isn't right, so we bail on this init and let the next one try again
          return;
        }

        const utxos = currentCache?.utxos ?? {};
        const batchData = results.map(this._mapUtxoApiBundleToBundle);

        batchData.forEach((utxo) => {
          if (utxo.block_height) {
            utxos[`${utxo.txid}:${utxo.vout}`] = utxo;
          }
        });

        limit = actualLimit;
        totalCount = total;
        offset += limit;
        xVersion = serverXVersion;

        const cacheToStore: UtxoCacheStorage = {
          version: UtxoCache.VERSION,
          syncTime: Date.now(),
          syncedOffset: Math.min(offset, totalCount),
          syncComplete: offset >= totalCount,
          utxos,
          xVersion,
        };

        await this._setAddressCache(address, cacheToStore);
      } catch (err) {
        // on fail, we bail on this init and let the next one try again
        return;
      } finally {
        releaseWrite();
      }
    }
  };

  private _syncCache = async (address: string, initialCache: UtxoCacheStorage | undefined): Promise<void> => {
    const addressMutex = this._getAddressMutex(address);

    if (addressMutex.isLocked()) {
      // another thread is already initialising the cache, so ignore this call
      return;
    }

    const releaseSync = await addressMutex.acquire();
    try {
      await this._clearExpiredCaches();

      if (
        // no cache exists, initialise it
        !initialCache ||
        /**
         * something isn't right with the cache as the synced count is greater
         * than the cached UTXO count, so we clear it and initialise it again
         */
        (!initialCache.syncComplete &&
          initialCache.syncedOffset &&
          initialCache.syncedOffset > Object.values(initialCache.utxos).length)
      ) {
        await this._setAddressCache(address, undefined, true);
        return await this._initCache(address);
      }

      if (!initialCache.syncComplete) {
        // continue initialisation from last known sync point
        return await this._initCache(address, {
          startOffset: initialCache.syncedOffset,
          startXVersion: initialCache.xVersion,
        });
      }

      if (initialCache.syncComplete && Date.now() - initialCache.syncTime > UtxoCache.CACHE_RESYNC_TTL) {
        // if the cache is already synced, we don't need to initialise it, but we may want to resync it
        return await this._resyncCache(address, initialCache);
      }

      // cache is sufficiently up to date, so we don't need to do anything
    } finally {
      releaseSync();
    }
  };

  getUtxoByOutpoint = async (
    outpoint: string,
    address: string,
    skipCache = false,
  ): Promise<UtxoOrdinalBundle | undefined> => {
    const [txid, vout] = outpoint.split(':');
    if (skipCache) {
      const [, utxo] = await this._getUtxo(txid, +vout);
      return utxo;
    }

    const cache = await this._getAddressCache(address);

    if (cache && outpoint in cache.utxos) {
      this._syncCache(address, cache).catch(console.error);
      return cache.utxos[outpoint];
    }

    const [xVersion, bundle] = await this._getUtxo(txid, +vout);

    if (cache && cache.xVersion !== xVersion) {
      // if server deployed update, the xVersion will be bumped, so we need to resync
      // clear the cache and reinit
      await this._clearExpiredCaches(xVersion);
      this._syncCache(address, undefined).catch(console.error);
    } else {
      if (bundle?.block_height) {
        // we only want to store confirmed utxos in the cache
        await this._setCachedItem(address, outpoint, bundle);
      }
      this._syncCache(address, cache).catch(console.error);
    }

    return bundle;
  };

  getUtxo = async (
    txid: string,
    vout: number,
    address: string,
    skipCache = false,
  ): Promise<UtxoOrdinalBundle | undefined> => {
    const utxoId = `${txid}:${vout}`;

    return this.getUtxoByOutpoint(utxoId, address, skipCache);
  };

  clearAllCaches = async (): Promise<void> => {
    const keys = await this._cacheStorageController.getAllKeys();
    const cacheKeys = keys.filter((key) => key.startsWith(UtxoCache.UTXO_CACHE_KEY_PREFIX));

    for (const cacheKey of cacheKeys) {
      await this._cacheStorageController.remove(cacheKey);
    }
  };
}
