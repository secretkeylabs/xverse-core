/* eslint-disable max-len */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { VaultConfig } from '../../vaults';
import { StorageKeys } from '../../vaults/common';
import { EncryptionVault } from '../../vaults/encryptionVault';

describe('EncryptionVault', () => {
  const sessionStorageAdapter = {
    get: vi.fn(),
    getMany: vi.fn(),
    set: vi.fn(),
    remove: vi.fn(),
    getAllKeys: vi.fn(),
  };
  const encryptedDataStorageAdapter = {
    get: vi.fn(),
    getMany: vi.fn(),
    set: vi.fn(),
    remove: vi.fn(),
    getAllKeys: vi.fn(),
  };
  const commonStorageAdapter = {
    get: vi.fn(),
    getMany: vi.fn(),
    set: vi.fn(),
    remove: vi.fn(),
    getAllKeys: vi.fn(),
  };
  const cryptoUtilsAdapter = {
    encrypt: vi.fn(),
    decrypt: vi.fn(),
    hash: vi.fn(),
    generateRandomBytes: vi.fn(),
  };
  const config: VaultConfig = {
    sessionStorageAdapter,
    encryptedDataStorageAdapter,
    commonStorageAdapter,
    cryptoUtilsAdapter,
  };

  const encryptionVault = new EncryptionVault(config);

  function setupMocks() {
    const sessionStorage: Record<string, unknown> = {};
    sessionStorageAdapter.get.mockImplementation((key: string) => sessionStorage[key]);
    sessionStorageAdapter.set.mockImplementation((key: string, value: unknown) => {
      sessionStorage[key] = value;
    });
    sessionStorageAdapter.remove.mockImplementation((key: string) => {
      delete sessionStorage[key];
    });
    sessionStorageAdapter.getAllKeys.mockImplementation(() => Object.keys(sessionStorage));

    const encryptedDataStorage: Record<string, unknown> = {};
    encryptedDataStorageAdapter.get.mockImplementation((key: string) => encryptedDataStorage[key]);
    encryptedDataStorageAdapter.set.mockImplementation((key: string, value: unknown) => {
      encryptedDataStorage[key] = value;
    });
    encryptedDataStorageAdapter.remove.mockImplementation((key: string) => {
      delete encryptedDataStorage[key];
    });
    encryptedDataStorageAdapter.getAllKeys.mockImplementation(() => Object.keys(encryptedDataStorage));

    const commonStorage: Record<string, unknown> = {};
    commonStorageAdapter.get.mockImplementation((key: string) => commonStorage[key]);
    commonStorageAdapter.set.mockImplementation((key: string, value: unknown) => {
      commonStorage[key] = value;
    });
    commonStorageAdapter.remove.mockImplementation((key: string) => {
      delete commonStorage[key];
    });
    commonStorageAdapter.getAllKeys.mockImplementation(() => Object.keys(commonStorage));
    cryptoUtilsAdapter.encrypt.mockImplementation((data: string, hash: string) => {
      return `${hash}:::${data}`;
    });
    cryptoUtilsAdapter.decrypt.mockImplementation((data: string, hash: string) => {
      if (!data.startsWith(`${hash}:::`)) {
        throw new Error('Invalid hash');
      }
      return data.slice(`${hash}:::`.length);
    });
    cryptoUtilsAdapter.hash.mockImplementation((data: string, hashSalt: string) => {
      return `${data}:::${hashSalt}`;
    });

    let randomBytesGenerated = 0;
    cryptoUtilsAdapter.generateRandomBytes.mockImplementation((length: number) => {
      return Array.from({ length: length - 1 }, () => '0').join('') + randomBytesGenerated++;
    });
  }

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('initialises, locks, unlocks', async () => {
    setupMocks();

    await encryptionVault.initialise('UserPassword');

    expect(sessionStorageAdapter.set).toHaveBeenCalledWith(
      StorageKeys.passwordHash,
      `UserPassword:::00000000000000000000000000000003`,
    );
    expect(encryptedDataStorageAdapter.set).toHaveBeenCalledWith(
      StorageKeys.passwordSalt,
      '00000000000000000000000000000003',
    );
    expect(encryptedDataStorageAdapter.set).toHaveBeenCalledWith(
      StorageKeys.encryptionVault,
      'UserPassword:::00000000000000000000000000000003:::{"seedEncryptionKey":"00000000000000000000000000000000:::00000000000000000000000000000002","dataEncryptionKey":"00000000000000000000000000000001:::00000000000000000000000000000002"}',
    );

    let isInitialised = await encryptionVault.isInitialised();
    expect(isInitialised).toBe(true);

    let isUnlocked = await encryptionVault.isVaultUnlocked();
    expect(isUnlocked).toBe(true);

    await encryptionVault.lockVault();

    isInitialised = await encryptionVault.isInitialised();
    expect(isInitialised).toBe(true);

    // ensure data keys are removed
    expect(sessionStorageAdapter.remove).toHaveBeenCalledWith(StorageKeys.encryptionVaultDataKeys);

    isUnlocked = await encryptionVault.isVaultUnlocked();
    expect(isUnlocked).toBe(false);

    await encryptionVault.unlockVault('UserPassword', true);

    isUnlocked = await encryptionVault.isVaultUnlocked();
    expect(isUnlocked).toBe(true);
  });

  it('soft lock', async () => {
    setupMocks();

    await encryptionVault.initialise('UserPassword');

    let isUnlocked = await encryptionVault.isVaultUnlocked();
    expect(isUnlocked).toBe(true);

    const encryptedData = await encryptionVault.encrypt('testData', 'data');
    expect(encryptedData).toBe('00000000000000000000000000000001:::00000000000000000000000000000002:::"testData"');

    const decryptedData = await encryptionVault.decrypt(encryptedData, 'data');
    expect(decryptedData).toBe('testData');

    await encryptionVault.softLockVault();

    isUnlocked = await encryptionVault.isVaultUnlocked();
    expect(isUnlocked).toBe(false);

    const lockedDecryptedData = await encryptionVault.decrypt(encryptedData, 'data');
    expect(lockedDecryptedData).toBe('testData');
  });

  it('changePassword', async () => {
    setupMocks();

    await encryptionVault.initialise('UserPassword');

    let isUnlocked = await encryptionVault.isVaultUnlocked();
    expect(isUnlocked).toBe(true);

    await encryptionVault.changePassword('NewPassword');

    isUnlocked = await encryptionVault.isVaultUnlocked();
    expect(isUnlocked).toBe(true);

    await encryptionVault.lockVault();

    await expect(() => encryptionVault.unlockVault('UserPassword', true)).rejects.toThrow('Wrong password');
    await encryptionVault.unlockVault('NewPassword', true);

    isUnlocked = await encryptionVault.isVaultUnlocked();
    expect(isUnlocked).toBe(true);
  });

  it('unlock with incorrect password locks vault and throws', async () => {
    setupMocks();

    await encryptionVault.initialise('UserPassword');

    let isUnlocked = await encryptionVault.isVaultUnlocked();
    expect(isUnlocked).toBe(true);

    const encryptedData = await encryptionVault.encrypt('testData', 'data');
    expect(encryptedData).toBe('00000000000000000000000000000001:::00000000000000000000000000000002:::"testData"');

    const decryptedData = await encryptionVault.decrypt(encryptedData, 'data');
    expect(decryptedData).toBe('testData');

    await expect(() => encryptionVault.unlockVault('wrongPassword', true)).rejects.toThrow('Wrong password');

    isUnlocked = await encryptionVault.isVaultUnlocked();
    expect(isUnlocked).toBe(false);

    await expect(() => encryptionVault.decrypt(encryptedData, 'data')).rejects.toThrow('Vault is locked');
  });

  it('unlock empty vault throws', async () => {
    setupMocks();

    await expect(() => encryptionVault.unlockVault('password', true)).rejects.toThrow('Empty vault');
  });

  it('initialise intialised vault throws', async () => {
    setupMocks();

    await encryptionVault.initialise('UserPassword');

    await expect(() => encryptionVault.initialise('password')).rejects.toThrow('Vault already initialised');
  });
});
