import { base58, base64, hex } from '@scure/base';
import * as bip32 from '@scure/bip32';
import * as bip39 from '@scure/bip39';
import { wordlist } from '@scure/bip39/wordlists/english';
import { Mutex } from 'async-mutex';
import { StorageAdapter } from '../../types';
import { StorageKeys } from '../common';
import { EncryptionVault } from '../encryptionVault';
import { VaultConfig } from '../types';
import { DerivationType, WalletId } from './types';

type BaseWallet = {
  keyType: 'mnemonic' | 'seed';
  derivationType: DerivationType;
};

type MnemonicWallet = BaseWallet & {
  keyType: 'mnemonic';
  mnemonic: string;
};

type SeedWallet = BaseWallet & {
  keyType: 'seed';
  seedBase64: string;
};

type Wallet = MnemonicWallet | SeedWallet;

type VaultDataType = {
  version: number;
  wallets: { [key: WalletId]: Wallet };

  /**  The first software wallet created will be marked as primary. This wallet will not be deletable. */
  primaryWalletId: WalletId;
};

/** This should not be used directly. Seed Vault should only be constructed via a MasterVault. */
export class SeedVault {
  private readonly encryptedDataStorageAdapter: StorageAdapter;

  private readonly encryptionVault: EncryptionVault;

  private readonly storeSeedMutex = new Mutex();

  private readonly Version = 1;

  private migrationsHaveRun = false;

  private migrationMutex = new Mutex();

  constructor(config: VaultConfig, encryptionVault: EncryptionVault) {
    this.encryptedDataStorageAdapter = config.encryptedDataStorageAdapter;
    this.encryptionVault = encryptionVault;
  }

  private getVaultData = async (): Promise<VaultDataType | undefined> => {
    await this.migrationMutex.waitForUnlock();

    const encryptedData = await this.encryptedDataStorageAdapter.get(StorageKeys.seedVault);
    if (!encryptedData) {
      return undefined;
    }

    const data = await this.encryptionVault.decrypt<VaultDataType>(encryptedData, 'seed');

    if (this.migrationsHaveRun) {
      return data;
    }

    return this.migrationMutex.runExclusive(async () => {
      const migratedData = data;
      // !NOTE: Any future migrations of the vault should go here
      // TODO: const migratedData = await this.runMigrations(data);
      // TODO: await this.encryptionVault.setValue<VaultDataType>(StorageKeys.seedVault, migratedData, 'seed');

      this.migrationsHaveRun = true;

      return migratedData;
    });
  };

  private getWallet = async (id: WalletId): Promise<Wallet> => {
    const vaultData = await this.getVaultData();

    const wallet = vaultData?.wallets[id];

    if (!wallet) {
      throw new Error('Wallet not found');
    }

    return wallet;
  };

  private setStoreWrapper = async (callback: (store: { [key: WalletId]: Wallet }) => { [key: WalletId]: Wallet }) => {
    await this.storeSeedMutex.runExclusive(async () => {
      const store = (await this.getVaultData()) ?? {
        version: this.Version,
        wallets: {},
        primaryWalletId: '' as WalletId,
      };
      store.wallets = callback(store.wallets);

      if (!store.primaryWalletId && Object.keys(store.wallets).length > 0) {
        store.primaryWalletId = Object.keys(store.wallets)[0] as WalletId;
      }

      if (store.primaryWalletId && !store.wallets[store.primaryWalletId]) {
        throw new Error('Cannot delete primary wallet');
      }

      const encryptedValue = await this.encryptionVault.encrypt<VaultDataType>(store, 'seed');
      await this.encryptedDataStorageAdapter.set(StorageKeys.seedVault, encryptedValue);
    });
  };

  private tryDecodeSeed = (seed: Uint8Array | string): Uint8Array => {
    let seedBuffer: Uint8Array;
    if (typeof seed === 'string') {
      try {
        seedBuffer = hex.decode(seed);
      } catch {
        // if the seed is not hex, try base58
        try {
          seedBuffer = base58.decode(seed);
        } catch {
          // if the seed is not base58, try hex
          try {
            seedBuffer = hex.decode(seed);
          } catch {
            throw new Error('Invalid seed provided');
          }
        }
      }
      seedBuffer = base64.decode(seed);
    } else {
      seedBuffer = seed;
    }

    return seedBuffer;
  };

