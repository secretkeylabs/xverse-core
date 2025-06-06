import { ExtendedStorageAdapter } from '../types';
import { accountBalanceStore } from './stores/AccountBalanceStore';
import { activeAccountStore } from './stores/ActiveAccountStore';
import { walletOptionsStore } from './stores/WalletOptionsStore';

const storeDefinitions = {
  [accountBalanceStore.name]: accountBalanceStore,
  [walletOptionsStore.name]: walletOptionsStore,
  [activeAccountStore.name]: activeAccountStore,
} as const;

type StoredValue<T extends keyof typeof storeDefinitions> = {
  value: (typeof storeDefinitions)[T]['defaultValue'];
  version: number;
};

export type StoreName = keyof typeof storeDefinitions;
export type StoreSchema<T extends StoreName> = (typeof storeDefinitions)[T]['defaultValue'];
export type StoreMutators<T extends StoreName> = ReturnType<(typeof storeDefinitions)[T]['createMutators']>;
export type StoreUtils<T extends StoreName> = (typeof storeDefinitions)[T]['utils'];

export class PersistentStoreManager {
  private readonly storageKeyPrefix = 'persistentStore::';

  private storageAdapter: ExtendedStorageAdapter;

  private cleanListener?: () => void;

  private isDestroyed = false;

  private storeCache: {
    [key in StoreName]?: StoreSchema<key>;
  };

  private bootstrappedStores?: Set<StoreName>;

  private listeners: {
    [key in StoreName]?: ((newValue: StoreSchema<key>) => void)[];
  };

  private initialiser: {
    initialisePromise: Promise<void>;
    resolve: () => void;
    reject: (error: unknown) => void;
    state: 'pending' | 'initialised' | 'resolved' | 'rejected';
    error?: unknown;
  };

  public constructor(storageAdapter: ExtendedStorageAdapter) {
    this.storageAdapter = storageAdapter;
    this.listeners = {};
    this.storeCache = {};

    this.cleanListener = storageAdapter.addListener?.(this.onStorageChange);

    this.initialiser = {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      initialisePromise: undefined as any, // This is set lower down to avoid race conditions with its internals
      resolve: () => {
        this.initialiser.state = 'resolved';
      },
      reject: (error: unknown) => {
        this.initialiser.state = 'rejected';
        this.initialiser.error = error;
      },
      state: 'pending',
    };

    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const self = this;
    this.initialiser.initialisePromise = new Promise((resolve, reject) => {
      if (self.initialiser.state === 'resolved') {
        self.initialiser.state = 'initialised';
        resolve();
        return;
      }
      if (self.initialiser.state === 'rejected') {
        reject(self.initialiser.error);
        return;
      }
      self.initialiser.resolve = () => {
        self.initialiser.state = 'initialised';
        resolve();
      };
      self.initialiser.reject = (error: unknown) => {
        this.initialiser.state = 'rejected';
        this.initialiser.error = error;
        reject(error);
      };
    });
  }

  private assertNotDestroyed(): void {
    if (this.isDestroyed) {
      throw new Error('PersistentStoreManager instance is destroyed and cannot be used.');
    }
  }

  private updateLocalValue = <T extends StoreName>(storeName: T, value: StoreSchema<T>): void => {
    this.storeCache[storeName] = value as (typeof this.storeCache)[T];

    this.listeners[storeName]?.forEach((callback) => {
      callback(value);
    });
  };

