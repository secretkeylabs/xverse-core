import { Mutex } from 'async-mutex';
import { StorageKeys } from './common';
import { EncryptionVault } from './encryptionVault';
import { KeyValueVault } from './keyValueVault';
import migrationController from './migrations';
import { SeedVault } from './seedVault';
import { VaultConfig } from './types';

export class MasterVault {
  private readonly config: VaultConfig;

  private readonly encryptionVault: EncryptionVault;

  private readonly seedVault: SeedVault;

  private readonly keyValueVault: KeyValueVault;

  private readonly migrationMutex = new Mutex();

  private readonly unlockMutex = new Mutex();

  private migrationsRan = false;

  static readonly Version = 1;

  get SeedVault() {
    if (!this.migrationsRan) {
      throw new Error(
        'Vault not ready. Please unlock the vault or run `masterVault.restoreVault()` before continuing.',
      );
    }

    return this.seedVault;
  }

  get KeyValueVault() {
    if (!this.migrationsRan) {
      throw new Error(
        'Vault not ready. Please unlock the vault or run `masterVault.restoreVault()` before continuing.',
      );
    }

    return this.keyValueVault;
  }

  constructor(config: VaultConfig) {
    this.config = config;
    this.encryptionVault = new EncryptionVault(config);
    this.seedVault = new SeedVault(config, this.encryptionVault);
    this.keyValueVault = new KeyValueVault(config, this.encryptionVault);
  }

  private migrate = async () => {
    await this.migrationMutex.waitForUnlock();

    if (this.migrationsRan) {
      return;
    }

    await this.migrationMutex.runExclusive(async () => {
      await migrationController.runMigrations();
      this.migrationsRan = true;
    });
  };

  private initialiseInternal = async (password: string) => {
    await this.encryptionVault.initialise(password);
    await this.config.encryptedDataStorageAdapter.set(StorageKeys.vaultVersion, MasterVault.Version.toString());
  };

  private initialiseInternalWithHashAndSalt = async (passwordHash: string, salt: string) => {
    await this.encryptionVault.initialiseWithHashAndSalt(passwordHash, salt);
    await this.config.encryptedDataStorageAdapter.set(StorageKeys.vaultVersion, MasterVault.Version.toString());
  };

  restoreVault = async () => {
    if (await migrationController.hasMigrationFromOldSeedVault(this.config)) {
      if (await migrationController.oldSeedVaultIsUnlocked(this.config)) {
        await migrationController.migrateFromOldSeedVaultFromUnlocked(
          this,
          this.initialiseInternalWithHashAndSalt,
          this.encryptionVault,
          this.seedVault,
          this.config,
        );
        await this.migrate();
      }
      return;
    }

    if (!(await this.isVaultUnlocked())) {
      return;
    }

    await this.migrate();
  };

  isInitialised = async () => {
    const hasOldSeedVault = await migrationController.hasMigrationFromOldSeedVault(this.config);
    if (hasOldSeedVault) {
      // migration from old seed vault needs to be run implying that the vault exists, so it must be initialised
      return true;
    }

    const inscriptionVaultIsPopulated = await this.encryptionVault.isInitialised();
    return inscriptionVaultIsPopulated;
  };

  initialise = async (password: string) => {
    if (await this.isInitialised()) {
      throw new Error('Vault already initialised');
    }

    await this.initialiseInternal(password);

    // new vault, no need to migrate
    this.migrationsRan = true;
  };

  changePassword = async (oldPassword: string, newPassword: string) => {
    await this.unlockVault(oldPassword);
    await this.encryptionVault.changePassword(newPassword);
  };

  /**
   * Attempts to unlock the vault with the given password. If the vault is already unlocked,
   * the password is checked to ensure it is correct.
   * @param password - the password to use to unlock the vault
   * @param lockUnlockedVaultOnFailure - if true, the vault will be locked if the password is incorrect and the vault
   * was unlocked. If false, an unlocked vault will remain unlocked. (default: false)
   */
  unlockVault = async (password: string, lockUnlockedVaultOnFailure = false): Promise<void> => {
    await this.unlockMutex.waitForUnlock();

    if (await this.isVaultUnlocked()) {
      // Vault already unlocked. Ensure given password is correct
      await this.encryptionVault.unlockVault(password, lockUnlockedVaultOnFailure);
      return;
    }

    await this.unlockMutex.runExclusive(async () => {
      if (await migrationController.hasMigrationFromOldSeedVault(this.config)) {
        await migrationController.migrateFromOldSeedVaultWithPassword(
          this,
          this.initialiseInternal,
          this.encryptionVault,
          this.seedVault,
          this.config,
          password,
        );
      }

      await this.encryptionVault.unlockVault(password, lockUnlockedVaultOnFailure);
      await this.migrate();
    });
  };

  lockVault = async (softLock = false) =>
    softLock ? this.encryptionVault.softLockVault() : this.encryptionVault.lockVault();

  isVaultUnlocked = async () => this.encryptionVault.isVaultUnlocked();

  reset = async () => {
    for (const key of Object.values(StorageKeys)) {
      await this.config.encryptedDataStorageAdapter.remove(key);
      await this.config.sessionStorageAdapter.remove(key);
    }

    await this.keyValueVault.clear();
  };
}
