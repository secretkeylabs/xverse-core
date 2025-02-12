import { hex } from '@scure/base';
import * as bip39 from '@scure/bip39';
import { wordlist } from '@scure/bip39/wordlists/english';
import { EncryptionVault } from './encryptionVault';
import { MasterVault } from './masterVault';
import { SeedVault } from './seedVault';
import { VaultConfig } from './types';

enum OldSeedVaultStorageKeys {
  PASSWORD_HASH = 'passwordHash',
  PASSWORD_SALT = 'passwordSalt',
  ENCRYPTED_KEY = 'encryptedKey',
  SEED_VAULT_VERSION = 'seedVaultVersion',
}

const hasMigrationFromOldSeedVault = async (config: VaultConfig): Promise<boolean> => {
  // Check if this wallet is still using the old seed vault
  const passwordSalt = await config.commonStorageAdapter.get(OldSeedVaultStorageKeys.PASSWORD_SALT);
  const encryptedSeedPhrase = await config.commonStorageAdapter.get(OldSeedVaultStorageKeys.ENCRYPTED_KEY);

  if (passwordSalt && encryptedSeedPhrase) {
    return true;
  }

  return false;
};

export const migrateFromOldSeedVault = async (
  masterVault: MasterVault,
  initialiseMasterVault: (password: string) => Promise<void>,
  encryptionVault: EncryptionVault,
  seedVault: SeedVault,
  config: VaultConfig,
  password: string,
) => {
  // Check if this wallet is still using the old seed vault. If so, migrate it to the master vault.
  const passwordSalt = await config.commonStorageAdapter.get(OldSeedVaultStorageKeys.PASSWORD_SALT);
  const encryptedEntropy = await config.commonStorageAdapter.get(OldSeedVaultStorageKeys.ENCRYPTED_KEY);

  if (passwordSalt && encryptedEntropy) {
    let mnemonic: string;
    try {
      const passwordHash = await config.cryptoUtilsAdapter.hash(password, passwordSalt);
      const decryptedEntropy = await config.cryptoUtilsAdapter.decrypt(encryptedEntropy, passwordHash as string);
      mnemonic = bip39.entropyToMnemonic(hex.decode(decryptedEntropy), wordlist);
    } catch (err) {
      throw new Error('Wrong password');
    }

    if (await seedVault.isInitialised()) {
      try {
        await encryptionVault.unlockVault(password);
      } catch {
        throw new Error('Inconsistent state: Seed vault is already initialised');
      }

      const walletIds = await seedVault.getWalletIds();
      if (walletIds.length > 0) {
        if (walletIds.length > 1) {
          throw new Error('Inconsistent state: Multiple migrated wallets found');
        }

        const wallet = await seedVault.getWalletSecrets(walletIds[0]);
        if (!wallet?.mnemonic || wallet.mnemonic !== mnemonic) {
          throw new Error('Inconsistent state: Other wallet found in new seed vault');
        }
      }
    }

    try {
      // if we get here with no errors, then the password is correct and we can continue with migration
      await masterVault.reset();
      await initialiseMasterVault(password);
      const migratedWalletId = await seedVault.storeWalletByMnemonic(mnemonic, 'index');

      // ensure migration succeeded
      await encryptionVault.lockVault();
      await encryptionVault.unlockVault(password);
      const wallet = await seedVault.getWalletSecrets(migratedWalletId);
      if (!wallet?.mnemonic || wallet.mnemonic !== mnemonic) {
        throw new Error('Migration failed');
      }
    } catch (err) {
      await masterVault.reset();
      throw new Error('Migration failed');
    }

    // remove old seed vault data
    await config.commonStorageAdapter.remove(OldSeedVaultStorageKeys.PASSWORD_SALT);
    await config.commonStorageAdapter.remove(OldSeedVaultStorageKeys.ENCRYPTED_KEY);
    await config.commonStorageAdapter.remove(OldSeedVaultStorageKeys.SEED_VAULT_VERSION);
  }
};

const runMigrations = async () => {
  // !NOTE: Any future migrations of the master vault should go here
};

export default { runMigrations, hasMigrationFromOldSeedVault, migrateFromOldSeedVault };
