import { chromeLocalStorage, chromeSessionStorage } from '@utils/chromeStorage';
import { decryptSeedPhraseHandler, encryptSeedPhraseHandler, generateKeyArgon2id } from '@utils/encryptionUtils';
import { useEffect, useState } from 'react';
import { generateRandomKey } from '../encryption';
import SeedVault, { CryptoUtilsAdapter, StorageAdapter } from '../seedVault';

const cryptoUtilsAdapter: CryptoUtilsAdapter = {
  encrypt: encryptSeedPhraseHandler,
  decrypt: decryptSeedPhraseHandler,
  generateRandomBytes: generateRandomKey,
  hash: generateKeyArgon2id,
};

const secureStorageAdapter: StorageAdapter = {
  get: async (key: string) => chromeSessionStorage.getItem<string>(key),
  set: async (key: string, value: string) => chromeSessionStorage.setItem(key, value),
  remove: async (key: string) => chromeSessionStorage.removeItem(key),
};

const commonStorageAdapter: StorageAdapter = {
  get: async (key: string) => chromeLocalStorage.getItem<string>(key),
  set: async (key: string, value: string) => chromeLocalStorage.setItem(key, value),
  remove: async (key: string) => chromeLocalStorage.removeItem(key),
};

const seedVault = new SeedVault({
  cryptoUtilsAdapter,
  secureStorageAdapter,
  commonStorageAdapter,
});

const useSeedVaultExample = () => {
  // we can spread here since all the functions we need are instance variables and not class functions  "this" will
  // work as expected
  const [seedVaultObject, setSeedVaultObject] = useState({ ...seedVault });

  useEffect(() => {
    const onSeedVaultChange = () => {
      setSeedVaultObject({ ...seedVault });
    };
    seedVault.addChangeListener(onSeedVaultChange);

    return () => {
      seedVault.removeChangeListener(onSeedVaultChange);
    };
  }, []);

  return seedVaultObject;
};
export default useSeedVaultExample;
