import { StorageAdapter } from '../../types';
import { JSONCompatible } from '../../utils';
import { StorageKeys } from '../common';
import { EncryptionVault } from '../encryptionVault';
import { VaultConfig } from '../types';
import { type KeyValueVaultKey, keyValueVaultKeys } from './vaultKeys';

export { keyValueVaultKeys, type KeyValueVaultKey };

/** This should not be used directly. Key Value Vault should only be constructed via a MasterVault. */
export class KeyValueVault {
  private readonly commonStorageAdapter: StorageAdapter;

  private readonly encryptionVault: EncryptionVault;

  constructor(config: VaultConfig, encryptionVault: EncryptionVault) {
    this.commonStorageAdapter = config.commonStorageAdapter;
    this.encryptionVault = encryptionVault;
  }

  private getFullKey = (itemKey: string): string => `${StorageKeys.keyValueVaultPrefix}::${itemKey}`;

  get = async <T>(key: KeyValueVaultKey): Promise<JSONCompatible<T> | undefined> => {
    const fullKey = this.getFullKey(key);
    const storedData = await this.commonStorageAdapter.get(fullKey);

    if (!storedData) {
      return undefined;
    }

    const data = await this.encryptionVault.decrypt<T>(storedData, 'data');
    return data;
  };

  set = async <T>(key: KeyValueVaultKey, value: JSONCompatible<T>) => {
    const fullKey = this.getFullKey(key);
    const encryptedValue = await this.encryptionVault.encrypt(value, 'data');
    await this.commonStorageAdapter.set(fullKey, encryptedValue);
  };

  remove = async (key: KeyValueVaultKey) => {
    const fullKey = this.getFullKey(key);
    await this.commonStorageAdapter.remove(fullKey);
  };

  clear = async () => {
    if (!this.commonStorageAdapter.getAllKeys) {
      console.warn(
        'The storage adapter does not implement getAllKeys, so the keyValueVault clear method will not work',
      );
      return;
    }
    const allStorageKeys = await this.commonStorageAdapter.getAllKeys();

    const storedKeyValueVaultKeys = allStorageKeys.filter((key) => key.startsWith(StorageKeys.keyValueVaultPrefix));

    for (const key of storedKeyValueVaultKeys) {
      await this.commonStorageAdapter.remove(key);
    }
  };

  getAllKeys = async () => {
    if (!this.commonStorageAdapter.getAllKeys) {
      console.warn(
        'The storage adapter does not implement getAllKeys, so the keyValueVault getAllKeys method will not work',
      );
      return undefined;
    }
    const allStorageKeys = await this.commonStorageAdapter.getAllKeys();

    const storedKeyValueVaultKeys = allStorageKeys.filter((key) => key.startsWith(StorageKeys.keyValueVaultPrefix));

    return storedKeyValueVaultKeys.map((key) => key.replace(`${StorageKeys.keyValueVaultPrefix}::`, ''));
  };
}
