import { describe, expect, it, vi } from 'vitest';
import { encryptMnemonicWithHandler, decryptMnemonicWithHandler } from '../../wallet';

describe('encryptionUtils', () => {
  describe('encryptMnemonicWithHandler', () => {
    it('should encrypt the seed using the provided handler and password', async () => {
      const seed = 'test seed';
      const password = 'test password';
      const encryptedSeed = 'encrypted seed';
      const mnemonicEncryptionHandler = vi.fn().mockResolvedValue(encryptedSeed);

      const result = await encryptMnemonicWithHandler({
        seed,
        password,
        mnemonicEncryptionHandler,
      });

      expect(mnemonicEncryptionHandler).toHaveBeenCalledWith(seed, password);
      expect(result).toBe(encryptedSeed);
    });
  });

  describe('decryptMnemonicWithHandler', () => {
    it('should decrypt the encrypted seed using the provided handler and password', async () => {
      const encryptedSeed = 'encrypted seed';
      const password = 'test password';
      const seedPhrase = 'test seed phrase';
      const mnemonicDecryptionHandler = vi.fn().mockResolvedValue(seedPhrase);

      const result = await decryptMnemonicWithHandler({
        encryptedSeed,
        password,
        mnemonicDecryptionHandler,
      });

      expect(mnemonicDecryptionHandler).toHaveBeenCalledWith(encryptedSeed, password);
      expect(result).toBe(seedPhrase);
    });
  });
});
