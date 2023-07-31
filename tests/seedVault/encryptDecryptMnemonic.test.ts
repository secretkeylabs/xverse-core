import { beforeEach, describe, expect, it, vi } from 'vitest';

import { decryptMnemonicWithCallback, encryptMnemonicWithCallback } from '../../seedVault/encryptionUtils';

describe('encryptMnemonicWithCallback', () => {
  const password = 'password';
  const seed = 'seed';

  const mockMnemonicEncryptionHandler = vi.fn(() => {
    const encryptedSeedBuffer = Buffer.from('encrypted_seed');
    return Promise.resolve(encryptedSeedBuffer);
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should encrypt the mnemonic', async () => {
    const result = await encryptMnemonicWithCallback({
      mnemonicEncryptionHandler: mockMnemonicEncryptionHandler,
      password,
      seed,
    });

    expect(mockMnemonicEncryptionHandler).toHaveBeenCalledWith(seed, password);
    expect(result).toBe('656e637279707465645f73656564');
  });

  it('should reject with an error if encryption fails', async () => {
    const errorMessage = 'Encryption error';

    mockMnemonicEncryptionHandler.mockRejectedValue(new Error(errorMessage));

    await expect(
      encryptMnemonicWithCallback({
        mnemonicEncryptionHandler: mockMnemonicEncryptionHandler,
        password,
        seed,
      })
    ).rejects.toThrow(errorMessage);

  });
});

describe('decryptMnemonicWithCallback', () => {
  const password = 'password';
  const encryptedSeed = 'encrypted_seed';

  const mockMnemonicDecryptionHandler = vi.fn(() => {
    const seedPhrase = 'decrypted_seed_phrase';
    return Promise.resolve(seedPhrase);
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should decrypt the mnemonic', async () => {
    const result = await decryptMnemonicWithCallback({
      mnemonicDecryptionHandler: mockMnemonicDecryptionHandler,
      password,
      encryptedSeed,
    });

    expect(mockMnemonicDecryptionHandler).toHaveBeenCalledWith(encryptedSeed, password);
    expect(result).toBe('decrypted_seed_phrase');
  });

  it('should reject with an error if decryption fails', async () => {
    const errorMessage = 'Decryption error';

    mockMnemonicDecryptionHandler.mockRejectedValue(new Error(errorMessage));

    await expect(
      decryptMnemonicWithCallback({
        mnemonicDecryptionHandler: mockMnemonicDecryptionHandler,
        password,
        encryptedSeed,
      })
    ).rejects.toThrow(errorMessage);

  });
});
