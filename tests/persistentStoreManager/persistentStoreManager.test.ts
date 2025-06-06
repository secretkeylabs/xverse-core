import { describe, expect, it, vi } from 'vitest';
import { PersistentStoreManager } from '../../persistentStoreManager';
import { walletOptionsStore } from '../../persistentStoreManager/stores/WalletOptionsStore';
import { createInMemoryStorage } from './createInMemoryStorage';

describe('PersistentStoreManager', () => {
  it('should initialise correctly', async () => {
    const storageAdapter = createInMemoryStorage({
      'persistentStore::accountBalances': '{"value":{"account_key": "1000"}, "version":0}',
    });
    const store = new PersistentStoreManager(storageAdapter);
    await store.initialise();

    const accountBalanceStoreValue = store.getStoreValue('accountBalances');
    expect(accountBalanceStoreValue).toEqual({ account_key: '1000' });

    const walletOptionsStoreValue = store.getStoreValue('walletOptions');
    expect(walletOptionsStoreValue).toEqual(walletOptionsStore.defaultValue);
  });

  it('waitForInit should block until initialised', async () => {
    const storageAdapter = createInMemoryStorage({
      'persistentStore::accountBalances': '{"value":{"account_key": "1000"}, "version":0}',
    });
    const store = new PersistentStoreManager(storageAdapter);
    store.initialise();

    expect(() => store.getStoreValue('accountBalances')).toThrow();

    await store.waitForInit();

    const accountBalanceStoreValue = store.getStoreValue('accountBalances');
    expect(accountBalanceStoreValue).toEqual({ account_key: '1000' });
  });

  it('should throw on get if initialisation fails', async () => {
    const storageAdapter = createInMemoryStorage(
      {},
      {
        getMany: () => {
          throw new Error('Failed to getMany');
        },
      },
    );
    const store = new PersistentStoreManager(storageAdapter);
    await expect(() => store.initialise()).rejects.toThrow('Persistent store initialisation failed.');
    await expect(() => store.waitForInit()).rejects.toThrow('Persistent store initialisation failed.');

    expect(() => store.getStoreValue('accountBalances')).toThrow('Store manager initialisation failed.');
  });

  it('should set, update and get store values', async () => {
    const storage: Record<string, string> = {};
    const storageAdapter = createInMemoryStorage(storage);
    const store = new PersistentStoreManager(storageAdapter);
    await store.initialise();

    const accountBalanceStoreValue = store.getStoreValue('accountBalances');
    expect(accountBalanceStoreValue).toEqual({});
    expect(Object.keys(storage)).toHaveLength(0);

    await store.setStoreValue('accountBalances', { account_key: '1000', account_key3: '3000' });
    expect(Object.keys(storage)).toHaveLength(1);
    expect(storage['persistentStore::accountBalances']).toEqual(
      '{"value":{"account_key":"1000","account_key3":"3000"},"version":0}',
    );
    expect(store.getStoreValue('accountBalances')).toEqual({ account_key: '1000', account_key3: '3000' });

    await store.updateStoreValue('accountBalances', { account_key2: '2000', account_key3: undefined });
    expect(Object.keys(storage)).toHaveLength(1);
    expect(storage['persistentStore::accountBalances']).toEqual(
      '{"value":{"account_key":"1000","account_key2":"2000"},"version":0}',
    );
    expect(store.getStoreValue('accountBalances')).toEqual({
      account_key: '1000',
      account_key2: '2000',
    });

    await store.setStoreValue('accountBalances', { account_key3: '3000' });
    expect(Object.keys(storage)).toHaveLength(1);
    expect(storage['persistentStore::accountBalances']).toEqual('{"value":{"account_key3":"3000"},"version":0}');
    expect(store.getStoreValue('accountBalances')).toEqual({ account_key3: '3000' });
  });

  it('should throw on get, set and update after calling destroy', async () => {
    const storage: Record<string, string> = {};
    const storageAdapter = createInMemoryStorage(storage);
    const store = new PersistentStoreManager(storageAdapter);
    await store.initialise();

    await store.setStoreValue('accountBalances', { account_key: '1000' });
    expect(store.getStoreValue('accountBalances')).toEqual({ account_key: '1000' });

    store.destroy();

    await expect(() => store.setStoreValue('accountBalances', { account_key2: '2000' })).rejects.toThrow(
      'PersistentStoreManager instance is destroyed and cannot be used.',
    );
    await expect(() => store.updateStoreValue('accountBalances', { account_key2: '2000' })).rejects.toThrow(
      'PersistentStoreManager instance is destroyed and cannot be used.',
    );
    expect(() => store.getStoreValue('accountBalances')).toThrow(
      'PersistentStoreManager instance is destroyed and cannot be used.',
    );
  });

  it('should react to external listener changes', async () => {
    const storage: Record<string, string> = {};
    const storageAdapter = createInMemoryStorage(storage);
    const store = new PersistentStoreManager(storageAdapter);
    await store.initialise();

    await store.setStoreValue('accountBalances', { account_key: '1000' });
    expect(store.getStoreValue('accountBalances')).toEqual({ account_key: '1000' });

    storageAdapter.fireOffChangeEvent(
      'persistentStore::accountBalances',
      '{"value":{"account_key": "1000"}, "version":0}',
      '{"value":{"account_key2": "2000"}, "version":0}',
    );

    expect(store.getStoreValue('accountBalances')).toEqual({ account_key2: '2000' });
    expect(Object.keys(storage).length).toEqual(1);
  });

  it('does not react to external listener changes on unknown keys or stores', async () => {
    const storage: Record<string, string> = {};
    const storageAdapter = createInMemoryStorage(storage);
    const store = new PersistentStoreManager(storageAdapter);
    await store.initialise();

    storageAdapter.fireOffChangeEvent(
      'persistentStore::OtherStore',
      '{"value":"SOMETHING","version":0}',
      '{"value":"SOMETHING_ELSE", "version":0}',
    );

    expect(Object.keys(storage).length).toEqual(0);

    storageAdapter.fireOffChangeEvent('Other event', 'Bloop', 'bleep');

    expect(Object.keys(storage).length).toEqual(0);
  });

  it('should not update if invalid change event sent', async () => {
    const storage: Record<string, string> = {
      'persistentStore::accountBalances': '{"value":{"account_key":"1000"},"version":0}',
    };
    const storageAdapter = createInMemoryStorage(storage);
    const store = new PersistentStoreManager(storageAdapter);
    await store.initialise();

    storageAdapter.fireOffChangeEvent(
      'persistentStore::accountBalances',
      '{"value":{"account_key": "1000"},"version":0}',
      '{"value":{"account_key2": "2000"}}',
    );

    expect(store.getStoreValue('accountBalances')).toEqual({ account_key: '1000' });
  });

  it('should fire off listener changes', async () => {
    const storage: Record<string, string> = {};
    const storageAdapter = createInMemoryStorage(storage);
    const store = new PersistentStoreManager(storageAdapter);
    await store.initialise();

    const callback = vi.fn();
    store.addListener('accountBalances', callback);

    await store.setStoreValue('accountBalances', { account_key: '1000' });
    expect(callback).toHaveBeenCalledWith({ account_key: '1000' });
  });

  it('should remove listener on remove callback called', async () => {
    const storage: Record<string, string> = {};
    const storageAdapter = createInMemoryStorage(storage);
    const store = new PersistentStoreManager(storageAdapter);
    await store.initialise();

    const callback1 = vi.fn();
    store.addListener('accountBalances', callback1);
    const callback2 = vi.fn();
    const removeCallback2 = store.addListener('accountBalances', callback2);

    await store.setStoreValue('accountBalances', { account_key: '1000' });
    expect(callback1).toHaveBeenCalledWith({ account_key: '1000' });
    expect(callback2).toHaveBeenCalledWith({ account_key: '1000' });

    callback1.mockClear();
    callback2.mockClear();
    removeCallback2();

    await store.setStoreValue('accountBalances', { account_key: '2000' });
    expect(callback1).toHaveBeenCalledWith({ account_key: '2000' });
    expect(callback2).not.toHaveBeenCalled();
  });

  it('should remove value if change event with undefined sent', async () => {
    const storage: Record<string, string> = {
      'persistentStore::accountBalances': '{"value":{"account_key":"1000"},"version":0}',
    };
    const storageAdapter = createInMemoryStorage(storage);
    const store = new PersistentStoreManager(storageAdapter);
    await store.initialise();

    const listener = vi.fn();
    store.addListener('accountBalances', listener);

    storageAdapter.fireOffChangeEvent(
      'persistentStore::accountBalances',
      '{"value":{"account_key": "1000"},"version":0}',
    );

    expect(store.getStoreValue('accountBalances')).toEqual({});
    expect(await store.isStoreBootstrapped('accountBalances')).toEqual(false);
    expect(listener).toHaveBeenCalledWith({});
  });

  it('loads bootstrapped stores if not yet initialised', async () => {
    const storage: Record<string, string> = {
      'persistentStore::accountBalances': '{"value":{"account_key":"1000"},"version":0}',
    };
    const storageAdapter = createInMemoryStorage(storage);
    const store = new PersistentStoreManager(storageAdapter);
    expect(await store.isStoreBootstrapped('accountBalances')).toEqual(true);
    expect(await store.isStoreBootstrapped('activeAccount')).toEqual(false);
  });

  it('resetting resettable store clears storage', async () => {
    const storage: Record<string, string> = {
      'persistentStore::accountBalances': '{"value":{"account_key":"1000"},"version":0}',
    };
    const storageAdapter = createInMemoryStorage(storage);
    const store = new PersistentStoreManager(storageAdapter);
    await store.initialise();

    const callback = vi.fn();
    store.addListener('accountBalances', callback);

    await store.resetStoreValue('accountBalances');
    expect(Object.keys(storage)).toHaveLength(0);
    expect(store.getStoreValue('accountBalances')).toEqual({});
    expect(await store.isStoreBootstrapped('accountBalances')).toEqual(false);
    expect(callback).toHaveBeenCalledWith({});
  });

  it('resetting non resettable store throws', async () => {
    const storage: Record<string, string> = {};
    const storageAdapter = createInMemoryStorage(storage);
    const store = new PersistentStoreManager(storageAdapter);
    await store.initialise();

    await expect(() => store.resetStoreValue('walletOptions')).rejects.toThrow(
      'Store walletOptions is not resettable.',
    );
  });
});
