interface EncryptMnemonicArgs {
  password: string;
  seed: string;
  mnemonicEncryptionHandler: (seed: string, key: string) => Promise<string>;
}

export async function encryptMnemonicWithHandler(cb: EncryptMnemonicArgs) {
  const { mnemonicEncryptionHandler, password, seed } = cb;
  const encryptedSeed = await mnemonicEncryptionHandler(seed, password);
  return encryptedSeed;
}

interface DecryptMnemonicArgs {
  password: string;
  encryptedSeed: string;
  mnemonicDecryptionHandler: (seed: string, key: string) => Promise<string>;
}

export async function decryptMnemonicWithHandler(cb: DecryptMnemonicArgs) {
  const { mnemonicDecryptionHandler, password, encryptedSeed } = cb;
  const seedPhrase = await mnemonicDecryptionHandler(encryptedSeed, password);
  return seedPhrase;
}
