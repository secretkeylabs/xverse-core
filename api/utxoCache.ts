import { UtxoOrdinalBundle } from '../types/api/xverse/ordinals';
import { getAddressUtxoOrdinalBundles, getUtxoOrdinalBundle } from './ordinals';

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

  utxos: UtxoCacheStruct = {};

  VERSION = 1;

  constructor(config: UtxoCacheConfig) {
    this._cacheStorageController = config.cacheStorageController;
  }

  private getAddressCacheStorageKey = (address: string) => `utxoCache-${address}`;

  _getCache = async (address: string): Promise<UtxoCacheStorage> => {
    const cache = await this._cacheStorageController.get(this.getAddressCacheStorageKey(address));
    if (cache) {
      return JSON.parse(cache);
    } else {
      return {
        version: -1,
        utxos: {},
      };
    }
  };

  private _setCache = async (utxos: UtxoCacheStruct, address: string): Promise<void> => {
    await this._cacheStorageController.set(
      this.getAddressCacheStorageKey(address),
      JSON.stringify({
        version: this.VERSION,
        utxos: utxos,
      }),
    );
  };

  _getAddressUtxos = async (address: string) => getAddressUtxoOrdinalBundles(address, 0, 60);

  _getUtxo = async (txid: string, vout: number) => getUtxoOrdinalBundle(txid, vout);

  clear = async (address: string): Promise<void> => {
    await this._cacheStorageController.remove(this.getAddressCacheStorageKey(address));
  };

  getVersion = async (address: string): Promise<number> => {
    const { version } = await this._getCache(address);
    if (version) {
      return version;
    } else {
      return -1;
    }
  };

  isCacheUpdated = async (address: string): Promise<boolean> => {
    const version = await this.getVersion(address);
    return version === this.VERSION;
  };

  getUtxoState = async (utxoId: string, address: string): Promise<UtxoOrdinalBundle | null> => {
    const { utxos } = await this._getCache(address);
    console.log('🚀 ~ file: utxoCache.ts:82 ~ UtxoCache ~ getUtxoState= ~ utxos:', utxos);
    if (utxos && utxos[utxoId]) {
      return utxos[utxoId];
    }
    const [txid, vout] = utxoId.split(':');
    const utxo = await this._getUtxo(txid, parseInt(vout, 10));
    await this.setUtxoState(utxoId, utxo, address, utxos);
    return utxo;
  };

  setUtxoState = async (
    utxoId: string,
    utxo: UtxoOrdinalBundle,
    address: string,
    cachedUtxos: UtxoCacheStruct,
  ): Promise<void> => {
    console.log('🚀 ~ file: utxoCache.ts:97 ~ UtxoCache ~ cachedUtxos:', cachedUtxos);
    console.log('🚀 ~ file: utxoCache.ts:97 ~ UtxoCache ~ address:', address);
    console.log('🚀 ~ file: utxoCache.ts:97 ~ UtxoCache ~ utxo:', utxo);
    console.log('🚀 ~ file: utxoCache.ts:97 ~ UtxoCache ~ utxoId:', utxoId);
    if (!cachedUtxos) {
      cachedUtxos = {};
    }
    cachedUtxos[utxoId] = utxo;
    await this._setCache(this.utxos, address);
  };

  removeUtxoState = async (utxoId: string, address: string): Promise<void | boolean> => {
    const { utxos: cachedUtxos } = await this._getCache(address);
    if (cachedUtxos && utxoId in cachedUtxos) {
      delete cachedUtxos[utxoId];
      await this._setCache(cachedUtxos, address);
    }
    return false;
  };

  getAllUtxos = async (btcAddress: string): Promise<UtxoCacheStruct> => {
    const utxos = await this._getAddressUtxos(btcAddress);
    const utxosObject: UtxoCacheStruct = utxos.results.reduce((acc, utxo) => {
      acc[`${utxo.txid}:${utxo.vout}`] = utxo;
      return acc;
    }, {} as UtxoCacheStruct);
    return utxosObject;
  };

  initCache = async (address: string): Promise<void> => {
    const cacheUpdated = await this.isCacheUpdated(address);
    if (!cacheUpdated) {
      const utxos = await this.getAllUtxos(address);
      await this._setCache(utxos, address);
    }
  };
}
