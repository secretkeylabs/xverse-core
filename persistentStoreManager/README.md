Reactive Persistent Store
=========================

The reactive persistent store is a custom implementation of a persistent store that is catered to our needs. It is designed to replace the use of Redux and Zustand and all other dependencies required to make them persistent and to span across multiple tabs, while abstracting the persistence layer, allowing us to use this store both in the browser and mobile.

# Usage
1. Define a global instance of the store manager in  your app, powered by any implementation of ExtendedStoreManager.
e.g. for extension and chrome storage
```typescript
import { PersistentStoreManager, type ExtendedStorageAdapter } from '@secretkeylabs/xverse-core';
import chromeStorage from '@utils/chromeStorage';

const localStorageAdapter: ExtendedStorageAdapter = {
  get: async (key: string) => chromeStorage.local.getItem<string, null>(key, null),
  getMany: async <T extends string>(...keys: T[]) => chromeStorage.local.getItems<T>(...keys),
  set: async (key: string, value: string) => chromeStorage.local.setItem(key, value),
  remove: async (key: string) => chromeStorage.local.removeItem(key),
  addListener: (callback) => chromeStorage.local.addListener(callback),
  getAllKeys: async () => chromeStorage.local.getAllKeys(),
};

export const globalStoreManager = new PersistentStoreManager(localStorageAdapter);
```

e.g. for mobile and react-native-mmkv
```typescript
import {MMKV} from 'react-native-mmkv';

import {PersistentStoreManager, StorageAdapter} from './persistentStoreManager';

export const storage = new MMKV();

const storageAdapter: StorageAdapter = {
  get: async (key: string) => storage.getString(key) ?? null,
  getMany: async <T extends string>(...keys: T[]) => {
    const result = {} as Record<T, string>;
    for (const key of keys) {
      const value = storage.getString(key);
      if (value !== undefined) {
        result[key] = value;
      }
    }
    return result;
  },
  set: async (key: string, value: string) => storage.set(key, value),
  remove: async (key: string) => storage.delete(key),
  getAllKeys: async () => storage.getAllKeys(),
};

export const globalStoreManager = new PersistentStoreManager(storageAdapter);
```
2. Migrate data from old store if needed and initialize the store manager in your app.

Note that if you do not initialize the store manager, it will throw an error when you try to use it for reads.
```typescript
if ((await globalStoreManager.isStoreBootstrapped('activeAccount')) === false) {
  await globalStoreManager.setStoreValue('activeAccount', {
    selectedAccountIndex: oldWalletState.selectedAccountIndex,
    selectedAccountType: oldWalletState.selectedAccountType,
    selectedWalletId: oldWalletState.selectedWalletId,
    btcPaymentAddressType: oldWalletState.btcPaymentAddressType,
    network: oldWalletState.network,
  });
}

await globalStoreManager.initialise();
```
3. Create a hook to use the store manager in your components.
```typescript
import type { Store, StoreMutators, StoreSchema, StoreUtils } from '@secretkeylabs/xverse-core';
import { globalStoreManager } from '@stores/persistentStoreManager';
import { useEffect, useMemo, useState } from 'react';

type UseStoreReturn<T extends Store, S> = {
  data: S;
  actions: StoreMutators<T>;
  utils: StoreUtils<T>;
};

const shallowCompare = <T>(a: T, b: T) => {
  if (a === b) return true;
  if (typeof a !== 'object' || typeof b !== 'object') return false;
  if (a === null || b === null) return false;

  if (Array.isArray(a) || Array.isArray(b)) {
    if (!Array.isArray(a) || !Array.isArray(b)) return false;
    if (a.length !== b.length) return false;
    return a.every((item, index) => item === b[index]);
  }

  const aKeys = Object.keys(a);
  const bKeys = Object.keys(b);
  if (aKeys.length !== bKeys.length) return false;
  if (aKeys.some((key) => !bKeys.includes(key))) return false;

  return aKeys.every((key) => a[key] === b[key]);
};

export const useStore = <T extends Store, S = StoreSchema<T>>(
  store: T,
  selector: (store: StoreSchema<T>, utils: StoreUtils<T>) => S = (storeData: StoreSchema<T>) =>
    storeData as S,
): UseStoreReturn<T, S> => {
  const actions = useMemo(() => globalStoreManager.getStoreMutators(store), [store]);
  const utils = useMemo(() => globalStoreManager.getStoreUtils(store), [store]);

  const [dataLocal, setDataLocal] = useState<S>(() =>
    selector(globalStoreManager.getStoreValue(store), utils),
  );

  useEffect(() => {
    let isMounted = true;

    const changeHandler = async (newValue: StoreSchema<T>) => {
      if (!isMounted) return;
      const newData = selector(newValue, utils);
      setDataLocal((oldData) => {
        if (shallowCompare(oldData, newData)) {
          return oldData;
        }
        return newData;
      });
    };

    const removeListener = globalStoreManager.addListener(store, changeHandler);

    return () => {
      isMounted = false;
      removeListener();
    };
  }, [selector, utils, store]);

  return { data: dataLocal, actions, utils };
};
```
4. Use the hook in your components.
```typescript
import { useStore } from '@hooks';
import type { Account } from '@secretkeylabs/xverse-core';

function AccountBalance({account}:{account: Account}) {
  // Note that using the selector function is optional and you can just use the
  // store directly to get the full store data.
  // Using the selector function is recommended to avoid unnecessary re-renders.
  const accountBalanceStore = useStore(
    'accountBalances',
    (store, utils) => store.data[utils.getAccountStorageKey(account)]
  );

  // the onClick handler is just an example to show how to update the store
  return (
    <div onClick={() => accountBalanceStore.actions.setAccountBalance(account, 100)}>
      <h2>{account.address}</h2>
      <p>Balance: {accountBalanceStore.data}</p>
    </div>
  );
}

export default AccountBalance;
```

# Defining a Store
Stores are defined in the `stores` folder. Each store is a separate file and should export ana object that follows the Store interface, unwrapping it using the `inferStoreDefinition` utility function. New stores also need to be added to the `storeDefinitions` variable in the `persistentStoreManager` file. The store manager is responsible for managing the stores and their state.

These store definitions are used to define the structure of the store and the types of data it can hold. The store manager uses these definitions to ensure that the data is stored and retrieved correctly.

Data in the stores can be migrated using migration functions. To migrate data, first bump the activeVersion of the store by 1 and then add a migration function for the previous version. The migration function should take the old store data as an argument and return the new store data. The migration function can also perform any necessary transformations on the data. Note that the migration function should be asynchronous, as it may involve asynchronous operations such as fetching data from an API or a vault.

```typescript
export const accountBalanceStore = inferStoreDefinition({
  name: storeName,
  defaultValue: {} as AccountBalancesStore,
  activeVersion: 1,
  migrate: {
    1: async (oldStore) => {
      const newStore = { ...oldStore };
      // Perform migration logic here
      return newStore as AccountBalancesStore;
    },
  },
  // ...
});
```
