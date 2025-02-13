import { StorageAdapter } from '../types';

export type CryptoUtilsAdapter = {
  encrypt(data: string, passwordHash: string): Promise<string>;
  decrypt(data: string, passwordHash: string): Promise<string>;
  hash(data: string, salt: string): Promise<string>;
  generateRandomBytes(length: number): string | Promise<string>;
};

export type VaultConfig = {
  secureStorageAdapter: StorageAdapter;
  cryptoUtilsAdapter: CryptoUtilsAdapter;
  commonStorageAdapter: StorageAdapter;
};
