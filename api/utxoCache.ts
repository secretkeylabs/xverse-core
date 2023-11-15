import { NetworkType, UtxoOrdinalBundle } from '../types';
import { AddressBundleResponse, getAddressUtxoOrdinalBundles, getUtxoOrdinalBundle } from './ordinals';

export type UtxoCacheStruct = {
  [utxoId: string]: UtxoOrdinalBundle;
};

type UtxoCacheStorage = {
  version: number;
  xVersion: number;
  syncTime: number;
  utxos: UtxoCacheStruct;
};

export type StorageAdapter = {
  get(key: string): Promise<string | null> | string | null;
  set(key: string, value: string): Promise<void> | void;
  remove(key: string): Promise<void> | void;
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

  constructor(config: UtxoCacheConfig) {
    this._cacheStorageController = config.cacheStorageController;
    this._network = config.network;
  }

  private getAddressCacheStorageKey = (address: string) => `utxoCache-${address}`;

  private _getCache = async (address: string): Promise<UtxoCacheStorage | undefined> => {
    const cacheStr = await this._cacheStorageController.get(this.getAddressCacheStorageKey(address));
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
    await this._cacheStorageController.set(this.getAddressCacheStorageKey(address), JSON.stringify(addressCache));
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

  private _getUtxo = async (txid: string, vout: number) => getUtxoOrdinalBundle(this._network, txid, vout);

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
    const [utxos, xVersion] = await this._getAllUtxos(address);

    const cacheToStore: UtxoCacheStorage = {
      version: this.VERSION,
      syncTime: Date.now(),
      utxos,
      xVersion,
    };

    await this._setCache(address, cacheToStore);

    return cacheToStore;
  };

  getUtxoByOutpoint = async (outpoint: string, address: string): Promise<UtxoOrdinalBundle | undefined> => {
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
    const [txid, vout] = outpoint.split(':');
    const { xVersion, ...utxo } = await this._getUtxo(txid, +vout);

    if (cache.xVersion !== xVersion) {
      // if server deployed update to satributes, the xVersion will be bumped, so we need to resync
      await this._initCache(address);
    }

    if (utxo.block_height) {
      // we only want to store confirmed utxos in the cache
      await this._setCachedItem(address, outpoint, utxo);
    }
    return utxo;
  };

  getUtxo = async (txid: string, vout: number, address: string): Promise<UtxoOrdinalBundle | undefined> => {
    const utxoId = `${txid}:${vout}`;

    return this.getUtxoByOutpoint(utxoId, address);
  };
}