  private onStorageChange = (changes: { [key: string]: { newValue?: unknown; oldValue?: unknown } }): void => {
    Object.entries(changes).forEach(([key, change]) => {
      if (!key.startsWith(this.storageKeyPrefix)) {
        return;
      }

      const storeName = key.replace(this.storageKeyPrefix, '') as StoreName;

      if (storeName in storeDefinitions === false) {
        console.error(`Store ${storeName} not found in store definitions.`);
        return;
      }

      const { newValue } = change;
      if (newValue) {
        const parsed = JSON.parse(newValue as string);

        if (parsed.version === undefined) {
          console.error('Received change event on persistent store without version information');
          return;
        }

        this.storeCache[storeName] = parsed.value;
        this.bootstrappedStores?.add(storeName);
        this.listeners[storeName]?.forEach((callback) => {
          callback(parsed.value);
        });
      } else {
        delete this.storeCache[storeName];
        this.bootstrappedStores?.delete(storeName);
        this.listeners[storeName]?.forEach((callback) => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any -- we know the type is correct
          callback(storeDefinitions[storeName].defaultValue as any);
        });
      }
    });
  };

  private getStoreStorageKey = (storeName: StoreName): string => `${this.storageKeyPrefix}${storeName}`;

  private parseAndMigrateStoreValue = async <T extends StoreName>(
    storeName: T,
    storedValue: string,
  ): Promise<StoreSchema<T>> => {
    const parsed = JSON.parse(storedValue) as StoredValue<T>;

    if (!parsed || typeof parsed !== 'object' || parsed.version === undefined || parsed.value === undefined) {
      throw new Error(`Stored value for store ${storeName} is malformed.`);
    }

    const storeActiveVersion = storeDefinitions[storeName].activeVersion;

    if (parsed.version > storeActiveVersion) {
      throw new Error(
        `Stored version ${parsed.version} is greater than active version ${storeActiveVersion} for store ${storeName}.`,
      );
    }

    let migratedValue = parsed.value;
    let migrationsRan = false;
    for (let i = parsed.version + 1; i <= storeActiveVersion; i++) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- we know this will work, too complex to fix types
      const migration = (storeDefinitions[storeName].migrate as any)[i];
      if (migration) {
        migratedValue = await migration(migratedValue);
        migrationsRan = true;
      } else {
        throw new Error(
          `Migration function for version ${i} in store ${storeName} not found.
Current version: ${parsed.version}; Target version: ${storeActiveVersion}`,
        );
      }
    }

    if (migrationsRan) {
      await this.setStoreValue(storeName, migratedValue);
    }

    this.updateLocalValue(storeName, migratedValue);

    return migratedValue;
  };

  private loadStoreValues = async <T extends StoreName>(storeNames: T[]): Promise<void> => {
    this.assertNotDestroyed();

    const storeKeys = storeNames.map(this.getStoreStorageKey);
    const values = await this.storageAdapter.getMany(...storeKeys);

    // eslint-disable-next-line no-restricted-syntax
    for (const storeName of storeNames) {
      const value = values[this.getStoreStorageKey(storeName)];
      if (!value) {
        // eslint-disable-next-line no-continue
        continue;
      }

      await this.parseAndMigrateStoreValue(storeName, value);
      this.bootstrappedStores?.add(storeName);
    }
  };

  private loadStoreValue = async <T extends StoreName>(
    storeName: T,
    ignoreCache = false,
  ): Promise<(typeof storeDefinitions)[T]['defaultValue']> => {
    this.assertNotDestroyed();

    if (!ignoreCache && this.storeCache[storeName]) {
      return this.storeCache[storeName];
    }

    const value = await this.storageAdapter.get(this.getStoreStorageKey(storeName));

    if (value) {
      this.bootstrappedStores?.add(storeName);
      const migratedValue = await this.parseAndMigrateStoreValue(storeName, value);
      return migratedValue;
    }

    return storeDefinitions[storeName].defaultValue;
  };

  initialise = async (): Promise<void> => {
    try {
      // preload all stores into cache
      await this.loadStoreValues(Object.keys(storeDefinitions) as StoreName[]);
      this.bootstrappedStores = new Set(Object.keys(this.storeCache) as StoreName[]);
      this.initialiser.resolve();
    } catch (error) {
      const wrappedError = new Error('Persistent store initialisation failed.', { cause: error });
      this.initialiser.reject(wrappedError);
      throw wrappedError;
    }
  };

  waitForInit = async (): Promise<void> => {
    if (this.initialiser.state === 'initialised') {
      return;
    }
    await this.initialiser.initialisePromise;
  };

  isStoreBootstrapped = async (storeName: StoreName): Promise<boolean> => {
    this.assertNotDestroyed();

    if (!this.bootstrappedStores) {
      const storeKeys = await this.storageAdapter.getAllKeys();
      this.bootstrappedStores = new Set(
        storeKeys
          .filter((key) => key.startsWith(this.storageKeyPrefix))
          .map((key) => key.replace(this.storageKeyPrefix, '') as StoreName),
      );
    }

    return this.bootstrappedStores.has(storeName);
  };

  setStoreValue = async <T extends StoreName>(
    storeName: T,
    value: (typeof storeDefinitions)[T]['defaultValue'],
  ): Promise<void> => {
    this.assertNotDestroyed();

    const storeDefinition = storeDefinitions[storeName];
    const storeValue: StoredValue<T> = {
      value,
      version: storeDefinition.activeVersion,
    };

    const serializedValue = JSON.stringify(storeValue);
    await this.storageAdapter.set(this.getStoreStorageKey(storeName), serializedValue);
    this.updateLocalValue(storeName, value);
    this.bootstrappedStores?.add(storeName);
  };

  resetStoreValue = async <T extends StoreName>(storeName: T): Promise<void> => {
    this.assertNotDestroyed();

    const storeDefinition = storeDefinitions[storeName];

    if (!storeDefinition.options?.resettable) {
      throw new Error(`Store ${storeName} is not resettable.`);
    }

    await this.storageAdapter.remove(this.getStoreStorageKey(storeName));

    delete this.storeCache[storeName];

    this.listeners[storeName]?.forEach((callback) => {
      callback(storeDefinition.defaultValue);
    });
    this.bootstrappedStores?.delete(storeName);
  };

  updateStoreValue = async <T extends StoreName>(
    storeName: T,
    value: Partial<StoreSchema<T>>,
  ): Promise<StoreSchema<T>> => {
    this.assertNotDestroyed();
    await this.initialiser.initialisePromise;

    const currentValue = await this.loadStoreValue(storeName, true);
    const newValue = { ...currentValue, ...value };

    Object.keys(value).forEach((key) => {
      if (value[key as keyof StoreSchema<T>] === undefined) {
        delete newValue[key as keyof StoreSchema<T>];
      }
    });

    await this.setStoreValue(storeName, newValue);

    return newValue;
  };

  getStoreValue = <T extends StoreName>(storeName: T): StoreSchema<T> => {
    this.assertNotDestroyed();

    if (this.initialiser.state !== 'initialised') {
      if (this.initialiser.state === 'rejected') {
        throw new Error('Store manager initialisation failed.', { cause: this.initialiser.error });
      }
      throw new Error(
        'Store manager is not initialised yet. Please ensure app is set to render only after initialisation.',
      );
    }

    return this.storeCache[storeName] ?? storeDefinitions[storeName].defaultValue;
  };

  addListener = <T extends StoreName>(storeName: T, callback: (newValue: StoreSchema<T>) => void): (() => void) => {
    this.assertNotDestroyed();

    this.listeners[storeName] ||= [];

    this.listeners[storeName].push(callback);

    return () => {
      this.listeners[storeName] = this.listeners[storeName]?.filter((cb) => cb !== callback);
    };
  };

  getStoreMutators = <T extends StoreName>(storeName: T): StoreMutators<T> => {
    const storeDefinition = storeDefinitions[storeName];
    return storeDefinition.createMutators(this) as StoreMutators<T>;
  };

  // eslint-disable-next-line class-methods-use-this
  getStoreUtils = <T extends StoreName>(storeName: T): StoreUtils<T> => {
    const storeDefinition = storeDefinitions[storeName];
    return { ...storeDefinition.utils } as StoreUtils<T>;
  };

  /**
   * This should be called when an instance of the class is no longer needed and is going out of scope.
   * If not called, even if the instance of the class is out of scope, the listeners will still be active,
   * which means that the garbage collector will not be able to collect the instance.
   */
  destroy(): void {
    this.cleanListener?.();
    this.isDestroyed = true;
  }
}
