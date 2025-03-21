import { runMigrations } from './masterVaultMigrations';
import {
  hasMigrationFromOldSeedVault,
  migrateFromOldSeedVaultFromUnlocked,
  migrateFromOldSeedVaultWithPassword,
  oldSeedVaultIsUnlocked,
} from './oldSeedVaultToMaster';

export default {
  runMigrations,
  hasMigrationFromOldSeedVault,
  migrateFromOldSeedVaultFromUnlocked,
  migrateFromOldSeedVaultWithPassword,
  oldSeedVaultIsUnlocked,
};
