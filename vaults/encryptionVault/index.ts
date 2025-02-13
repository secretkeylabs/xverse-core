import { Mutex } from 'async-mutex';
import { StorageAdapter } from '../../types';
import { JSONCompatible } from '../../utils';
import { StorageKeys } from '../common';
import { CryptoUtilsAdapter, VaultConfig } from '../types';

export type EncryptionVaultData = {
  seedEncryptionKey: string;
  dataEncryptionKey: string;
  dataSalt: string;
};

export class EncryptionVault {
  private readonly secureStorageAdapter: StorageAdapter;

  private readonly cryptoUtilsAdapter: CryptoUtilsAdapter;

  private readonly commonStorageAdapter: StorageAdapter;

  private readonly saveMutex = new Mutex();

  private dataEncryptionKeys?: {
    encryptionKey: string;
    salt: string;
  };

  constructor(config: VaultConfig) {
    this.secureStorageAdapter = config.secureStorageAdapter;
    this.cryptoUtilsAdapter = config.cryptoUtilsAdapter;
    this.commonStorageAdapter = config.commonStorageAdapter;
  }

  initialise = async (password: string) => {
    const encryptionVaultData: EncryptionVaultData = {
      seedEncryptionKey: await this.cryptoUtilsAdapter.generateRandomBytes(32),
      dataEncryptionKey: await this.cryptoUtilsAdapter.generateRandomBytes(32),
      dataSalt: await this.cryptoUtilsAdapter.generateRandomBytes(32),
    };
    await this.storeEncryptedKeys(encryptionVaultData, password);

    // load data encryption keys into memory
    await this.getEncryptionKeysForData('data');
  };

  changePassword = async (password: string) => {
    const encryptionKeys = await this.getEncryptionKeys();
    await this.storeEncryptedKeys(encryptionKeys, password, true);
  };

  unlockVault = async (password: string): Promise<void> => {
    const encryptedKeys = await this.commonStorageAdapter.get(StorageKeys.encryptionVault);
    const salt = await this.commonStorageAdapter.get(StorageKeys.passwordSalt);

    if (salt && encryptedKeys) {
      try {
        const passwordHash = await this.cryptoUtilsAdapter.hash(password, salt);
        await this.cryptoUtilsAdapter.decrypt(encryptedKeys, passwordHash);
        await this.secureStorageAdapter.set(StorageKeys.passwordHash, passwordHash);

        // load data encryption keys into memory
        await this.getEncryptionKeysForData('data');
      } catch (err) {
        await this.lockVault();
        throw new Error('Wrong password');
      }
    } else {
      await this.lockVault();
      throw new Error('Empty vault');
    }
  };

  /**
   * This will lock the encryption vault and the seed vault, but the key value vault will remain unlocked
   */
  softLockVault = async () => {
    await this.secureStorageAdapter.remove(StorageKeys.passwordHash);
  };

  lockVault = async () => {
    await this.secureStorageAdapter.remove(StorageKeys.passwordHash);
    await this.secureStorageAdapter.remove(StorageKeys.encryptionVaultDataKeys);
    this.dataEncryptionKeys = undefined;
  };

  isVaultUnlocked = async () => {
    const passwordHash = await this.secureStorageAdapter.get(StorageKeys.passwordHash);
    return !!passwordHash;
  };

  isInitialised = async () => {
    const encryptedKeys = await this.commonStorageAdapter.get(StorageKeys.encryptionVault);
    const salt = await this.commonStorageAdapter.get(StorageKeys.passwordSalt);
    return !!encryptedKeys && !!salt;
  };

  encrypt = async <T>(value: JSONCompatible<T>, encryptionKeyType: 'seed' | 'data') => {
    const { encryptionKey, salt } = await this.getEncryptionKeysForData(encryptionKeyType);

    const encryptionHash = await this.cryptoUtilsAdapter.hash(encryptionKey, salt);
    const serialisedValue = JSON.stringify(value);
    const encryptedValue = await this.cryptoUtilsAdapter.encrypt(serialisedValue, encryptionHash);

    return encryptedValue;
  };

