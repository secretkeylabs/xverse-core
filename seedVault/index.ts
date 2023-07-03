
export interface SecureStorageAdapter {
  get(key: string): Promise<string>;
  set(key: string, value: string): Promise<void>;
}

export interface CryptoUtilsAdapter  {
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

class SeedVault {
  private secureStorageAdapter: SecureStorageAdapter;

  private cryptoUtilsAdapter: CryptoUtilsAdapter;

  private commonStorageAdapter: CommonStorageAdapter;

  constructor(config: SeedVaultConfig) {
    this.secureStorageAdapter = config.storageAdapter;
    this.cryptoUtilsAdapter = config.cryptoUtilsAdapter;
    this.commonStorageAdapter = config.commonStorageAdapter;
  }

  async init(passphrase: string) {
    const salt = this.cryptoUtilsAdapter.generateRandomBytes(32);
    const passwordHash = await this.cryptoUtilsAdapter.hash(passphrase, salt);
    this.commonStorageAdapter.set('salt', salt);
    this.secureStorageAdapter.set('passwordHash', passwordHash);
  }

  async storeSeed(seed: string) {
    const passphrase = await this.secureStorageAdapter.get('passphrase');
    const encryptedSeed = await this.cryptoUtilsAdapter.encrypt(seed, passphrase);
    this.secureStorageAdapter.set('seed', encryptedSeed);
  }

  async getSeed() {
    const passphrase = await this.secureStorageAdapter.get('passphrase');
    if (!passphrase) throw new Error('Passphrase not set');
    const encryptedSeed = await this.secureStorageAdapter.get('seed');
    const seed = await this.cryptoUtilsAdapter.decrypt(encryptedSeed, passphrase);
    if (!seed) throw new Error('Wrong passphrase');
    return seed;
  }
}
export default SeedVault;
