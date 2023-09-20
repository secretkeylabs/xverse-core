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
      expect(secureStorageAdapter.set).toHaveBeenCalledWith(SeedVaultStorageKeys.PASSWORD_HASH, passwordHash);
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
    it('should store the seed if the password hash is set and no seed is already stored', async () => {
      secureStorageAdapter.get.mockResolvedValueOnce(password);
      commonStorageAdapter.get.mockResolvedValueOnce(undefined);
      cryptoUtilsAdapter.encrypt.mockResolvedValueOnce(encryptedSeed);
      await seedVault.storeSeed(seed);
      expect(cryptoUtilsAdapter.encrypt).toHaveBeenCalledWith(seed, password);
      expect(commonStorageAdapter.set).toHaveBeenCalledWith(SeedVaultStorageKeys.ENCRYPTED_KEY, encryptedSeed);
    });

    it('should throw an error if the password hash is not set', async () => {
      secureStorageAdapter.get.mockResolvedValueOnce(undefined);
      await expect(seedVault.storeSeed(seed)).rejects.toThrow('passwordHash not set');
    });

    it('should throw an error if a seed is already stored and overwriteExistingSeed is false', async () => {
      const prevStoredEncryptedSeed = 'prevStoredEncryptedSeed';
      secureStorageAdapter.get.mockResolvedValueOnce(password);
      commonStorageAdapter.get.mockResolvedValueOnce(prevStoredEncryptedSeed);
      await expect(seedVault.storeSeed(seed)).rejects.toThrow('Seed already set');
    });

    it('should throw an error if the seed cannot be encrypted', async () => {
      secureStorageAdapter.get.mockResolvedValueOnce(password);
      cryptoUtilsAdapter.encrypt.mockResolvedValueOnce(undefined);
      await expect(seedVault.storeSeed(seed)).rejects.toThrow('Seed not set');
    });
  });

  describe('getSeed', () => {
    it('should get decrypted seed', async () => {
      secureStorageAdapter.get.mockResolvedValue(passwordHash);
      commonStorageAdapter.get.mockResolvedValue(encryptedSeed);
      cryptoUtilsAdapter.decrypt.mockResolvedValue(seed);

      const result = await seedVault.getSeed();

      expect(secureStorageAdapter.get).toHaveBeenCalledWith(SeedVaultStorageKeys.PASSWORD_HASH);
      expect(commonStorageAdapter.get).toHaveBeenCalledWith(SeedVaultStorageKeys.ENCRYPTED_KEY);
      expect(cryptoUtilsAdapter.decrypt).toHaveBeenCalledWith(encryptedSeed, passwordHash);
      expect(result).toEqual(seed);
    });

    it('should throw an error if encrypted seed is not set', async () => {
      commonStorageAdapter.get.mockResolvedValue(null);

      await expect(seedVault.getSeed()).rejects.toThrow('Seed not set');
    });
  });

  describe('changePassword', () => {
    const oldPassword = 'oldPassword';
    const newPassword = 'newPassword';
    it('should change the password if the old password is correct', async () => {
      vi.spyOn(seedVault, 'unlockVault').mockResolvedValueOnce(undefined);
      vi.spyOn(seedVault, 'getSeed').mockResolvedValueOnce(seed);
      vi.spyOn(seedVault, 'init').mockResolvedValue(undefined);
      cryptoUtilsAdapter.encrypt.mockResolvedValueOnce(encryptedSeed);
      vi.spyOn(seedVault, 'storeSeed').mockResolvedValue(undefined);

      await seedVault.changePassword(oldPassword, newPassword);

      expect(seedVault.unlockVault).toHaveBeenCalledTimes(1);
      expect(seedVault.unlockVault).toHaveBeenCalledWith(oldPassword);
      expect(seedVault.init).toHaveBeenCalledTimes(1);
      expect(seedVault.init).toHaveBeenCalledWith(newPassword);
    });

    it('should throw an error if the old password is incorrect', async () => {
      vi.spyOn(seedVault, 'unlockVault').mockRejectedValueOnce(new Error('Wrong password'));

      await expect(seedVault.changePassword(oldPassword, newPassword)).rejects.toThrow('Wrong password');
      expect(seedVault.unlockVault).toHaveBeenCalledTimes(1);
      expect(seedVault.unlockVault).toHaveBeenCalledWith(oldPassword);
      expect(seedVault.init).not.toHaveBeenCalled();
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
