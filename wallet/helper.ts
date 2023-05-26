export function ecPairToHexString(secretKey: any) {
  const ecPointHex = secretKey.privateKey.toString('hex');
  if (secretKey.compressed) {
    return ecPointHex + '01';
  } else {
    return ecPointHex;
  }
}

interface EncryptMnemonicArgs {
  password: string;
  seed: string;
  passwordHashGenerator: (password: string) => Promise<{
    salt: string;
    hash: string;
  }>;
  mnemonicEncryptionHandler: (seed: string, key: string) => Promise<Buffer>;
}

interface DecryptMnemonicArgs {
  password: string;
  encryptedSeed: string;
  passwordHashGenerator: (password: string) => Promise<{
    salt: string;
    hash: string;
  }>;
  mnemonicDecryptionHandler: (seed: Buffer | string, key: string) => Promise<string>;
}

export async function encryptMnemonicWithCallback(cb: EncryptMnemonicArgs) {
  const { mnemonicEncryptionHandler, passwordHashGenerator, password, seed } = cb;
  try {
    const { hash } = await passwordHashGenerator(password);
    const encryptedSeedBuffer = await mnemonicEncryptionHandler(seed, hash);
    return encryptedSeedBuffer.toString('hex');
  } catch (err) {
    return Promise.reject(err);
  }
}

export async function decryptMnemonicWithCallback(cb: DecryptMnemonicArgs) {
  const { mnemonicDecryptionHandler, passwordHashGenerator, password, encryptedSeed } = cb;
  try {
    const { hash } = await passwordHashGenerator(password);
    const seedPhrase = await mnemonicDecryptionHandler(encryptedSeed, hash);
    return seedPhrase;
  } catch (err) {
    return Promise.reject(err);
  }
}