export type StorageAdapter = {
  get(key: string): Promise<string> | string | null;
  set(key: string, value: string): Promise<void> | void;
  remove(key: string): Promise<void> | void;
};

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

export class SeedVault {
  private readonly _secureStorageAdapter: StorageAdapter;

  private readonly _cryptoUtilsAdapter: CryptoUtilsAdapter;

  private readonly _commonStorageAdapter: StorageAdapter;

  VERSION = 1;

  constructor(config: SeedVaultConfig) {
    this._secureStorageAdapter = config.secureStorageAdapter;
    this._cryptoUtilsAdapter = config.cryptoUtilsAdapter;
    this._commonStorageAdapter = config.commonStorageAdapter;
  }

  init = async (password: string) => {
    this._commonStorageAdapter.set(SeedVaultStorageKeys.SEED_VAULT_VERSION, this.VERSION.toString());
    const salt = await this._cryptoUtilsAdapter.generateRandomBytes(32);
    if (!salt) throw new Error('Salt not set');
    const passwordHash = await this._cryptoUtilsAdapter.hash(password, salt);
    if (!passwordHash) throw new Error('Password hash not set');
    this._commonStorageAdapter.set(SeedVaultStorageKeys.PASSWORD_SALT, salt);
    this._secureStorageAdapter.set(SeedVaultStorageKeys.PASSWORD_HASH, passwordHash);
  };

  private _storeSeed = async (seed: string, overwriteExistingSeed?: boolean) => {
    const password = await this._secureStorageAdapter.get(SeedVaultStorageKeys.PASSWORD_HASH);
    if (!password) throw new Error('passwordHash not set');
    const prevStoredEncryptedSeed = await this.hasSeed();
    if (prevStoredEncryptedSeed && !overwriteExistingSeed) {
      throw new Error('Seed already set');
    }
    const encryptedSeed = await this._cryptoUtilsAdapter.encrypt(seed, password);
    if (!encryptedSeed) throw new Error('Seed not set');
    this._commonStorageAdapter.set(SeedVaultStorageKeys.ENCRYPTED_KEY, encryptedSeed);
  };

  storeSeed = async (seed: string) => this._storeSeed(seed, false);

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

  changePassword = async (oldPassword: string, newPassword: string) => {
    await this.unlockVault(oldPassword);
    const seedPhrase = await this.getSeed();
    await this.init(newPassword);
    await this._storeSeed(seedPhrase, true);
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
export default SeedVault;
