import SeedVault, { SeedVaultConfig, SeedVaultStorageKeys } from '../../seedVault';
import { beforeEach, describe, expect, it, vi } from 'vitest';

describe('SeedVault', () => {
  const secureStorageAdapter = {
    get: vi.fn(),
    set: vi.fn(),
    remove: vi.fn(),
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
    remove: vi.fn(),
  };
  const config: SeedVaultConfig = {
    secureStorageAdapter,
    cryptoUtilsAdapter,
    commonStorageAdapter,
  };
  const password = 'password';
  const salt = 'salt';
  const passwordHash = 'passwordHash';
  const encryptedSeed = 'encryptedSeed';
  const seed = 'seed';
  const prevStoredEncryptedSeed = 'prevStoredEncryptedSeed';

  const seedVault = SeedVault(config);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('storeSeed', () => {
    it('should throw an error if a seed is already stored and overwriteExistingSeed is false', async () => {
      commonStorageAdapter.get.mockResolvedValueOnce(prevStoredEncryptedSeed);
      await expect(seedVault.storeSeed(seed, password)).rejects.toThrow('Seed already set');
    });

    it('should store the seed after generating a hash and a salt for the password', async () => {
      cryptoUtilsAdapter.generateRandomBytes.mockResolvedValue(salt);
      cryptoUtilsAdapter.hash.mockResolvedValue(passwordHash);
      cryptoUtilsAdapter.encrypt.mockResolvedValue(encryptedSeed);
      await seedVault.storeSeed(seed, password);
      expect(cryptoUtilsAdapter.encrypt).toHaveBeenCalledWith(seed, passwordHash);
      expect(commonStorageAdapter.set).toHaveBeenCalledWith(SeedVaultStorageKeys.PASSWORD_SALT, salt);
      expect(secureStorageAdapter.set).toHaveBeenCalledWith(SeedVaultStorageKeys.PASSWORD_HASH, passwordHash);
      expect(commonStorageAdapter.set).toHaveBeenCalledWith(SeedVaultStorageKeys.ENCRYPTED_KEY, encryptedSeed);
    });

    it('should throw an error if the salt is not generated', async () => {
      cryptoUtilsAdapter.generateRandomBytes.mockResolvedValue(undefined);
      cryptoUtilsAdapter.hash.mockResolvedValue(undefined);
      await expect(seedVault.storeSeed(seed, password)).rejects.toThrow('passwordSalt generation failed');
    });

    it('should throw an error if the password hash is not generated', async () => {
      cryptoUtilsAdapter.generateRandomBytes.mockResolvedValue(salt);
      cryptoUtilsAdapter.hash.mockResolvedValue(undefined);
      await expect(seedVault.storeSeed(seed, password)).rejects.toThrow('passwordHash creation failed');
    });

    it('should throw an error if the seed cannot be encrypted', async () => {
      cryptoUtilsAdapter.generateRandomBytes.mockResolvedValue(salt);
      cryptoUtilsAdapter.hash.mockResolvedValue(passwordHash);
      cryptoUtilsAdapter.encrypt.mockResolvedValue(undefined);
      await expect(seedVault.storeSeed(seed, password)).rejects.toThrow('Seed encryption failed');
    });
  });

  describe('getSeed', () => {
    it('should get decrypted seed', async () => {
      secureStorageAdapter.get.mockResolvedValueOnce(passwordHash);
      commonStorageAdapter.get.mockResolvedValueOnce(encryptedSeed);
      cryptoUtilsAdapter.decrypt.mockResolvedValue(seed);

      const result = await seedVault.getSeed();

      expect(secureStorageAdapter.get).toHaveBeenCalledWith(SeedVaultStorageKeys.PASSWORD_HASH);
      expect(commonStorageAdapter.get).toHaveBeenCalledWith(SeedVaultStorageKeys.ENCRYPTED_KEY);
      expect(cryptoUtilsAdapter.decrypt).toHaveBeenCalledWith(encryptedSeed, passwordHash);
      expect(result).toEqual(seed);
    });

    it('should throw an error if encrypted seed is not set', async () => {
      commonStorageAdapter.get.mockResolvedValueOnce(null);
      secureStorageAdapter.get.mockResolvedValueOnce(passwordHash);

      await expect(seedVault.getSeed()).rejects.toThrow('Seed not set');
    });
  });

  describe('changePassword', () => {
    const oldPassword = 'oldPassword';
    const newPassword = 'newPassword';

    it('should change the password if the old password is correct', async () => {
      vi.spyOn(seedVault, 'unlockVault').mockResolvedValueOnce(undefined);
      vi.spyOn(seedVault, 'getSeed').mockResolvedValueOnce(seed);

      cryptoUtilsAdapter.generateRandomBytes.mockResolvedValueOnce(salt);
      cryptoUtilsAdapter.hash.mockResolvedValueOnce(passwordHash);
      cryptoUtilsAdapter.encrypt.mockResolvedValueOnce(encryptedSeed);

      vi.spyOn(seedVault, 'storeSeed').mockResolvedValueOnce(undefined);

      await seedVault.changePassword(oldPassword, newPassword);

      expect(seedVault.unlockVault).toHaveBeenCalledTimes(1);
      expect(seedVault.unlockVault).toHaveBeenCalledWith(oldPassword);
    });

    it('should throw an error if the old password is incorrect', async () => {
      vi.spyOn(seedVault, 'unlockVault').mockRejectedValueOnce(new Error('Wrong password'));

      await expect(seedVault.changePassword(oldPassword, newPassword)).rejects.toThrow('Wrong password');
      expect(seedVault.unlockVault).toHaveBeenCalledTimes(1);
      expect(seedVault.unlockVault).toHaveBeenCalledWith(oldPassword);
      expect(seedVault.storeSeed).not.toHaveBeenCalled();
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
      secureStorageAdapter.get.mockResolvedValue(passwordHash);
      cryptoUtilsAdapter.decrypt.mockResolvedValue(seed);
      commonStorageAdapter.get.mockResolvedValue(encryptedSeed);
      secureStorageAdapter.set.mockResolvedValue(null);

      await seedVault.lockVault();

      expect(secureStorageAdapter.get).toHaveBeenCalledWith(SeedVaultStorageKeys.PASSWORD_HASH);
      expect(cryptoUtilsAdapter.decrypt).toHaveBeenCalledWith(encryptedSeed, passwordHash);
      expect(secureStorageAdapter.set).toHaveBeenCalledWith(SeedVaultStorageKeys.PASSWORD_HASH, '');
    });
  });

  describe('unlockVault', () => {
    it('should unlock the vault if the password is correct', async () => {
      vi.spyOn(commonStorageAdapter, 'get').mockImplementation(async (key: string) => {
        if (key === SeedVaultStorageKeys.ENCRYPTED_KEY) {
          return encryptedSeed;
        } else if (key === SeedVaultStorageKeys.PASSWORD_SALT) {
          return salt;
        } else {
          return undefined;
        }
      });
      vi.spyOn(cryptoUtilsAdapter, 'hash').mockResolvedValueOnce(passwordHash);
      vi.spyOn(cryptoUtilsAdapter, 'decrypt').mockResolvedValueOnce(seed);
      vi.spyOn(secureStorageAdapter, 'set').mockResolvedValueOnce(undefined);

      await seedVault.unlockVault(password);

      expect(commonStorageAdapter.get).toHaveBeenCalledTimes(2);
      expect(commonStorageAdapter.get).toHaveBeenCalledWith(SeedVaultStorageKeys.ENCRYPTED_KEY);
      expect(commonStorageAdapter.get).toHaveBeenCalledWith(SeedVaultStorageKeys.PASSWORD_SALT);
      expect(cryptoUtilsAdapter.hash).toHaveBeenCalledTimes(1);
      expect(cryptoUtilsAdapter.hash).toHaveBeenCalledWith(password, salt);
      expect(cryptoUtilsAdapter.decrypt).toHaveBeenCalledTimes(1);
      expect(cryptoUtilsAdapter.decrypt).toHaveBeenCalledWith(encryptedSeed, passwordHash);
      expect(secureStorageAdapter.set).toHaveBeenCalledTimes(1);
      expect(secureStorageAdapter.set).toHaveBeenCalledWith(SeedVaultStorageKeys.PASSWORD_HASH, passwordHash);
    });

    it('should throw an error if the vault is empty', async () => {
      vi.spyOn(commonStorageAdapter, 'get').mockResolvedValueOnce(undefined);

      await expect(seedVault.unlockVault(password)).rejects.toThrow('empty vault');
      expect(commonStorageAdapter.get).toHaveBeenCalledTimes(2);
      expect(commonStorageAdapter.get).toHaveBeenCalledWith('encryptedKey');
      expect(commonStorageAdapter.get).toHaveBeenCalledWith('passwordSalt');
      expect(cryptoUtilsAdapter.hash).not.toHaveBeenCalled();
      expect(cryptoUtilsAdapter.decrypt).not.toHaveBeenCalled();
      expect(secureStorageAdapter.set).not.toHaveBeenCalled();
    });

    it('should throw an error if the password is incorrect', async () => {
      const wrongPassword = 'wrongPassword';
      vi.spyOn(commonStorageAdapter, 'get').mockImplementation(async (key: string) => {
        if (key === 'encryptedKey') {
          return encryptedSeed;
        } else if (key === 'passwordSalt') {
          return salt;
        } else {
          return undefined;
        }
      });
      vi.spyOn(cryptoUtilsAdapter, 'hash').mockResolvedValueOnce('wrongPasswordHash');
      vi.spyOn(cryptoUtilsAdapter, 'decrypt').mockRejectedValueOnce(new Error('Wrong password'));

      await expect(seedVault.unlockVault(wrongPassword)).rejects.toThrow('Wrong password');
      expect(commonStorageAdapter.get).toHaveBeenCalledTimes(2);
      expect(commonStorageAdapter.get).toHaveBeenCalledWith(SeedVaultStorageKeys.ENCRYPTED_KEY);
      expect(commonStorageAdapter.get).toHaveBeenCalledWith(SeedVaultStorageKeys.PASSWORD_SALT);
      expect(cryptoUtilsAdapter.hash).toHaveBeenCalledTimes(1);
      expect(cryptoUtilsAdapter.hash).toHaveBeenCalledWith(wrongPassword, salt);
      expect(cryptoUtilsAdapter.decrypt).toHaveBeenCalled();
      expect(secureStorageAdapter.set).not.toHaveBeenCalled();
    });
  });

  describe('isVaultUnlocked', () => {
    it('should return true if the vault is unlocked', async () => {
      secureStorageAdapter.get.mockResolvedValueOnce('passwordHash');
      const isUnlocked = await seedVault.isVaultUnlocked();
      expect(isUnlocked).toBe(true);
    });

    it('should return false if the vault is locked', async () => {
      secureStorageAdapter.get.mockResolvedValueOnce(undefined);
      const isUnlocked = await seedVault.isVaultUnlocked();
      expect(isUnlocked).toBe(false);
    });
  });

  describe('clearVaultStorage', () => {
    it('should remove all items from storage', async () => {
      await seedVault.clearVaultStorage();
      expect(commonStorageAdapter.remove).toHaveBeenCalledTimes(Object.values(SeedVaultStorageKeys).length - 1);
      expect(secureStorageAdapter.remove).toHaveBeenCalledTimes(1);
    });
  });
});
