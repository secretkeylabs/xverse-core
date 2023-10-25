import { UtxoOrdinalBundle } from '../types/api/xverse/ordinals';
import { AddressBundleResponse, getAddressUtxoOrdinalBundles, getUtxoOrdinalBundle } from './ordinals';

export type UtxoCacheStruct = {
  [utxoId: string]: UtxoOrdinalBundle;
};

type UtxoCacheStorage = {
  version: number;
  utxos: UtxoCacheStruct;
};

export type StorageAdapter = {
  get(key: string): Promise<string | null> | string | null;
  set(key: string, value: string): Promise<void> | void;
  remove(key: string): Promise<void> | void;
};

type UtxoCacheConfig = {
  cacheStorageController: StorageAdapter;
};

export class UtxoCache {
  private readonly _cacheStorageController: StorageAdapter;

  private readonly VERSION = 1;

  constructor(config: UtxoCacheConfig) {
    this._cacheStorageController = config.cacheStorageController;
  }

  private getAddressCacheStorageKey = (address: string) => `utxoCache-${address}`;

  private _getCache = async (address: string): Promise<UtxoCacheStorage> => {
    const cache = await this._cacheStorageController.get(this.getAddressCacheStorageKey(address));
    if (cache) {
      try {
        return JSON.parse(cache);
      } catch (err) {
        console.error(err);
      }
    }
    return {
      version: -1,
      utxos: {},
    };
  };

  private _setCache = async (utxos: UtxoCacheStruct, address: string): Promise<void> => {
    await this._cacheStorageController.set(
      this.getAddressCacheStorageKey(address),
      JSON.stringify({
        version: this.VERSION,
        utxos,
      }),
    );
  };

  private _getAddressUtxos = async (address: string) => {
    let allData: UtxoOrdinalBundle[] = [];
    let page = 1;
    let totalPages = 1;
    while (page <= totalPages) {
      const response: AddressBundleResponse = await getAddressUtxoOrdinalBundles(address, page, 60);
      const { results, total } = response;
      allData = allData.concat(results);
      totalPages = total;
      page++;
    }
    return allData;
  };

  private _getUtxo = async (txid: string, vout: number) => getUtxoOrdinalBundle(txid, vout);

  private getAllUtxos = async (btcAddress: string): Promise<UtxoCacheStruct> => {
    const utxos = await this._getAddressUtxos(btcAddress);
    console.log(utxos);
    const utxosObject: UtxoCacheStruct = utxos.reduce((acc, utxo) => {
      acc[`${utxo.txid}:${utxo.vout}`] = utxo;
      return acc;
    }, {} as UtxoCacheStruct);
    return utxosObject;
  };

  private getVersion = async (address: string): Promise<number> => {
    const { version } = await this._getCache(address);
    if (version) {
      return version;
    } else {
      return -1;
    }
  };

  private isCacheUpdated = async (address: string): Promise<boolean> => {
    const version = await this.getVersion(address);
    return version === this.VERSION;
  };

  initCache = async (address: string): Promise<UtxoCacheStruct | undefined> => {
    const cacheUpdated = await this.isCacheUpdated(address);
    if (!cacheUpdated) {
      const utxos = await this.getAllUtxos(address);
      await this._setCache(utxos, address);
      return utxos;
    }
  };

  setUtxo = async (
    utxoId: string,
    utxo: UtxoOrdinalBundle,
    address: string,
    cachedUtxos: UtxoCacheStruct,
  ): Promise<void> => {
    if (!cachedUtxos) {
      cachedUtxos = {};
    }
    cachedUtxos[utxoId] = utxo;
    await this._setCache(cachedUtxos, address);
  };

  getUtxo = async (utxoId: string, address: string): Promise<UtxoOrdinalBundle | null> => {
    const { utxos, version } = await this._getCache(address);
    let cachedUtxos: UtxoCacheStruct = utxos;
    if (version !== this.VERSION) {
      const newCache = await this.initCache(address);
      if (newCache) {
        cachedUtxos = newCache;
      }
    }
    if (cachedUtxos && cachedUtxos[utxoId]) {
      return cachedUtxos[utxoId];
    }
    const [txid, vout] = utxoId.split(':');
    const utxo = await this._getUtxo(txid, parseInt(vout, 10));
    await this.setUtxo(utxoId, utxo, address, cachedUtxos);
    return utxo;
  };

  removeUtxo = async (utxoId: string, address: string): Promise<void | boolean> => {
    const { utxos: cachedUtxos } = await this._getCache(address);
    if (cachedUtxos && utxoId in cachedUtxos) {
      delete cachedUtxos[utxoId];
      await this._setCache(cachedUtxos, address);
    }
    return false;
  };

  clear = async (address: string): Promise<void> => {
    await this._cacheStorageController.remove(this.getAddressCacheStorageKey(address));
  };
}
