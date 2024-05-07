import { Mutex } from 'async-mutex';
import { isAxiosError } from 'axios';
import BigNumber from 'bignumber.js';
import {
  NetworkType,
  StorageAdapter,
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
  utxos: UtxoCacheStruct<R>;
};

type UtxoCacheConfig = {
  cacheStorageController: StorageAdapter;
  network: NetworkType;
};

const CACHE_TTL = 1000 * 60 * 60 * 24 * 7; // 7 days

export class UtxoCache {
  private readonly _cacheStorageController: StorageAdapter;

  private readonly _network: NetworkType;

  private readonly _addressMutexes: { [address: string]: Mutex } = {};

  static readonly VERSION = 4;

  constructor(config: UtxoCacheConfig) {
    this._cacheStorageController = config.cacheStorageController;
    this._network = config.network;
  }

  private _getAddressMutex = (address: string): Mutex => {
    if (!this._addressMutexes[address]) {
      this._addressMutexes[address] = new Mutex();
    }
    return this._addressMutexes[address];
  };

  private _getAddressCacheStorageKey = (address: string): string => `utxoCache-${address}`;

  private _getCache = async (address: string): Promise<UtxoCacheStorage | undefined> => {
    const cacheStr = await this._cacheStorageController.get(this._getAddressCacheStorageKey(address));
    if (cacheStr) {
      try {
        let cache = JSONBigOnDemand.parse(cacheStr) as UtxoCacheStorage<BigNumber | number>;

        // check if cache TTL is expired
        const now = Date.now();
        if (now - cache.syncTime > CACHE_TTL) {
          cache = await this._initCache(address);
        }

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

  private _setCache = async (address: string, addressCache: UtxoCacheStorage): Promise<void> => {
    await this._cacheStorageController.set(
      this._getAddressCacheStorageKey(address),
      JSONBigOnDemand.stringify(addressCache),
    );
  };

  private _setCachedItem = async (address: string, outpoint: string, utxo: UtxoOrdinalBundle): Promise<void> => {
    const cache = await this._getCache(address);
    if (!cache) {
      // this should never happen as init would run first
      return;
    }
    cache.utxos[outpoint] = utxo;
    await this._setCache(address, cache);
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

  private _getAddressUtxos = async (
    address: string,
  ): Promise<readonly [bundles: UtxoOrdinalBundle[], xVersion: number]> => {
    let allData: UtxoOrdinalBundle[] = [];
    let offset = 0;
    let totalCount = 1;
    let limit = 60;
    let xVersion!: number;

    while (offset < totalCount) {
      const response = await getAddressUtxoOrdinalBundles(this._network, address, offset, limit, {
        hideUnconfirmed: true,
      });

      const { results, total, limit: actualLimit, xVersion: serverXVersion } = response;
      limit = actualLimit;
      allData = allData.concat(results.map(this._mapUtxoApiBundleToBundle));
      totalCount = total;
      offset += limit;
      xVersion = serverXVersion;
    }

    return [allData, xVersion] as const;
  };

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

  private _getAllUtxos = async (btcAddress: string, onlyConfirmed = true) => {
    const [utxos, xVersion] = await this._getAddressUtxos(btcAddress);

    const utxosObject: UtxoCacheStruct = utxos.reduce((acc, utxo) => {
      if (onlyConfirmed && !utxo.block_height) {
        return acc;
      }

      acc[`${utxo.txid}:${utxo.vout}`] = utxo;
      return acc;
    }, {} as UtxoCacheStruct);

    return [utxosObject, xVersion] as const;
  };

  private _initCache = async (address: string): Promise<UtxoCacheStorage> => {
    const addressMutex = this._getAddressMutex(address);

    while (addressMutex.isLocked()) {
      // another thread is already initialising the cache, wait for it to finish and return
      await addressMutex.waitForUnlock();
      const cache = await this._getCache(address);
      if (cache) {
        // cache was initialised while we were waiting, return it
        return cache;
      }
      // initialising the cache failed or the other thread was doing something else. We need to try again, but
      // another thread might have moved on to building the cache already, so we need to check the state of the
      // mutex again, hence, check the mutex lock state in a loop until we can acquire it
    }

    const release = await addressMutex.acquire();
    try {
      const [utxos, xVersion] = await this._getAllUtxos(address);

      const cacheToStore: UtxoCacheStorage = {
        version: UtxoCache.VERSION,
        syncTime: Date.now(),
        utxos,
        xVersion,
      };

      await this._setCache(address, cacheToStore);

      return cacheToStore;
    } finally {
      release();
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

    const cache = await this._getCache(address);

    // check if cache is initialised and up to date
    if (!cache || cache.version !== UtxoCache.VERSION) {
      const { utxos } = await this._initCache(address);
      return utxos[outpoint];
    }

    // if utxo in cache already, return it
    if (outpoint in cache.utxos) {
      return cache.utxos[outpoint];
    }

    // if not, get it from the API and add it to the cache
    const [xVersion, bundle] = await this._getUtxo(txid, +vout);

    if (cache.xVersion !== xVersion) {
      // if server deployed update to satributes, the xVersion will be bumped, so we need to resync
      await this._initCache(address);
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
}
