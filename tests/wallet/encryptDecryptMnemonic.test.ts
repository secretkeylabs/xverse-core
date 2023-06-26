import { beforeEach, describe, expect, it, vi } from 'vitest';

import { decryptMnemonicWithCallback, encryptMnemonicWithCallback } from '../../wallet';

describe('encryptMnemonicWithCallback', () => {
  const password = 'password';
  const seed = 'seed';

  const mockMnemonicEncryptionHandler = vi.fn(() => {
    const encryptedSeedBuffer = Buffer.from('encrypted_seed');
    return Promise.resolve(encryptedSeedBuffer);
  });

  const mockPasswordHashGenerator = vi.fn(() => {
    const hash = 'password_hash';
    return Promise.resolve({ hash, salt: 'salt' });
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should encrypt the mnemonic', async () => {
    const result = await encryptMnemonicWithCallback({
      mnemonicEncryptionHandler: mockMnemonicEncryptionHandler,
      passwordHashGenerator: mockPasswordHashGenerator,
      password,
      seed,
    });

    expect(mockPasswordHashGenerator).toHaveBeenCalledWith(password);
    expect(mockMnemonicEncryptionHandler).toHaveBeenCalledWith(seed, 'password_hash');
    expect(result).toBe('656e637279707465645f73656564');
  });

  it('should reject with an error if encryption fails', async () => {
    const errorMessage = 'Encryption error';

    mockPasswordHashGenerator.mockRejectedValue(new Error(errorMessage));

    await expect(
      encryptMnemonicWithCallback({
        mnemonicEncryptionHandler: mockMnemonicEncryptionHandler,
        passwordHashGenerator: mockPasswordHashGenerator,
        password,
        seed,
      })
    ).rejects.toThrow(errorMessage);

    expect(mockPasswordHashGenerator).toHaveBeenCalledWith(password);
    expect(mockMnemonicEncryptionHandler).not.toHaveBeenCalled();
  });
});

describe('decryptMnemonicWithCallback', () => {
  const password = 'password';
  const encryptedSeed = 'encrypted_seed';

  const mockMnemonicDecryptionHandler = vi.fn(() => {
    const seedPhrase = 'decrypted_seed_phrase';
    return Promise.resolve(seedPhrase);
  });

  const mockPasswordHashGenerator = vi.fn(() => {
    const hash = 'password_hash';
    return Promise.resolve({ hash, salt: 'salt' });
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should decrypt the mnemonic', async () => {
    const result = await decryptMnemonicWithCallback({
      mnemonicDecryptionHandler: mockMnemonicDecryptionHandler,
      passwordHashGenerator: mockPasswordHashGenerator,
      password,
      encryptedSeed,
    });

    expect(mockPasswordHashGenerator).toHaveBeenCalledWith(password);
    expect(mockMnemonicDecryptionHandler).toHaveBeenCalledWith(encryptedSeed, 'password_hash');
    expect(result).toBe('decrypted_seed_phrase');
  });

  it('should reject with an error if decryption fails', async () => {
    const errorMessage = 'Decryption error';

    mockPasswordHashGenerator.mockRejectedValue(new Error(errorMessage));

    await expect(
      decryptMnemonicWithCallback({
        mnemonicDecryptionHandler: mockMnemonicDecryptionHandler,
        passwordHashGenerator: mockPasswordHashGenerator,
        password,
        encryptedSeed,
      })
    ).rejects.toThrow(errorMessage);

    expect(mockPasswordHashGenerator).toHaveBeenCalledWith(password);
    expect(mockMnemonicDecryptionHandler).not.toHaveBeenCalled();
  });
});
