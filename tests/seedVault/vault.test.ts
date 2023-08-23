import SeedVault, { SeedVaultConfig, SeedVaultStorageKeys } from 'seedVault';
import { beforeEach, describe, expect, it, vi } from 'vitest';

describe('SeedVault', () => {
  const storageAdapter = {
    get: vi.fn(),
    set: vi.fn(),
  };
  const cryptoUtilsAdapter = {
    encrypt: vi.fn(),
    decrypt: vi.fn(),
    hash: vi.fn(),
    generateRandomBytes: vi.fn(),
  };
  const commonStorageAdapter = {
    get: vi.fn(),
    set: vi.fn(),
  };
  const config: SeedVaultConfig = {
    storageAdapter,
    cryptoUtilsAdapter,
    commonStorageAdapter,
  };
  const password = 'password';
  const salt = 'salt';
  const passwordHash = 'passwordHash';
  const encryptedSeed = 'encryptedSeed';
  const seed = 'seed';

  const seedVault = new SeedVault(config);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('init', () => {
    it('should set password salt and password hash', async () => {
      cryptoUtilsAdapter.generateRandomBytes.mockReturnValue(salt);
      cryptoUtilsAdapter.hash.mockResolvedValue(passwordHash);

      await seedVault.init(password);

      expect(cryptoUtilsAdapter.generateRandomBytes).toHaveBeenCalledWith(32);
      expect(cryptoUtilsAdapter.hash).toHaveBeenCalledWith(password, salt);
      expect(commonStorageAdapter.set).toHaveBeenCalledWith(SeedVaultStorageKeys.PASSWORD_SALT, salt);
      expect(storageAdapter.set).toHaveBeenCalledWith(SeedVaultStorageKeys.PASSWORD_HASH, passwordHash);
    });

    it('should throw an error if salt is not set', async () => {
      cryptoUtilsAdapter.generateRandomBytes.mockReturnValue(null);

      await expect(seedVault.init(password)).rejects.toThrow('Salt not set');
    });

    it('should throw an error if password hash is not set', async () => {
      cryptoUtilsAdapter.generateRandomBytes.mockReturnValue(salt);
      cryptoUtilsAdapter.hash.mockResolvedValue(null);

      await expect(seedVault.init(password)).rejects.toThrow('Password hash not set');
    });
  });

  describe('storeSeed', () => {
    it('should store encrypted seed', async () => {
      storageAdapter.get.mockResolvedValue(passwordHash);
      cryptoUtilsAdapter.encrypt.mockResolvedValue(encryptedSeed);

      await seedVault.storeSeed(seed);

      expect(storageAdapter.get).toHaveBeenCalledWith(SeedVaultStorageKeys.PASSWORD_HASH);
      expect(cryptoUtilsAdapter.encrypt).toHaveBeenCalledWith(seed, passwordHash);
      expect(commonStorageAdapter.set).toHaveBeenCalledWith(SeedVaultStorageKeys.ENCRYPTED_KEY, encryptedSeed);
    });

    it('should throw an error if password hash is not set', async () => {
      storageAdapter.get.mockResolvedValue(null);

      await expect(seedVault.storeSeed(seed)).rejects.toThrow('passwordHash not set');
    });

    it('should throw an error if encrypted seed is not set', async () => {
      storageAdapter.get.mockResolvedValue(passwordHash);
      cryptoUtilsAdapter.encrypt.mockResolvedValue(null);

      await expect(seedVault.storeSeed(seed)).rejects.toThrow('Seed not set');
    });
  });

  describe('getSeed', () => {
    it('should get decrypted seed', async () => {
      storageAdapter.get.mockResolvedValue(passwordHash);
      commonStorageAdapter.get.mockResolvedValue(encryptedSeed);
      cryptoUtilsAdapter.decrypt.mockResolvedValue(seed);

      const result = await seedVault.getSeed();

      expect(storageAdapter.get).toHaveBeenCalledWith(SeedVaultStorageKeys.PASSWORD_HASH);
      expect(commonStorageAdapter.get).toHaveBeenCalledWith(SeedVaultStorageKeys.ENCRYPTED_KEY);
      expect(cryptoUtilsAdapter.decrypt).toHaveBeenCalledWith(encryptedSeed, passwordHash);
      expect(result).toEqual(seed);
    });

    it('should throw an error if encrypted seed is not set', async () => {
      commonStorageAdapter.get.mockResolvedValue(null);

      await expect(seedVault.getSeed(password)).rejects.toThrow('Seed not set');
    });

    it('should throw an error if password is wrong', async () => {
      storageAdapter.get.mockResolvedValue(passwordHash);
      commonStorageAdapter.get.mockResolvedValue(encryptedSeed);
      cryptoUtilsAdapter.decrypt.mockResolvedValue(null);

      await expect(seedVault.getSeed('wrongPassword')).rejects.toThrow('Wrong password');
    });

    it('should update password hash if password is provided', async () => {
      storageAdapter.get.mockResolvedValue(undefined);
      commonStorageAdapter.get.mockResolvedValueOnce(salt).mockResolvedValueOnce(encryptedSeed);
      cryptoUtilsAdapter.hash.mockResolvedValue(passwordHash);
      cryptoUtilsAdapter.decrypt.mockResolvedValue(seed);
      storageAdapter.set.mockResolvedValue(null);

      await seedVault.getSeed(password);

      expect(cryptoUtilsAdapter.hash).toHaveBeenCalledWith(password, salt);
      expect(cryptoUtilsAdapter.decrypt).toHaveBeenCalledWith(encryptedSeed, passwordHash);
      expect(storageAdapter.set).toHaveBeenCalledWith(SeedVaultStorageKeys.PASSWORD_HASH, passwordHash);
    });
  });

  describe('changePassword', () => {
    it('should change password', async () => {
      const newSalt = 'newSalt';
      const newPasswordHash = 'newPasswordHash';
      const newEncryptedSeed = 'newEncryptedSeed';

      storageAdapter.get.mockResolvedValueOnce(passwordHash).mockResolvedValueOnce(newPasswordHash);
      commonStorageAdapter.get.mockResolvedValue(encryptedSeed);
      cryptoUtilsAdapter.decrypt.mockResolvedValue(seed);
      cryptoUtilsAdapter.generateRandomBytes.mockReturnValue(newSalt);
      cryptoUtilsAdapter.hash.mockResolvedValue(newPasswordHash);
      cryptoUtilsAdapter.encrypt.mockResolvedValue(newEncryptedSeed);
      commonStorageAdapter.set.mockResolvedValue(null);
      storageAdapter.set.mockResolvedValue(null);

      await seedVault.changePassword(password, 'newPassword');

      expect(cryptoUtilsAdapter.decrypt).toHaveBeenCalledWith(encryptedSeed, passwordHash);
      expect(cryptoUtilsAdapter.generateRandomBytes).toHaveBeenCalledWith(32);
      expect(cryptoUtilsAdapter.hash).toHaveBeenCalledWith('newPassword', newSalt);
      expect(cryptoUtilsAdapter.encrypt).toHaveBeenCalledWith(seed, newPasswordHash);
      expect(commonStorageAdapter.set).toHaveBeenCalledWith(SeedVaultStorageKeys.PASSWORD_SALT, newSalt);
      expect(storageAdapter.set).toHaveBeenCalledWith(SeedVaultStorageKeys.PASSWORD_HASH, newPasswordHash);
      expect(commonStorageAdapter.set).toHaveBeenCalledWith(SeedVaultStorageKeys.ENCRYPTED_KEY, newEncryptedSeed);
    });
  });

  describe('hasSeed', () => {
    it('should return true if encrypted seed is set', async () => {
      commonStorageAdapter.get.mockResolvedValue(encryptedSeed);

      const result = await seedVault.hasSeed();

      expect(commonStorageAdapter.get).toHaveBeenCalledWith(SeedVaultStorageKeys.ENCRYPTED_KEY);
      expect(result).toBe(true);
    });

    it('should return false if encrypted seed is not set', async () => {
      commonStorageAdapter.get.mockResolvedValue(null);

      const result = await seedVault.hasSeed();

      expect(commonStorageAdapter.get).toHaveBeenCalledWith(SeedVaultStorageKeys.ENCRYPTED_KEY);
      expect(result).toBe(false);
    });
  });

  describe('lockVault', () => {
    it('should lock vault', async () => {
      storageAdapter.get.mockResolvedValue(passwordHash);
      cryptoUtilsAdapter.decrypt.mockResolvedValue(seed);
      commonStorageAdapter.get.mockResolvedValue(encryptedSeed);
      storageAdapter.set.mockResolvedValue(null);

      await seedVault.lockVault();

      expect(storageAdapter.get).toHaveBeenCalledWith(SeedVaultStorageKeys.PASSWORD_HASH);
      expect(cryptoUtilsAdapter.decrypt).toHaveBeenCalledWith(encryptedSeed, passwordHash);
      expect(storageAdapter.set).toHaveBeenCalledWith(SeedVaultStorageKeys.PASSWORD_HASH, '');
    });
  });
});
