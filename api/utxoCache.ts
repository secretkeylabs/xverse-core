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
};

const CACHE_TTL = 1000 * 60 * 60 * 24 * 7; // 7 days
const UTXO_CACHE_KEY_PREFIX = 'utxoCache';

export class UtxoCache {
  private readonly _cacheStorageController: ExtendedStorageAdapter;

  private readonly _network: NetworkType;

  private readonly _addressMutexes: { [address: string]: Mutex } = {};

  private readonly _writeMutex = new Mutex();

  static readonly VERSION = 4;

  constructor(config: UtxoCacheConfig) {
    this._cacheStorageController = config.cacheStorageController;
    this._network = config.network;

    this._clearExpiredCaches().catch(console.error);
  }

  private _getAddressCacheStorageKey = (address: string): string =>
    `${UTXO_CACHE_KEY_PREFIX}-${this._network}-${address}`;

  private _clearExpiredCaches = async (): Promise<void> => {
    const keys = await this._cacheStorageController.getAllKeys();
    const prefix = UTXO_CACHE_KEY_PREFIX;
    const cacheKeys = keys.filter((key) => key.startsWith(prefix));
    const now = Date.now();

    for (const cacheKey of cacheKeys) {
      const cache = await this._getCacheDataByKey(cacheKey);

      if (!cache || now - cache.syncTime > CACHE_TTL || cache.version !== UtxoCache.VERSION) {
        await this._cacheStorageController.remove(cacheKey);
      }
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
    const cacheKey = this._getAddressCacheStorageKey(address);
    const cachedData = await this._getCacheDataByKey(cacheKey);

    if (cachedData) {
      // check if cache TTL is expired or version is old
      const now = Date.now();
      if (now - cachedData.syncTime > CACHE_TTL || cachedData.version !== UtxoCache.VERSION) {
        await this._cacheStorageController.remove(cacheKey);
        return undefined;
      }
    }

    return cachedData;
  };

  private _setAddressCache = async (
    address: string,
    addressCache: UtxoCacheStorage | undefined,
    lock = false,
  ): Promise<void> => {
    const releaseWrite = lock ? await this._writeMutex.acquire() : undefined;

    try {
      if (!addressCache) {
        await this._cacheStorageController.remove(this._getAddressCacheStorageKey(address));
        return;
      }

      await this._cacheStorageController.set(
        this._getAddressCacheStorageKey(address),
        JSONBigOnDemand.stringify(addressCache),
      );
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

  private _initCache = async (address: string, rebuild = false): Promise<void> => {
    const addressMutex = this._getAddressMutex(address);

    if (addressMutex.isLocked()) {
      // another thread is already initialising the cache, so ignore this call
      return;
    }

    if (rebuild) {
      await this._setAddressCache(address, undefined, true);
    }

    const releaseInit = await addressMutex.acquire();
    let shouldReInit = false;
    try {
      const initialCache = await this._getAddressCache(address);

      if (initialCache?.syncComplete) {
        // if the cache is already synced, we don't need to do anything
        return;
      }

      let offset = initialCache?.syncedOffset ?? 0;
      let totalCount = offset + 1;
      let limit = 60;
      let xVersion = initialCache?.xVersion;

      while (offset < totalCount) {
        const response = await getAddressUtxoOrdinalBundles(this._network, address, offset, limit, {
          hideUnconfirmed: true,
        });

        const { results, total, limit: actualLimit, xVersion: serverXVersion } = response;

        if (xVersion && xVersion !== serverXVersion) {
          // the server has a new version, so we need to resync
          shouldReInit = true;
          break;
        }

        limit = actualLimit;
        totalCount = total;
        offset += limit;
        xVersion = serverXVersion;

        const releaseWrite = await this._writeMutex.acquire();

        try {
          const currentCache = await this._getAddressCache(address);
          const utxos = currentCache?.utxos ?? {};
          const batchData = results.map(this._mapUtxoApiBundleToBundle);

          batchData.forEach((utxo) => {
            if (utxo.block_height) {
              utxos[`${utxo.txid}:${utxo.vout}`] = utxo;
            }
          });

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
          // if we fail to write, we bail on this init and let the next one try again
          return;
        } finally {
          releaseWrite();
        }
      }
    } finally {
      releaseInit();
    }

    if (shouldReInit) {
      // if we need to reinit, we need to clear the cache and reinit
      await this._initCache(address, true);
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

    // fire off init for the address and forget
    this._initCache(address).catch(console.error);

    const cache = await this._getAddressCache(address);

    if (cache && outpoint in cache.utxos) {
      return cache.utxos[outpoint];
    }

    const [xVersion, bundle] = await this._getUtxo(txid, +vout);

    if (cache && cache.xVersion !== xVersion) {
      // if server deployed update, the xVersion will be bumped, so we need to resync
      // clear the cache and reinit
      this._initCache(address, true).catch(console.error);
    }

    if (bundle?.block_height) {
      // we only want to store confirmed utxos in the cache
      await this._setCachedItem(address, outpoint, bundle);
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
    const prefix = UTXO_CACHE_KEY_PREFIX;
    const cacheKeys = keys.filter((key) => key.startsWith(prefix));

    for (const cacheKey of cacheKeys) {
      await this._cacheStorageController.remove(cacheKey);
    }
  };
}
