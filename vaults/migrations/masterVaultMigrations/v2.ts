import { VaultConfig } from '../../types';

const V1StorageKeys = {
  vaultVersion: 'vault::version',

  passwordHash: 'vault::passwordHash',
  passwordSalt: 'vault::passwordSalt',

  encryptionVault: 'vault::encryptionVault',
  encryptionVaultDataKeys: 'vault::encryptionVault::dataKeys',

  seedVault: 'vault::seedVault',
  keyValueVaultPrefix: 'vault::keyValueVault',
};

const BACKUP_ENCRYPTED_KEYS_KEY = 'vault::backup::toV2';

export const preMigrationRestoreAndBackup = async (config: VaultConfig) => {
  const previousPreMigrationBackup = await config.encryptedDataStorageAdapter.get(BACKUP_ENCRYPTED_KEYS_KEY);
  if (previousPreMigrationBackup) {
    // pre-migration backup already exists, just restore data to previous version and continue
    await config.encryptedDataStorageAdapter.set(V1StorageKeys.encryptionVault, previousPreMigrationBackup);
    return;
  }

  // we backup v1 data before running migrations in case something goes wrong
  const encryptedKeys = await config.encryptedDataStorageAdapter.get(V1StorageKeys.encryptionVault);
  if (!encryptedKeys) {
    throw new Error('Encryption vault not initialised.');
  }

  await config.encryptedDataStorageAdapter.set(BACKUP_ENCRYPTED_KEYS_KEY, encryptedKeys);
};

export const cleanupPreMigrationBackup = async (config: VaultConfig) => {
  await config.encryptedDataStorageAdapter.remove(BACKUP_ENCRYPTED_KEYS_KEY);
};

type V1EncryptionVaultData = {
  seedEncryptionKey: string;
  dataEncryptionKey: string;
  dataSalt: string;
};

const getEncryptionKeys = async (config: VaultConfig): Promise<V1EncryptionVaultData> => {
  const encryptedKeys = await config.encryptedDataStorageAdapter.get(V1StorageKeys.encryptionVault);
  if (!encryptedKeys) {
    throw new Error('Encryption vault not initialised.');
  }

  const passwordHash = await config.sessionStorageAdapter.get(V1StorageKeys.passwordHash);
  if (!passwordHash) {
    throw new Error('Vault is locked.');
  }

  const decryptedKeys = await config.cryptoUtilsAdapter.decrypt(encryptedKeys, passwordHash);
  if (!decryptedKeys) {
    throw new Error('Wrong password');
  }

  const encryptionKeyData = JSON.parse(decryptedKeys) as V1EncryptionVaultData;

  if (
    !encryptionKeyData ||
    !encryptionKeyData.seedEncryptionKey ||
    !encryptionKeyData.dataEncryptionKey ||
    !encryptionKeyData.dataSalt
  ) {
    throw new Error('Invalid encryption keys');
  }
  return encryptionKeyData;
};

type V2EncryptionVaultData = {
  seedEncryptionKey: string;
  dataEncryptionKey: string;
};

const saveV2EncryptionKeys = async (config: VaultConfig, v2EncryptionKeys: V2EncryptionVaultData) => {
  const passwordHash = await config.sessionStorageAdapter.get(V1StorageKeys.passwordHash);
  if (!passwordHash) {
    throw new Error('Vault is locked.');
  }

  const serialisedData = JSON.stringify(v2EncryptionKeys);
  const encryptedKeys = await config.cryptoUtilsAdapter.encrypt(serialisedData, passwordHash);
  if (!encryptedKeys) throw new Error('Key encryption failed');

  await config.encryptedDataStorageAdapter.set(V1StorageKeys.encryptionVault, encryptedKeys);
};

export const migrate = async (config: VaultConfig) => {
  const v1EncryptionKeys = await getEncryptionKeys(config);

  const seedEncryptionKey = await config.cryptoUtilsAdapter.hash(
    v1EncryptionKeys.seedEncryptionKey,
    v1EncryptionKeys.dataSalt,
  );

  const dataEncryptionKey = await config.cryptoUtilsAdapter.hash(
    v1EncryptionKeys.dataEncryptionKey,
    v1EncryptionKeys.dataSalt,
  );

  const v2EncryptionKeys = {
    seedEncryptionKey,
    dataEncryptionKey,
  };

  await saveV2EncryptionKeys(config, v2EncryptionKeys);
};
