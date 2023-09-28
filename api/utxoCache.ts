import { getAddressUtxoOrdinalBundles, getUtxoOrdinalBundle } from './ordinals';

export type UtxoStates = 'inscribed' | 'notInscribed' | 'unknown';

export type UtxoCacheStruct = {
  [utxoId: string]: UtxoStates;
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

  CACHE_STORAGE_KEY = 'utxoCache';

  CACHE_VERSION_STORAGE_KEY = 'utxoCacheVersion';

  VERSION = 1;

  constructor(config: UtxoCacheConfig) {
    this._cacheStorageController = config.cacheStorageController;
  }

  _getCache = async (): Promise<UtxoCacheStruct> => {
    const cache = await this._cacheStorageController.get(this.CACHE_STORAGE_KEY);
    if (cache) {
      return JSON.parse(cache);
    } else {
      return {};
    }
  };

  getUtxoState = async (utxoId: string): Promise<UtxoStates | null> => {
    const cache = await this._getCache();
    if (cache[utxoId]) {
      return cache[utxoId];
    }
    const [txid, vout] = utxoId.split(':');
    const utxo = await getUtxoOrdinalBundle(txid, parseInt(vout, 10));
    const isInscribed = utxo.inscriptions.length > 0 ? 'inscribed' : 'notInscribed';
    const isUnconfirmed = utxo.block_height === 0;
    const utxoState = isUnconfirmed ? 'unknown' : isInscribed;
    await this.setUtxoState(utxoId, utxoState);
    return utxoState;
  };

  async setUtxoState(utxoId: string, state: UtxoStates): Promise<void> {
    const cache = await this._getCache();
    cache[utxoId] = state;
    await this._cacheStorageController.set(this.CACHE_STORAGE_KEY, JSON.stringify(cache));
  }

  async removeUtxoState(utxoId: string): Promise<void> {
    const cache = await this._getCache();
    delete cache[utxoId];
    await this._cacheStorageController.set(this.CACHE_STORAGE_KEY, JSON.stringify(cache));
  }

  async clear(): Promise<void> {
    await this._cacheStorageController.remove(this.CACHE_STORAGE_KEY);
  }

  async getVersion(): Promise<number> {
    const version = await this._cacheStorageController.get(this.CACHE_VERSION_STORAGE_KEY);
    if (version) {
      return parseInt(version, 10);
    } else {
      return 0;
    }
  }

  getAllUtxos = async (address: string): Promise<UtxoCacheStruct> => {
    const utxos = await getAddressUtxoOrdinalBundles(address, 0, 200);
    const utxosObject: { [key: string]: UtxoStates } = utxos.results.reduce((acc, utxo) => {
      const isInscribed = utxo.inscriptions.length > 0 ? 'inscribed' : 'notInscribed';
      const isUnconfirmed = utxo.block_height === 0;
      acc[`${utxo.txid}:${utxo.vout}`] = isUnconfirmed ? 'unknown' : isInscribed;
      return acc;
    }, {} as { [key: string]: UtxoStates });
    return utxosObject;
  };

  initCache = async (address: string): Promise<void> => {
    await this._cacheStorageController.set(this.CACHE_VERSION_STORAGE_KEY, this.VERSION.toString());
    const utxos = await this.getAllUtxos(address);
    await this._cacheStorageController.set(this.CACHE_STORAGE_KEY, JSON.stringify(utxos));
  };
}
