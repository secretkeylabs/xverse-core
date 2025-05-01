import { ExtendedStorageAdapter } from '../../types';

export const createInMemoryStorage = (
  store: Record<string, string> = {},
  overrides?: Partial<ExtendedStorageAdapter>,
) => {
  let listeners: ((change: { [key: string]: { newValue?: unknown; oldValue?: unknown } }) => void)[] = [];

  const notifyListeners = (change: { [key: string]: { newValue?: unknown; oldValue?: unknown } }) => {
    for (const listener of listeners) {
      listener(change);
    }
  };

  return {
    fireOffChangeEvent: (key: string, oldValue?: string, value?: string) => {
      notifyListeners({ [key]: { oldValue, newValue: value } });
    },
    get(key: string) {
      return store.hasOwnProperty(key) ? store[key] : null;
    },

    getMany<T extends string>(...keys: T[]) {
      const result: Partial<Record<T, string>> = {};
      for (const key of keys) {
        if (store.hasOwnProperty(key)) {
          result[key] = store[key];
        }
      }
      return result;
    },

    set(key: string, value: string) {
      const oldValue = store[key];
      store[key] = value;
      notifyListeners({ [key]: { oldValue, newValue: value } });
    },

    remove(key: string) {
      if (store.hasOwnProperty(key)) {
        const oldValue = store[key];
        delete store[key];
        notifyListeners({ [key]: { oldValue } });
      }
    },

    getAllKeys() {
      return Object.keys(store);
    },

    addListener: ((callback) => {
      listeners.push(callback);
      return () => {
        listeners = listeners.filter((fn) => fn !== callback);
      };
    }) as ExtendedStorageAdapter['addListener'],
    ...overrides,
  };
};
