import { Mutex } from 'async-mutex';
import { isAxiosError } from 'axios';
import {
  AddressBundleResponse,
  NetworkType,
  RareSatsType,
  StorageAdapter,
  UtxoOrdinalBundle,
  isApiSatributeKnown,
} from '../types';
import { getAddressUtxoOrdinalBundles, getUtxoOrdinalBundle } from './ordinals';

const initMutex = new Mutex();

export type UtxoCacheStruct = {
  [utxoId: string]: UtxoOrdinalBundle<RareSatsType>;
};

type UtxoCacheStorage = {
  version: number;
  xVersion: number;
  syncTime: number;
  utxos: UtxoCacheStruct;
};

type UtxoCacheConfig = {
  cacheStorageController: StorageAdapter;
  network: NetworkType;
};

const CACHE_TTL = 1000 * 60 * 60 * 24 * 7; // 7 days

export class UtxoCache {
  private readonly _cacheStorageController: StorageAdapter;

  private readonly _network: NetworkType;

  private readonly VERSION = 1;

  private readonly _addressMutexes: { [address: string]: Mutex } = {};

  constructor(config: UtxoCacheConfig) {
    this._cacheStorageController = config.cacheStorageController;
    this._network = config.network;
  }

  private _getAddressMutex = (address: string) => {
    if (!this._addressMutexes[address]) {
      this._addressMutexes[address] = new Mutex();
    }
    return this._addressMutexes[address];
  };

  private _getAddressCacheStorageKey = (address: string) => `utxoCache-${address}`;

  private _getCache = async (address: string): Promise<UtxoCacheStorage | undefined> => {
    const cacheStr = await this._cacheStorageController.get(this._getAddressCacheStorageKey(address));
    if (cacheStr) {
      try {
        let cache = JSON.parse(cacheStr) as UtxoCacheStorage;

        // check if cache TTL is expired
        const now = Date.now();
        if (now - cache.syncTime > CACHE_TTL) {
          cache = await this._initCache(address);
        }

        return cache;
      } catch (err) {
        console.error(err);
      }
    }
    return undefined;
  };

  private _setCache = async (address: string, addressCache: UtxoCacheStorage): Promise<void> => {
    await this._cacheStorageController.set(this._getAddressCacheStorageKey(address), JSON.stringify(addressCache));
  };

  private _setCachedItem = async (
    address: string,
    outpoint: string,
    utxo: UtxoOrdinalBundle<RareSatsType>,
  ): Promise<void> => {
    const cache = await this._getCache(address);
    if (!cache) {
      // this should never happen as init would run first
      return;
    }
    cache.utxos[outpoint] = utxo;
    await this._setCache(address, cache);
  };

  private _getAddressUtxos = async (address: string) => {
    let allData: UtxoOrdinalBundle[] = [];
    let offset = 0;
    let totalCount = 1;
    let limit = 60;
    let xVersion!: number;

    while (offset < totalCount) {
      const response: AddressBundleResponse = await getAddressUtxoOrdinalBundles(
        this._network,
        address,
        offset,
        limit,
        {
          hideUnconfirmed: true,
        },
      );

      const { results, total, limit: actualLimit, xVersion: serverXVersion } = response;
      limit = actualLimit;
      allData = allData.concat(results);
      totalCount = total;
      offset += limit;
      xVersion = serverXVersion;
    }

    return [allData, xVersion] as const;
  };

  private _mapUtxoSatributesToKnown = (utxo: UtxoOrdinalBundle) => ({
    ...utxo,
    sat_ranges: utxo.sat_ranges.map((satRange) => ({
      ...satRange,
      satributes: satRange.satributes.filter(isApiSatributeKnown),
    })),
  });

  private _getUtxo = async (
    txid: string,
    vout: number,
  ): Promise<[xVersion: number, bundle: UtxoOrdinalBundle<RareSatsType>] | [undefined, undefined]> => {
    try {
      const apiBundleData = await getUtxoOrdinalBundle(this._network, txid, vout);

      const { xVersion, ...utxo } = apiBundleData;
      return [xVersion, this._mapUtxoSatributesToKnown(utxo)];
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

      acc[`${utxo.txid}:${utxo.vout}`] = this._mapUtxoSatributesToKnown(utxo);
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
        version: this.VERSION,
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
  ): Promise<UtxoOrdinalBundle<RareSatsType> | undefined> => {
    const [txid, vout] = outpoint.split(':');
    if (skipCache) {
      const [, utxo] = await this._getUtxo(txid, +vout);
      return utxo;
    }

    const cache = await this._getCache(address);

    // check if cache is initialised and up to date
    if (!cache || cache.version !== this.VERSION) {
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
  ): Promise<UtxoOrdinalBundle<RareSatsType> | undefined> => {
    const utxoId = `${txid}:${vout}`;

    return this.getUtxoByOutpoint(utxoId, address, skipCache);
  };
}
