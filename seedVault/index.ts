export interface SecureStorageAdapter {
  get(key: string): Promise<string>;
  set(key: string, value: string): Promise<void>;
}

export interface CryptoUtilsAdapter {
  encrypt(data: string, passphrase: string): Promise<string>;
  decrypt(data: string, passphrase: string): Promise<string>;
  hash(data: string, salt: string): Promise<string>;
  generateRandomBytes(length: number): string;
}

export interface CommonStorageAdapter {
  get(key: string): Promise<string> | string | null;
  set(key: string, value: string): Promise<void> | void;
}

interface SeedVaultConfig {
  storageAdapter: SecureStorageAdapter;
  cryptoUtilsAdapter: CryptoUtilsAdapter;
  commonStorageAdapter: CommonStorageAdapter;
}

export enum SeedVaultStorageKeys {
  PASSWORD_HASH = 'passwordHash',
  PASSWORD_SALT = 'passwordSalt',
  ENCRYPTED_KEY = 'encryptedKey',
}

class SeedVault {
  private readonly _secureStorageAdapter: SecureStorageAdapter;

  private readonly _cryptoUtilsAdapter: CryptoUtilsAdapter;

  private readonly _commonStorageAdapter: CommonStorageAdapter;

  constructor(config: SeedVaultConfig) {
    this._secureStorageAdapter = config.storageAdapter;
    this._cryptoUtilsAdapter = config.cryptoUtilsAdapter;
    this._commonStorageAdapter = config.commonStorageAdapter;
  }

  init = async (passphrase: string) => {
    const salt = this._cryptoUtilsAdapter.generateRandomBytes(32);
    if (!salt) throw new Error('Salt not set');
    const passwordHash = await this._cryptoUtilsAdapter.hash(passphrase, salt);
    if (!passwordHash) throw new Error('Password hash not set');
    this._commonStorageAdapter.set(SeedVaultStorageKeys.PASSWORD_SALT, salt);
    this._secureStorageAdapter.set(SeedVaultStorageKeys.PASSWORD_HASH, passwordHash);
  };

  storeSeed = async (seed: string) => {
    const passphrase = await this._secureStorageAdapter.get(SeedVaultStorageKeys.PASSWORD_HASH);
    if (!passphrase) throw new Error('passwordHash not set');
    const encryptedSeed = await this._cryptoUtilsAdapter.encrypt(seed, passphrase);
    if (!encryptedSeed) throw new Error('Seed not set');
    this._commonStorageAdapter.set(SeedVaultStorageKeys.ENCRYPTED_KEY, encryptedSeed);
  };

  getSeed = async (password: string) => {
    let passwordHash = await this._secureStorageAdapter.get(SeedVaultStorageKeys.PASSWORD_HASH);
    if (!passwordHash) {
      const salt = await this._commonStorageAdapter.get('salt');
      if (salt) passwordHash = await this._cryptoUtilsAdapter.hash(password, salt);
    }
    const encryptedSeed = await this._commonStorageAdapter.get(SeedVaultStorageKeys.ENCRYPTED_KEY);
    if (!encryptedSeed) throw new Error('Seed not set');
    const seed = await this._cryptoUtilsAdapter.decrypt(encryptedSeed, passwordHash);
    if (!seed) throw new Error('Wrong passphrase');
    return seed;
  };

  lockVault = async (passPhrase: string) => {
    const seed = await this.getSeed(passPhrase);
    if (seed) {
      await this._secureStorageAdapter.set(SeedVaultStorageKeys.PASSWORD_HASH, '');
    }
  };
}
export default SeedVault;
export * from './encryptionUtils';
