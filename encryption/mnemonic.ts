import { entropyToMnemonic, mnemonicToEntropy, wordlists } from "bip39";
import { decryptMnemonic, encryptMnemonic } from "@stacks/encryption";
import { aesGcmDecrypt, aesGcmEncrypt } from './aes';


/**
 * @param {string} seed
 * @returns {string}
 */
const seedPhraseToEntropy = (seed: string): string => {
try {
  return mnemonicToEntropy(seed, wordlists.EN);
} catch (error) {
  console.error('Invalid mnemonic phrase provided');
  console.error(error);
  throw new Error('Not a valid bip39 mnemonic');
}
}

export const encryptSeedPhrase = async (seed: string, passwordHash: string): Promise<string> => {
  const mnemonicEntropy = seedPhraseToEntropy(seed);
  const encryptedSeed = await aesGcmEncrypt(mnemonicEntropy, passwordHash);
  return encryptedSeed;
};



export const decryptSeedPhrase = async (encryptedSeed: string, passwordHash: string): Promise<string> => {
  const mnemonicEntropy = await aesGcmDecrypt(encryptedSeed, passwordHash);
  const seed = entropyToMnemonic(mnemonicEntropy, wordlists.EN);
  return seed;
};


export const encryptSeedPhraseCBC = encryptMnemonic;

export const decryptSeedPhraseCBC = decryptMnemonic;
