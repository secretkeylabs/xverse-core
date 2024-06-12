import { Mutex } from 'async-mutex';
import { StorageAdapter } from '../types';

export type CryptoUtilsAdapter = {
  encrypt(data: string, password: string): Promise<string>;
  decrypt(data: string, password: string): Promise<string>;
  hash(data: string, salt: string): Promise<string>;
  generateRandomBytes(length: number): string | Promise<string>;
};

export type SeedVaultConfig = {
  secureStorageAdapter: StorageAdapter;
  cryptoUtilsAdapter: CryptoUtilsAdapter;
  commonStorageAdapter: StorageAdapter;
};

export enum SeedVaultStorageKeys {
  PASSWORD_HASH = 'passwordHash',
  PASSWORD_SALT = 'passwordSalt',
  ENCRYPTED_KEY = 'encryptedKey',
  SEED_VAULT_VERSION = 'seedVaultVersion',
}

type SingletonRef = {
  current?: SeedVault;
};

const ref: SingletonRef = {
  current: undefined,
};

export class SeedVault {
  private readonly _secureStorageAdapter: StorageAdapter;

  private readonly _cryptoUtilsAdapter: CryptoUtilsAdapter;

  private readonly _commonStorageAdapter: StorageAdapter;

  private readonly _StoreSeedMutex: Mutex = new Mutex();

  VERSION = 2;

  constructor(config: SeedVaultConfig) {
    this._secureStorageAdapter = config.secureStorageAdapter;
    this._cryptoUtilsAdapter = config.cryptoUtilsAdapter;
    this._commonStorageAdapter = config.commonStorageAdapter;
  }

  private _storeSeed = async (seed: string, password: string, overwriteExistingSeed?: boolean) => {
    const release = await this._StoreSeedMutex.acquire();
    try {
      const prevStoredEncryptedSeed = await this.hasSeed();
      if (prevStoredEncryptedSeed && !overwriteExistingSeed) {
        throw new Error('Seed already set');
      }

      const salt = await this._cryptoUtilsAdapter.generateRandomBytes(32);
      if (!salt) throw new Error('passwordSalt generation failed');

      const passwordHash = await this._cryptoUtilsAdapter.hash(password, salt);
      if (!passwordHash) throw new Error('passwordHash creation failed');

      const encryptedSeed = await this._cryptoUtilsAdapter.encrypt(seed, passwordHash);
      if (!encryptedSeed) throw new Error('Seed encryption failed');

      this._commonStorageAdapter.set(SeedVaultStorageKeys.PASSWORD_SALT, salt);
      this._commonStorageAdapter.set(SeedVaultStorageKeys.ENCRYPTED_KEY, encryptedSeed);
      this._secureStorageAdapter.set(SeedVaultStorageKeys.PASSWORD_HASH, passwordHash);
      if (!overwriteExistingSeed) {
        this._commonStorageAdapter.set(SeedVaultStorageKeys.SEED_VAULT_VERSION, this.VERSION.toString());
      }
    } finally {
      release();
    }
  };

  storeSeed = async (seed: string, password: string) => this._storeSeed(seed, password, false);

  getSeed = async () => {
    const passwordHash = await this._secureStorageAdapter.get(SeedVaultStorageKeys.PASSWORD_HASH);
    if (!passwordHash) {
      throw new Error('passwordHash not set');
    }
    const encryptedSeed = await this._commonStorageAdapter.get(SeedVaultStorageKeys.ENCRYPTED_KEY);
    if (!encryptedSeed) throw new Error('Seed not set');
    const seed = await this._cryptoUtilsAdapter.decrypt(encryptedSeed, passwordHash as string);
    if (!seed) throw new Error('Wrong password');
    return seed;
  };

  restoreVault = async (encryptedKey: string, passwordSalt: string) => {
    const ExistingEncryptedKey = await this._commonStorageAdapter.get(SeedVaultStorageKeys.ENCRYPTED_KEY);
    const ExistingPasswordSalt = await this._commonStorageAdapter.get(SeedVaultStorageKeys.PASSWORD_SALT);
    if (ExistingPasswordSalt || ExistingEncryptedKey) {
      throw new Error('Cannot override existing seed');
    }
    await this._commonStorageAdapter.set(SeedVaultStorageKeys.ENCRYPTED_KEY, encryptedKey);
    await this._commonStorageAdapter.set(SeedVaultStorageKeys.PASSWORD_SALT, passwordSalt);
    await this._commonStorageAdapter.set(SeedVaultStorageKeys.SEED_VAULT_VERSION, this.VERSION.toString());
  };

  changePassword = async (oldPassword: string, newPassword: string) => {
    await this.unlockVault(oldPassword);
    const seedPhrase = await this.getSeed();
    await this._storeSeed(seedPhrase, newPassword, true);
  };

  hasSeed = async () => {
    const encryptedSeed = await this._commonStorageAdapter.get(SeedVaultStorageKeys.ENCRYPTED_KEY);
    return !!encryptedSeed;
  };

  isVaultUnlocked = async () => {
    const passwordHash = await this._secureStorageAdapter.get(SeedVaultStorageKeys.PASSWORD_HASH);
    return !!passwordHash;
  };

  unlockVault = async (password: string): Promise<void> => {
    const encryptedSeed = await this._commonStorageAdapter.get(SeedVaultStorageKeys.ENCRYPTED_KEY);
    const salt = await this._commonStorageAdapter.get(SeedVaultStorageKeys.PASSWORD_SALT);
    if (salt && encryptedSeed) {
      try {
        const passwordHash = await this._cryptoUtilsAdapter.hash(password, salt);
        await this._cryptoUtilsAdapter.decrypt(encryptedSeed, passwordHash as string);
        await this._secureStorageAdapter.set(SeedVaultStorageKeys.PASSWORD_HASH, passwordHash);
      } catch (err) {
        throw new Error('Wrong password');
      }
    } else {
      throw new Error('empty vault');
    }
  };

  lockVault = async () => {
    const seed = await this.getSeed();
    if (seed) {
      await this._secureStorageAdapter.set(SeedVaultStorageKeys.PASSWORD_HASH, '');
    } else {
      throw new Error('Password Hash not set');
    }
  };

  private removeVaultStorageItem = async (key: SeedVaultStorageKeys) => {
    if (key === SeedVaultStorageKeys.PASSWORD_HASH) {
      return this._secureStorageAdapter.remove(key);
    }
    return this._commonStorageAdapter.remove(key);
  };

  clearVaultStorage = async () => {
    Object.values(SeedVaultStorageKeys).forEach(async (key) => {
      await this.removeVaultStorageItem(key);
    });
  };
}

export const SeedVaultInstance = (config: SeedVaultConfig) => {
  if (!ref.current) {
    ref.current = new SeedVault(config);
  }

  return ref.current;
};

export default SeedVaultInstance;
