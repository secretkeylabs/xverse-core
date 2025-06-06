import { StorageKeys } from '../../common';
import { MasterVault } from '../../masterVault';
import { VaultConfig } from '../../types';
import {
  cleanupPreMigrationBackup as v2Cleanup,
  migrate as v2Migrate,
  preMigrationRestoreAndBackup as v2PreMigrate,
} from './v2';

const migrations: Record<
  number,
  {
    preMigrate: (config: VaultConfig) => Promise<void>;
    migrate: (config: VaultConfig) => Promise<void>;
    cleanup: (config: VaultConfig) => Promise<void>;
  }
> = {
  2: {
    preMigrate: v2PreMigrate,
    migrate: v2Migrate,
    cleanup: v2Cleanup,
  },
};

export const runMigrations = async (config: VaultConfig) => {
  const currentVersion = await config.encryptedDataStorageAdapter.get(StorageKeys.vaultVersion);
  if (!currentVersion) {
    // No version, so this is a new vault. No migrations to run.
    return;
  }

  const parsedVersion = parseInt(currentVersion, 10);
  if (isNaN(parsedVersion)) {
    throw new Error(`Unsupported vault version: ${currentVersion}`);
  }

  if (parsedVersion > MasterVault.Version) {
    throw new Error(`Current vault version is newer than supported: ${currentVersion}`);
  }

  if (parsedVersion === MasterVault.Version) {
    return;
  }

  for (let i = parsedVersion + 1; i <= MasterVault.Version; i++) {
    if (!migrations[i]) {
      throw new Error(`No migration available for version ${i}`);
    }

    // run pre migrate to add any backup data in case migration fails somehow, or recover from failed migration
    await migrations[i].preMigrate(config);
    // do migrations
    await migrations[i].migrate(config);
    await config.encryptedDataStorageAdapter.set(StorageKeys.vaultVersion, i.toString());
    // cleanup backup data
    await migrations[i].cleanup(config);
  }
};
