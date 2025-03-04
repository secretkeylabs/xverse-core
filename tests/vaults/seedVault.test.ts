/* eslint-disable max-len */
import { base58, base64, hex } from '@scure/base';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { VaultConfig, WalletId } from '../../vaults';
import { EncryptionVault } from '../../vaults/encryptionVault';
import { SeedVault } from '../../vaults/seedVault';
import { testRootNode, testSeed, testSeedPhrase } from '../mocks/restore.mock';

describe('SeedVault', () => {
  const sessionStorageAdapter = {
    get: vi.fn(),
    set: vi.fn(),
    remove: vi.fn(),
    getAllKeys: vi.fn(),
  };
  const encryptedDataStorageAdapter = {
    get: vi.fn(),
    set: vi.fn(),
    remove: vi.fn(),
    getAllKeys: vi.fn(),
  };
  const commonStorageAdapter = {
    get: vi.fn(),
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
    cryptoUtilsAdapter,
    sessionStorageAdapter,
    encryptedDataStorageAdapter,
    commonStorageAdapter,
  };

  const encryptionVaultMock = {
    decrypt: vi.fn(),
    encrypt: vi.fn(),
  };
  const encryptionVault = encryptionVaultMock as unknown as EncryptionVault;

  function setupMocks() {
    const encryptedDataStorage: Record<string, unknown> = {};
    encryptedDataStorageAdapter.get.mockImplementation((key: string) => encryptedDataStorage[key]);
    encryptedDataStorageAdapter.set.mockImplementation((key: string, value: unknown) => {
      encryptedDataStorage[key] = value;
    });
    encryptedDataStorageAdapter.remove.mockImplementation((key: string) => {
      delete encryptedDataStorage[key];
    });
    encryptedDataStorageAdapter.getAllKeys.mockImplementation(() => Object.keys(encryptedDataStorage));

    encryptionVaultMock.encrypt.mockImplementation(async (data: unknown) => {
      const encrypted = JSON.stringify(data);
      return encrypted;
    });
    encryptionVaultMock.decrypt.mockImplementation(async (data: string) => {
      const decrypted = JSON.parse(data);
      return decrypted;
    });
  }

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('can store and get mnemonic wallet', async () => {
    setupMocks();

    const seedVault = new SeedVault(config, encryptionVault);

    let isInitialised = await seedVault.isInitialised();
    expect(isInitialised).toBe(false);

    const walletId = await seedVault.storeWalletByMnemonic(testSeedPhrase, 'index');

    expect(encryptionVaultMock.encrypt).toHaveBeenCalledTimes(1);
    expect(encryptedDataStorageAdapter.set).toHaveBeenCalledTimes(1);
    expect(encryptedDataStorageAdapter.set).toHaveBeenCalledWith(
      'vault::seedVault',
      `{"version":1,"wallets":{"${walletId}":{"keyType":"mnemonic","mnemonic":"${testSeedPhrase}","derivationType":"index"}},"primaryWalletId":"${walletId}"}`,
    );

    const walletSecrets = await seedVault.getWalletSecrets(walletId);
    expect(walletSecrets.mnemonic).toBe(testSeedPhrase);
    expect(walletSecrets.seedHex).toEqual(hex.encode(testSeed));
    expect(walletSecrets.seedBase58).toEqual(base58.encode(testSeed));
    expect(walletSecrets.seedBase64).toEqual(base64.encode(testSeed));

    isInitialised = await seedVault.isInitialised();
    expect(isInitialised).toBe(true);

    const { rootNode, derivationType } = await seedVault.getWalletRootNode(walletId);
    expect(derivationType).toEqual('index');
    expect(rootNode).toEqual(testRootNode);
  });

  it('throws on invalid mnemonic', async () => {
    setupMocks();

    const seedVault = new SeedVault(config, encryptionVault);
    await expect(() => seedVault.storeWalletByMnemonic('invalid mnemonic', 'index')).rejects.toThrow(
      'Invalid mnemonic',
    );
  });

  it('can store and get seed wallet', async () => {
    setupMocks();

    const seedVault = new SeedVault(config, encryptionVault);

    let isInitialised = await seedVault.isInitialised();
    expect(isInitialised).toBe(false);

    const walletId = await seedVault.storeWalletBySeed(testSeed, 'index');

    expect(encryptionVaultMock.encrypt).toHaveBeenCalledTimes(1);
    expect(encryptedDataStorageAdapter.set).toHaveBeenCalledTimes(1);
    expect(encryptedDataStorageAdapter.set).toHaveBeenCalledWith(
      'vault::seedVault',
      `{"version":1,"wallets":{"${walletId}":{"keyType":"seed","seedBase64":"${base64.encode(
        testSeed,
      )}","derivationType":"index"}},"primaryWalletId":"${walletId}"}`,
    );

    const walletSecrets = await seedVault.getWalletSecrets(walletId);
    expect(walletSecrets.mnemonic).toBeUndefined();
    expect(walletSecrets.seedHex).toEqual(hex.encode(testSeed));
    expect(walletSecrets.seedBase58).toEqual(base58.encode(testSeed));
    expect(walletSecrets.seedBase64).toEqual(base64.encode(testSeed));

    isInitialised = await seedVault.isInitialised();
    expect(isInitialised).toBe(true);

    const { rootNode, derivationType } = await seedVault.getWalletRootNode(walletId);
    expect(derivationType).toEqual('index');
    expect(rootNode).toEqual(testRootNode);
  });

  it('getWalletCount, getWalletIds, getPrimaryWalletId and deleteWallet work as expected', async () => {
    setupMocks();

    const seedVault = new SeedVault(config, encryptionVault);

    // add a wallet
    const walletId1 = await seedVault.storeWalletByMnemonic(testSeedPhrase, 'account');

    await expect(seedVault.getWalletCount()).resolves.toBe(1);
    await expect(seedVault.getWalletIds()).resolves.toEqual([walletId1]);
    await expect(seedVault.getPrimaryWalletId()).resolves.toEqual(walletId1);
    await expect(() => seedVault.deleteWallet(walletId1)).rejects.toThrow('Cannot delete primary wallet');

    // add another wallet
    const walletId2 = await seedVault.storeWalletBySeed(testSeed, 'index');

    await expect(seedVault.getWalletCount()).resolves.toBe(2);
    await expect(seedVault.getWalletIds()).resolves.toEqual([walletId1, walletId2]);
    await expect(seedVault.getPrimaryWalletId()).resolves.toEqual(walletId1);

    // add another wallet
    const walletId3 = await seedVault.storeWalletBySeed(testSeed.slice(1), 'index');

    await expect(seedVault.getWalletCount()).resolves.toBe(3);
    await expect(seedVault.getWalletIds()).resolves.toEqual([walletId1, walletId2, walletId3]);
    await expect(seedVault.getPrimaryWalletId()).resolves.toEqual(walletId1);

    // delete second wallet
    await seedVault.deleteWallet(walletId2);

    await expect(seedVault.getWalletCount()).resolves.toBe(2);
    await expect(seedVault.getWalletIds()).resolves.toEqual([walletId1, walletId3]);
    await expect(seedVault.getPrimaryWalletId()).resolves.toEqual(walletId1);

    // delete random wallet
    await seedVault.deleteWallet('notAWallet' as WalletId);

    await expect(seedVault.getWalletCount()).resolves.toBe(2);
    await expect(seedVault.getWalletIds()).resolves.toEqual([walletId1, walletId3]);
    await expect(seedVault.getPrimaryWalletId()).resolves.toEqual(walletId1);
    await expect(() => seedVault.deleteWallet(walletId1)).rejects.toThrow('Cannot delete primary wallet');
  });

  it('throws if trying to delete primary wallet', async () => {
    setupMocks();

    const seedVault = new SeedVault(config, encryptionVault);

    const walletId = await seedVault.storeWalletByMnemonic(testSeedPhrase, 'index');

    await expect(() => seedVault.deleteWallet(walletId)).rejects.toThrow('Cannot delete primary wallet');

    await expect(seedVault.getWalletIds()).resolves.toEqual([walletId]);

    const wallet2Id = await seedVault.storeWalletByMnemonic(testSeedPhrase, 'account');
    const wallet3Id = await seedVault.storeWalletBySeed(testSeed, 'index');

    await expect(seedVault.getWalletIds()).resolves.toEqual([walletId, wallet2Id, wallet3Id]);

    await expect(() => seedVault.deleteWallet(walletId)).rejects.toThrow('Cannot delete primary wallet');
    await expect(seedVault.deleteWallet(wallet2Id)).resolves.toBeUndefined();
    await expect(seedVault.getWalletIds()).resolves.toEqual([walletId, wallet3Id]);

    await expect(() => seedVault.deleteWallet(walletId)).rejects.toThrow('Cannot delete primary wallet');
    await expect(seedVault.deleteWallet(wallet3Id)).resolves.toBeUndefined();
    await expect(seedVault.getWalletIds()).resolves.toEqual([walletId]);

    await expect(() => seedVault.deleteWallet(walletId)).rejects.toThrow('Cannot delete primary wallet');
    await expect(seedVault.getWalletIds()).resolves.toEqual([walletId]);
  });
});
