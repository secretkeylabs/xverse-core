import { beforeEach, describe, expect, it, vi } from 'vitest';
import { VaultConfig } from '../../vaults';
import { EncryptionVault } from '../../vaults/encryptionVault';
import { KeyValueVault } from '../../vaults/keyValueVault';

describe('KeyValueVault', () => {
  const secureStorageAdapter = {
    get: vi.fn(),
    set: vi.fn(),
    remove: vi.fn(),
    getAllKeys: vi.fn(),
  };
  const commonStorageAdapter = {
    get: vi.fn(),
    set: vi.fn(),
    remove: vi.fn(),
    getAllKeys: vi.fn(),
  };
  const cryptoUtilsAdapter = {
    encrypt: vi.fn(),
    decrypt: vi.fn(),
    hash: vi.fn(),
    generateRandomBytes: vi.fn(),
  };
  const config: VaultConfig = {
    secureStorageAdapter,
    cryptoUtilsAdapter,
    commonStorageAdapter,
  };

  const encryptionVaultMock = {
    decrypt: vi.fn(),
    encrypt: vi.fn(),
  };
  const encryptionVault = encryptionVaultMock as unknown as EncryptionVault;

  function setupMocks() {
    const commonStorage: Record<string, unknown> = {};
    commonStorageAdapter.get.mockImplementation((key: string) => commonStorage[key]);
    commonStorageAdapter.set.mockImplementation((key: string, value: unknown) => {
      commonStorage[key] = value;
    });
    commonStorageAdapter.remove.mockImplementation((key: string) => {
      delete commonStorage[key];
    });
    commonStorageAdapter.getAllKeys.mockImplementation(() => Object.keys(commonStorage));

    encryptionVaultMock.encrypt.mockImplementation(async (data: unknown) => {
      const encrypted = JSON.stringify(data);
      return encrypted;
    });
    encryptionVaultMock.decrypt.mockImplementation(async (data: string) => {
      const decrypted = JSON.parse(data);
      return decrypted;
    });
  }

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('set and get a value', async () => {
    setupMocks();

    const keyValueVault = new KeyValueVault(config, encryptionVault);

    const initialValue = await keyValueVault.get('addressBook::Mainnet');
    expect(initialValue).toBe(undefined);

    const value = { some: 'value' };
    await keyValueVault.set('addressBook::Mainnet', value);

    const storedValue = await keyValueVault.get('addressBook::Mainnet');
    expect(storedValue).toEqual(value);

    expect(commonStorageAdapter.get).toHaveBeenCalledTimes(2);
    expect(commonStorageAdapter.get).toHaveBeenCalledWith('vault::keyValueVault::addressBook::Mainnet');
    expect(commonStorageAdapter.set).toHaveBeenCalledTimes(1);
    expect(commonStorageAdapter.set).toHaveBeenCalledWith(
      'vault::keyValueVault::addressBook::Mainnet',
      `{"some":"value"}`,
    );
  });

  it('can override stored value', async () => {
    setupMocks();

    const keyValueVault = new KeyValueVault(config, encryptionVault);

    const initialValue = { some: 'value' };
    await keyValueVault.set('addressBook::Mainnet', initialValue);

    const storedValue = await keyValueVault.get('addressBook::Mainnet');
    expect(storedValue).toEqual(initialValue);

    const newValue = { some: 'new value' };
    await keyValueVault.set('addressBook::Mainnet', newValue);

    const updatedValue = await keyValueVault.get('addressBook::Mainnet');
    expect(updatedValue).toEqual(newValue);
  });

  it('remove a value', async () => {
    setupMocks();

    const keyValueVault = new KeyValueVault(config, encryptionVault);

    const value = { some: 'value' };
    await keyValueVault.set('addressBook::Mainnet', value);

    const storedValue = await keyValueVault.get('addressBook::Mainnet');
    expect(storedValue).toEqual(value);

    await keyValueVault.remove('addressBook::Mainnet');

    const removedValue = await keyValueVault.get('addressBook::Mainnet');
    expect(removedValue).toBe(undefined);

    expect(commonStorageAdapter.remove).toHaveBeenCalledTimes(1);
    expect(commonStorageAdapter.remove).toHaveBeenCalledWith('vault::keyValueVault::addressBook::Mainnet');
  });

  it('getAllKeys and clear all values', async () => {
    setupMocks();

    const keyValueVault = new KeyValueVault(config, encryptionVault);

    await keyValueVault.set('addressBook::Mainnet', { some: 'value1' });
    await keyValueVault.set('addressBook::Testnet4', { some: 'value2' });
    await keyValueVault.set('addressBook::Regtest', { some: 'value3' });

    const allKeysInitial = await keyValueVault.getAllKeys();
    expect(allKeysInitial).toEqual(['addressBook::Mainnet', 'addressBook::Testnet4', 'addressBook::Regtest']);

    await keyValueVault.clear();

    const allKeys = await keyValueVault.getAllKeys();
    expect(allKeys).toEqual([]);

    expect(commonStorageAdapter.remove).toHaveBeenCalledTimes(3);
    expect(commonStorageAdapter.remove).toHaveBeenCalledWith('vault::keyValueVault::addressBook::Mainnet');
    expect(commonStorageAdapter.remove).toHaveBeenCalledWith('vault::keyValueVault::addressBook::Testnet4');
    expect(commonStorageAdapter.remove).toHaveBeenCalledWith('vault::keyValueVault::addressBook::Regtest');
  });
});
