import { mnemonicToEntropy, wordlists } from 'bip39';

interface EncryptMnemonicArgs {
  password: string;
  seed: string;
  passwordHashGenerator: (password: string) => Promise<{
    salt: string;
    hash: string;
  }>;
  mnemonicEncryptionHandler: (seed: string, key: string) => Promise<Buffer>;
}

export async function encryptMnemonicWithCallback(cb: EncryptMnemonicArgs) {
  const { mnemonicEncryptionHandler, password, seed } = cb;
  const encryptedSeed = await mnemonicEncryptionHandler(seed, password);
  return encryptedSeed.toString('hex');
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

export async function decryptMnemonicWithCallback(cb: DecryptMnemonicArgs) {
  const { mnemonicDecryptionHandler, password, encryptedSeed } = cb;
  const seedPhrase = await mnemonicDecryptionHandler(encryptedSeed, password);
  return seedPhrase;
}

const toUint8 = (buf: Buffer): Uint8Array => {
  const uin = new Uint8Array(buf.length);
  return uin.map((a, index, arr) => (arr[index] = buf[index]));
};

/**
 *
 * @param   {String} plaintext - Plaintext to be encrypted.
 * @param   {String} passwordHash - Password to use to encrypt plaintext.
 * @returns {String} Encrypted cipherText.
 *
 * @example
 *   const cipherText = await aesGcmEncrypt('my secret text', 'pw');
 *   aesGcmEncrypt('my secret text', 'pw').then(function(cipherText) { console.log(cipherText); });
 */
export async function aesGcmEncrypt(plaintext: string, passwordHash: string): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ivStr = Buffer.from(iv).toString('base64');
  const alg = { name: 'AES-GCM', iv };
  const key = await crypto.subtle.importKey('raw', toUint8(Buffer.from(passwordHash)), alg, false, ['encrypt']);
  const ptUint8 = new TextEncoder().encode(plaintext);
  const ctBuffer = await crypto.subtle.encrypt(alg, key, ptUint8);
  const ctStr = Buffer.from(ctBuffer).toString('base64');
  return `${ivStr}.${ctStr}`;
}

export const encryptSeed = async (seed: string, passwordHash: string) => {
  let mnemonicEntropy: string;
  try {
    // must be bip39 mnemonic
    // `mnemonicToEntropy` converts mnemonic string to raw entropy in form of byte array
    const entropyBytes = mnemonicToEntropy(seed, wordlists.EN);
    // Convert byte array to hex string
    mnemonicEntropy = Buffer.from(entropyBytes).toString('hex');
  } catch (error) {
    console.error('Invalid mnemonic phrase provided');
    console.error(error);
    throw new Error('Not a valid bip39 mnemonic');
  }
  // normalize plaintext to fixed length byte string
  const plaintextNormalized = Buffer.from(mnemonicEntropy, 'hex');
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ivStr = Buffer.from(iv).toString('base64');
  const alg = { name: 'AES-GCM', iv };
  const key = await crypto.subtle.importKey('raw', toUint8(Buffer.from(passwordHash)), alg, false, ['encrypt']);
  const ptUint8 = toUint8(plaintextNormalized);
  const ctBuffer = await crypto.subtle.encrypt(alg, key, ptUint8);
  const ctStr = Buffer.from(ctBuffer).toString('base64');
  return `${ivStr}.${ctStr}`;
};

/**
 *
 * @param   {String} cipherText - CipherText to be decrypted.
 * @param   {String} passwordHash - Password to use to decrypt cipherText.
 * @returns {String} Decrypted plaintext.
 *
 * @example
 *   const plaintext = await aesGcmDecrypt(cipherText, 'pw');
 *   aesGcmDecrypt(cipherText, 'pw').then(function(plaintext) { console.log(plaintext); });
 */
export async function aesGcmDecrypt(cipherText: string, passwordHash: string): Promise<string> {
  if (cipherText.indexOf('.') === -1) {
    throw new Error('Invalid cipherText');
  }
  const cipherSplitted = cipherText.split('.');
  const ivStr = cipherSplitted[0];
  const iv = Buffer.from(ivStr, 'base64');
  const alg = { name: 'AES-GCM', iv };
  const key = await crypto.subtle.importKey('raw', toUint8(Buffer.from(passwordHash)), alg, false, ['decrypt']);
  const ctStr = cipherSplitted[1];
  const ctUint8 = Buffer.from(ctStr, 'base64');
  try {
    const plainBuffer = await crypto.subtle.decrypt(alg, key, ctUint8);
    const plaintext = new TextDecoder().decode(plainBuffer);
    return plaintext;
  } catch (e) {
    throw new Error('Decrypt failed');
  }
}
