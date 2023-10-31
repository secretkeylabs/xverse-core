import { NetworkType, UtxoOrdinalBundle } from '../types';
import { AddressBundleResponse, getAddressUtxoOrdinalBundles, getUtxoOrdinalBundle } from './ordinals';

export type UtxoCacheStruct = {
  [utxoId: string]: UtxoOrdinalBundle;
};

type UtxoCacheStorage = {
  version: number;
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
    const cache = await this._cacheStorageController.get(this.getAddressCacheStorageKey(address));
    if (cache) {
      try {
        return JSON.parse(cache);
      } catch (err) {
        console.error(err);
      }
    }
    return undefined;
  };

  private _setCache = async (address: string, addressCache: UtxoCacheStorage): Promise<void> => {
    await this._cacheStorageController.set(this.getAddressCacheStorageKey(address), JSON.stringify(addressCache));
  };

  private _getAddressUtxos = async (address: string) => {
    let allData: UtxoOrdinalBundle[] = [];
    let offset = 0;
    let totalCount = 1;
    let limit = 60;
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

      const { results, total, limit: actualLimit } = response;
      limit = actualLimit;
      allData = allData.concat(results);
      totalCount = total;
      offset += limit;
    }
    return allData;
  };

  private _getUtxo = async (txid: string, vout: number) => getUtxoOrdinalBundle(this._network, txid, vout);

  private _getAllUtxos = async (btcAddress: string): Promise<UtxoCacheStruct> => {
    const utxos = await this._getAddressUtxos(btcAddress);
    const utxosObject: UtxoCacheStruct = utxos.reduce((acc, utxo) => {
      acc[`${utxo.txid}:${utxo.vout}`] = utxo;
      return acc;
    }, {} as UtxoCacheStruct);
    return utxosObject;
  };

  private _initCache = async (address: string): Promise<UtxoCacheStruct> => {
    const utxos = await this._getAllUtxos(address);

    const cacheToStore: UtxoCacheStorage = {
      version: this.VERSION,
      syncTime: Date.now(),
      utxos,
    };

    await this._setCache(address, cacheToStore);

    return utxos;
  };

  getUtxoByOutpoint = async (outpoint: string, address: string): Promise<UtxoOrdinalBundle | null> => {
    const cache = await this._getCache(address);

    // check if cache is initialised and up to date
    if (!cache || cache.version !== this.VERSION) {
      const utxos = await this._initCache(address);
      return utxos[outpoint];
    }

    // TODO: check how old cache is and clean/refresh it if older than X amount of time
    // TODO: get version from API and clear cache if newer version is available (e.g. new satributes added)

    // if utxo in cache already, return it
    if (outpoint in cache.utxos) {
      return cache.utxos[outpoint];
    }

    // if not, get it from the API and add it to the cache
    const [txid, vout] = outpoint.split(':');
    const utxo = await this._getUtxo(txid, +vout);

    cache.utxos[outpoint] = utxo;
    await this._setCache(address, cache);

    return utxo;
  };

  getUtxo = async (txid: string, vout: number, address: string): Promise<UtxoOrdinalBundle | null> => {
    const utxoId = `${txid}:${vout}`;

    return this.getUtxoByOutpoint(utxoId, address);
  };
}
