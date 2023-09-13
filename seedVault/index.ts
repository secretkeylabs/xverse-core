export type StorageAdapter = {
  get(key: string): Promise<string> | string | null;
  set(key: string, value: string): Promise<void> | void;
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

class SeedVault {
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

  storeSeed = async (seed: string) => {
    const password = await this._secureStorageAdapter.get(SeedVaultStorageKeys.PASSWORD_HASH);
    if (!password) throw new Error('passwordHash not set');
    const encryptedSeed = await this._cryptoUtilsAdapter.encrypt(seed, password);
    if (!encryptedSeed) throw new Error('Seed not set');
    this._commonStorageAdapter.set(SeedVaultStorageKeys.ENCRYPTED_KEY, encryptedSeed);
  };

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
    const seedPhrase = await this.unlockVault(oldPassword);
    await this.init(newPassword);
    await this.storeSeed(seedPhrase);
  };

  hasSeed = async () => {
    const encryptedSeed = await this._commonStorageAdapter.get(SeedVaultStorageKeys.ENCRYPTED_KEY);
    return !!encryptedSeed;
  };

  unlockVault = async (password: string): Promise<string> => {
    try {
      const encryptedSeed = await this._commonStorageAdapter.get(SeedVaultStorageKeys.ENCRYPTED_KEY);
      const salt = await this._commonStorageAdapter.get(SeedVaultStorageKeys.PASSWORD_SALT);
      if (salt && encryptedSeed) {
        const passwordHash = await this._cryptoUtilsAdapter.hash(password, salt);
        const seedPhrase = await this._cryptoUtilsAdapter.decrypt(encryptedSeed, passwordHash as string);
        await this._secureStorageAdapter.set(SeedVaultStorageKeys.PASSWORD_HASH, passwordHash);
        return seedPhrase;
      } else {
        throw new Error('empty vault');
      }
    } catch (err) {
      if (err.message === 'empty vault') {
        throw err;
      }
      throw new Error('Wrong password');
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
}
export default SeedVault;
