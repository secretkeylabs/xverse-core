import { StorageAdapter } from '../types';

export type CryptoUtilsAdapter = {
  encrypt(data: string, passwordHash: string): Promise<string>;
  decrypt(data: string, passwordHash: string): Promise<string>;
  hash(data: string, salt: string): Promise<string>;
  generateRandomBytes(length: number): string | Promise<string>;
};

export type VaultConfig = {
  cryptoUtilsAdapter: CryptoUtilsAdapter;
  /** Used to store the password hash for the session */
  sessionStorageAdapter: StorageAdapter;
  /** Used to store sensitive encrypted data (encryption keys, seed phrases, etc.) */
  encryptedDataStorageAdapter: StorageAdapter;
  /** Used to store general data that may or may not be encrypted (e.g. key value vault data) */
  commonStorageAdapter: StorageAdapter;
};