  isInitialised = async () => {
    const value = await this.encryptedDataStorageAdapter.get(StorageKeys.seedVault);
    return !!value;
  };

  storeWalletByMnemonic = async (mnemonic: string, derivationType: DerivationType): Promise<WalletId> => {
    const isValid = await bip39.validateMnemonic(mnemonic, wordlist);
    if (!isValid) {
      throw new Error('Invalid mnemonic');
    }

    const newWalletId = crypto.randomUUID() as WalletId;
    const walletData: Wallet = {
      keyType: 'mnemonic',
      mnemonic,
      derivationType,
    };
    await this.setStoreWrapper((store) => ({ ...store, [newWalletId]: walletData }));

    return newWalletId;
  };

  storeWalletBySeed = async (seed: Uint8Array | string, derivationType: DerivationType): Promise<WalletId> => {
    const newWalletId = crypto.randomUUID() as WalletId;

    const seedBuffer = this.tryDecodeSeed(seed);
    const seedBase64 = base64.encode(seedBuffer);

    const walletData: Wallet = {
      keyType: 'seed',
      seedBase64,
      derivationType,
    };

    await this.setStoreWrapper((store) => ({ ...store, [newWalletId]: walletData }));

    return newWalletId;
  };

  /**
   * This function should only be used to show the user their seed or mnemonic. It should not be used to derive keys.
   * For deriving keys, use the getWalletRootNode function.
   */
  getWalletSecrets = async (
    id: WalletId,
  ): Promise<{
    mnemonic?: string;
    seedHex: string;
    seedBase58: string;
    seedBase64: string;
    derivationType: DerivationType;
  }> => {
    const wallet = await this.getWallet(id);

    if (wallet.keyType === 'seed') {
      const { seedBase64, derivationType } = wallet;
      const seedBuffer = base64.decode(seedBase64);
      const seedBase58 = base58.encode(seedBuffer);
      const seedHex = hex.encode(seedBuffer);

      return {
        derivationType,
        seedHex,
        seedBase58,
        seedBase64,
      };
    }

    if (wallet.keyType === 'mnemonic') {
      const { mnemonic, derivationType } = wallet;
      const seedBuffer = await bip39.mnemonicToSeed(mnemonic);
      const seedBase64 = base64.encode(seedBuffer);
      const seedBase58 = base58.encode(seedBuffer);
      const seedHex = hex.encode(seedBuffer);
      return {
        derivationType,
        mnemonic,
        seedHex,
        seedBase58,
        seedBase64,
      };
    }

    throw new Error('Unrecognised wallet keyType');
  };

  getWalletRootNode = async (id: WalletId): Promise<{ rootNode: bip32.HDKey; derivationType: DerivationType }> => {
    const wallet = await this.getWallet(id);

    if (wallet.keyType === 'seed') {
      const rootNode = bip32.HDKey.fromMasterSeed(base64.decode(wallet.seedBase64));
      return { rootNode, derivationType: wallet.derivationType };
    }

    if (wallet.keyType === 'mnemonic') {
      const seed = await bip39.mnemonicToSeed(wallet.mnemonic);
      const rootNode = bip32.HDKey.fromMasterSeed(seed);
      return { rootNode, derivationType: wallet.derivationType };
    }

    throw new Error('Unrecognised wallet keyType');
  };

  getWalletCount = async () => {
    const vaultData = await this.getVaultData();

    if (!vaultData?.wallets) {
      return 0;
    }

    return Object.values(vaultData.wallets).length;
  };

  getWalletIds = async () => {
    const vaultData = await this.getVaultData();

    return Object.keys(vaultData?.wallets ?? {}) as WalletId[];
  };

  getPrimaryWalletId = async () => {
    const vaultData = await this.getVaultData();

    return vaultData?.primaryWalletId;
  };

  deleteWallet = async (id: WalletId) => {
    await this.setStoreWrapper((store) => {
      delete store[id];
      return store;
    });
  };
}
