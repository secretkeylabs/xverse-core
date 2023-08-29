import { entropyToMnemonic, mnemonicToEntropy, wordlists } from "bip39";
import { aesGcmDecrypt, aesGcmEncrypt } from "./aes";
import { decryptMnemonic, encryptMnemonic } from "@stacks/encryption";


/**
 * @param {string} seed
 * @returns {string}
 */
const seedToEntropy = (seed: string): string => {
try {
  return mnemonicToEntropy(seed, wordlists.EN);
} catch (error) {
  console.error('Invalid mnemonic phrase provided');
  console.error(error);
  throw new Error('Not a valid bip39 mnemonic');
}
}

export const encryptSeed = async (seed: string, passwordHash: string): Promise<string> => {
  const mnemonicEntropy = seedToEntropy(seed);
  const encryptedSeed = await aesGcmEncrypt(mnemonicEntropy, passwordHash);
  return encryptedSeed;
};



export const decryptSeed = async (encryptedSeed: string, passwordHash: string): Promise<string> => {
  const mnemonicEntropy = await aesGcmDecrypt(encryptedSeed, passwordHash);
  const seed = entropyToMnemonic(mnemonicEntropy, wordlists.EN);
  return seed;
};


export const encryptSeedCBC = encryptMnemonic;

export const decryptSeedCBC = decryptMnemonic;
