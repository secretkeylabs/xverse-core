/* eslint-disable max-len */
import { base58, base64, hex } from '@scure/base';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MasterVault, VaultConfig } from '../../vaults';
import { testEntropy, testSeed, testSeedPhrase } from '../mocks/restore.mock';

describe('MasterVault', () => {
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

  it('migrates from old seed vault', async () => {
    setupMocks();

    encryptedDataStorageAdapter.set('passwordSalt', 'passwordSalt');
    encryptedDataStorageAdapter.set('encryptedKey', `correctPassword:::passwordSalt:::${hex.encode(testEntropy)}`);

    const vault = new MasterVault(config);
    expect(await vault.isInitialised()).toBe(true);
    expect(await vault.isVaultUnlocked()).toBe(false);

    await expect(() => vault.unlockVault('wrongPassword')).rejects.toThrow('Wrong password');
    await vault.unlockVault('correctPassword');

    expect(await vault.SeedVault.getWalletCount()).toBe(1);
    let walletIds = await vault.SeedVault.getWalletIds();
    let wallet = await vault.SeedVault.getWalletSecrets(walletIds[0]);

    expect(wallet).toEqual({
      derivationType: 'index',
      mnemonic: testSeedPhrase,
      seedBase58: base58.encode(testSeed),
      seedBase64: base64.encode(testSeed),
      seedHex: hex.encode(testSeed),
    });

    expect(encryptedDataStorageAdapter.remove).toHaveBeenCalledWith('passwordSalt');
    expect(encryptedDataStorageAdapter.remove).toHaveBeenCalledWith('encryptedKey');

    await vault.lockVault();
    await vault.unlockVault('correctPassword');

    expect(await vault.SeedVault.getWalletCount()).toBe(1);
    walletIds = await vault.SeedVault.getWalletIds();
    await expect(vault.SeedVault.getPrimaryWalletId()).resolves.toEqual(walletIds[0]);
    wallet = await vault.SeedVault.getWalletSecrets(walletIds[0]);

    expect(wallet).toEqual({
      derivationType: 'index',
      mnemonic: testSeedPhrase,
      seedBase58: base58.encode(testSeed),
      seedBase64: base64.encode(testSeed),
      seedHex: hex.encode(testSeed),
    });
  });

  it('halts if migration not run and new seed vault initialised', async () => {
    setupMocks();

    encryptedDataStorageAdapter.set('passwordSalt', 'passwordSalt');
    encryptedDataStorageAdapter.set('encryptedKey', `correctPassword:::passwordSalt:::${hex.encode(testEntropy)}`);
    encryptedDataStorageAdapter.set('vault::seedVault', 'correctPassword:::passwordSalt:::encryptedSeedVaultData');

    const vault = new MasterVault(config);
    expect(await vault.isInitialised()).toBe(true);
    expect(await vault.isVaultUnlocked()).toBe(false);

    await expect(() => vault.unlockVault('correctPassword')).rejects.toThrow(
      'Inconsistent state: Seed vault is already initialised',
    );
  });

  it('e2e test', async () => {
    setupMocks();

    const vault = new MasterVault(config);
    expect(await vault.isInitialised()).toBe(false);

    expect(() => vault.SeedVault).toThrow('Vault not ready');
    expect(() => vault.KeyValueVault).toThrow('Vault not ready');

    await vault.initialise('password');
    expect(await vault.isInitialised()).toBe(true);
    expect(await vault.isVaultUnlocked()).toBe(true);

    expect(() => vault.SeedVault).not.toThrow();
    expect(() => vault.KeyValueVault).not.toThrow();

    await expect(() => vault.initialise('password2')).rejects.toThrow('Vault already initialised');

    // can unlock an already unlocked vault
    await vault.unlockVault('password');

    await vault.lockVault();
    expect(await vault.isInitialised()).toBe(true);
    expect(await vault.isVaultUnlocked()).toBe(false);

    await vault.unlockVault('password');
    expect(await vault.isVaultUnlocked()).toBe(true);

    // seed vault
    expect(await vault.SeedVault.getWalletCount()).toBe(0);

    const walletId = await vault.SeedVault.storeWalletByMnemonic(testSeedPhrase, 'index');
    const wallet = await vault.SeedVault.getWalletSecrets(walletId);
    expect(wallet).toEqual({
      mnemonic: testSeedPhrase,
      derivationType: 'index',
      seedBase58: base58.encode(testSeed),
      seedBase64: base64.encode(testSeed),
      seedHex: hex.encode(testSeed),
    });

    expect(await vault.SeedVault.getWalletCount()).toBe(1);

    const seedWalletId = await vault.SeedVault.storeWalletBySeed(testSeed, 'account');
    const seedWallet = await vault.SeedVault.getWalletSecrets(seedWalletId);
    expect(seedWallet).toEqual({
      derivationType: 'account',
      seedBase58: base58.encode(testSeed),
      seedBase64: base64.encode(testSeed),
      seedHex: hex.encode(testSeed),
    });

    expect(await vault.SeedVault.getWalletCount()).toBe(2);
    expect(await vault.SeedVault.getWalletIds()).toEqual([walletId, seedWalletId]);

    await vault.SeedVault.deleteWallet(seedWalletId);
    expect(await vault.SeedVault.getWalletCount()).toBe(1);
    expect(await vault.SeedVault.getWalletIds()).toEqual([walletId]);

    await vault.lockVault();

    await expect(() => vault.SeedVault.getWalletCount()).rejects.toThrow('Vault is locked');

    await vault.unlockVault('password');
    expect(await vault.SeedVault.getWalletCount()).toBe(1);

    // key value vault
    await vault.KeyValueVault.set('addressBook::Mainnet', 'value');
    expect(await vault.KeyValueVault.get('addressBook::Mainnet')).toBe('value');
    expect(await vault.KeyValueVault.get('addressBook::Testnet4')).toBe(undefined);
    expect(await vault.KeyValueVault.getAllKeys()).toEqual(['addressBook::Mainnet']);
    await vault.KeyValueVault.set('addressBook::Mainnet', 'value2');
    expect(await vault.KeyValueVault.get('addressBook::Mainnet')).toBe('value2');

    await vault.KeyValueVault.set('addressBook::Testnet4', 'value2');
    await vault.KeyValueVault.set('addressBook::Signet', 'value3');
    await vault.KeyValueVault.set('addressBook::Regtest', 'value4');

    expect(await vault.KeyValueVault.getAllKeys()).toEqual([
      'addressBook::Mainnet',
      'addressBook::Testnet4',
      'addressBook::Signet',
      'addressBook::Regtest',
    ]);

    await vault.KeyValueVault.remove('addressBook::Mainnet');
    expect(await vault.KeyValueVault.getAllKeys()).toEqual([
      'addressBook::Testnet4',
      'addressBook::Signet',
      'addressBook::Regtest',
    ]);

    await vault.KeyValueVault.clear();
    expect(await vault.KeyValueVault.getAllKeys()).toEqual([]);

    await vault.KeyValueVault.set('addressBook::Mainnet', 'value');
    await vault.KeyValueVault.set('addressBook::Testnet4', 'value2');

    await vault.lockVault();
    await expect(() => vault.KeyValueVault.get('addressBook::Mainnet')).rejects.toThrow('Vault is locked');

    await vault.unlockVault('password');

    // with a soft lock, the key vault should still be functional
    await vault.lockVault(true);
    expect(await vault.isVaultUnlocked()).toBe(false);
    expect(await vault.KeyValueVault.get('addressBook::Mainnet')).toBe('value');

    // change password
    await vault.unlockVault('password');
    await expect(() => vault.changePassword('wrongPassword', 'password2')).rejects.toThrow('Wrong password');
    await vault.changePassword('password', 'password2');

    expect((await vault.SeedVault.getWalletSecrets(walletId)).seedBase64).toBe(base64.encode(testSeed));
    await vault.lockVault();
    await vault.unlockVault('password2');
    expect((await vault.SeedVault.getWalletSecrets(walletId)).seedBase64).toBe(base64.encode(testSeed));
    expect(await vault.KeyValueVault.get('addressBook::Mainnet')).toBe('value');
  });

  it('lockUnlockedVaultOnFailure => true, locks if unlocked and unlock attempt with incorrect password', async () => {
    setupMocks();

    const vault = new MasterVault(config);
    expect(await vault.isInitialised()).toBe(false);

    await vault.initialise('password');
    expect(await vault.isInitialised()).toBe(true);
    expect(await vault.isVaultUnlocked()).toBe(true);

    await vault.lockVault();
    expect(await vault.isInitialised()).toBe(true);
    expect(await vault.isVaultUnlocked()).toBe(false);

    await vault.unlockVault('password');
    expect(await vault.isVaultUnlocked()).toBe(true);

    await expect(() => vault.unlockVault('password2', true)).rejects.toThrow('Wrong password');
    expect(await vault.isInitialised()).toBe(true);
    expect(await vault.isVaultUnlocked()).toBe(false);
  });

  it('lockUnlockedVaultOnFailure => false, remains unlocked if unlocked and unlock attempt with incorrect password', async () => {
    setupMocks();

    const vault = new MasterVault(config);
    expect(await vault.isInitialised()).toBe(false);

    await vault.initialise('password');
    expect(await vault.isInitialised()).toBe(true);
    expect(await vault.isVaultUnlocked()).toBe(true);

    await vault.lockVault();
    expect(await vault.isInitialised()).toBe(true);
    expect(await vault.isVaultUnlocked()).toBe(false);

    await vault.unlockVault('password');
    expect(await vault.isVaultUnlocked()).toBe(true);

    await expect(() => vault.unlockVault('password2')).rejects.toThrow('Wrong password');
    expect(await vault.isInitialised()).toBe(true);
    expect(await vault.isVaultUnlocked()).toBe(true);
  });
});