  decrypt = async <T>(
    encryptedValue: string,
    encryptionKeyType: 'seed' | 'data',
  ): Promise<JSONCompatible<T> | undefined> => {
    if (!encryptedValue) {
      return undefined;
    }

    const { encryptionKey, salt } = await this.getEncryptionKeysForData(encryptionKeyType);

    const encryptionHash = await this.cryptoUtilsAdapter.hash(encryptionKey, salt);
    const decryptedValue = await this.cryptoUtilsAdapter.decrypt(encryptedValue, encryptionHash);

    return JSON.parse(decryptedValue) as JSONCompatible<T>;
  };

  private getEncryptionKeysForData = async (encryptionKeyType: 'seed' | 'data') => {
    if (encryptionKeyType === 'data') {
      if (!this.dataEncryptionKeys) {
        // check for cached dataEncryptionKeys in session storage
        const dataEncryptionKeys = await this.secureStorageAdapter.get(StorageKeys.encryptionVaultDataKeys);
        if (dataEncryptionKeys) {
          try {
            const parsedEncryptionKeys = JSON.parse(dataEncryptionKeys);

            if (parsedEncryptionKeys.encryptionKey && parsedEncryptionKeys.salt) {
              this.dataEncryptionKeys = {
                encryptionKey: parsedEncryptionKeys.encryptionKey,
                salt: parsedEncryptionKeys.salt,
              };
            }
          } catch {
            // no-op - parsing failed, so just continue to try to fetch from storage
          }
        }
      }

      if (this.dataEncryptionKeys) {
        return {
          encryptionKey: this.dataEncryptionKeys.encryptionKey,
          salt: this.dataEncryptionKeys.salt,
        };
      }
    }

    const encryptionKeys = await this.getEncryptionKeys();

    const encryptionKey =
      encryptionKeyType === 'seed' ? encryptionKeys.seedEncryptionKey : encryptionKeys.dataEncryptionKey;
    const salt = encryptionKeys.dataSalt;

    const result = { encryptionKey, salt };

    if (encryptionKeyType === 'data') {
      // we keep these in memory for faster access for low risk data items
      this.dataEncryptionKeys = result;
      await this.secureStorageAdapter.set(StorageKeys.encryptionVaultDataKeys, JSON.stringify(result));
    }

    return result;
  };

  private getEncryptionKeys = async (): Promise<EncryptionVaultData> => {
    const encryptedKeys = await this.commonStorageAdapter.get(StorageKeys.encryptionVault);
    if (!encryptedKeys) {
      throw new Error('Encryption vault not initialised.');
    }

    const passwordHash = await this.secureStorageAdapter.get(StorageKeys.passwordHash);
    if (!passwordHash) {
      throw new Error('Vault is locked.');
    }

    const decryptedKeys = await this.cryptoUtilsAdapter.decrypt(encryptedKeys, passwordHash);
    if (!decryptedKeys) {
      throw new Error('Wrong password');
    }

    const encryptionKeyData = JSON.parse(decryptedKeys) as EncryptionVaultData;

    if (
      !encryptionKeyData ||
      !encryptionKeyData.seedEncryptionKey ||
      !encryptionKeyData.dataEncryptionKey ||
      !encryptionKeyData.dataSalt
    ) {
      throw new Error('Invalid encryption keys');
    }
    return encryptionKeyData;
  };

  private storeEncryptedKeys = async (data: EncryptionVaultData, password: string, overwriteExisting = false) => {
    await this.saveMutex.runExclusive(async () => {
      const isInitialised = await this.isInitialised();
      if (isInitialised && !overwriteExisting) {
        throw new Error('Vault already initialised');
      }

      const salt = await this.cryptoUtilsAdapter.generateRandomBytes(32);
      if (!salt) throw new Error('passwordSalt generation failed');

      const passwordHash = await this.cryptoUtilsAdapter.hash(password, salt);
      if (!passwordHash) throw new Error('passwordHash creation failed');

      const serialisedData = JSON.stringify(data);
      const encryptedKeys = await this.cryptoUtilsAdapter.encrypt(serialisedData, passwordHash);
      if (!encryptedKeys) throw new Error('Key encryption failed');

      await this.commonStorageAdapter.set(StorageKeys.passwordSalt, salt);
      await this.commonStorageAdapter.set(StorageKeys.encryptionVault, encryptedKeys);
      await this.secureStorageAdapter.set(StorageKeys.passwordHash, passwordHash);
    });
  };
}
