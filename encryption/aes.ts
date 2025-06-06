/**
 * AEC GCM utils using the WebCrypto API.(target: browser/extensions)
 * @module encryption/aes
 */

import { buf2hex, concatBuffers, str2buf } from '../utils/arrayBuffers';

export const IV_SIZE = 16;

/**
 * Generate a random key with a given byte length.
 * @param {number} bytesCount
 * @returns {string}
 */
export function generateRandomKey(bytesCount: number): string {
  return buf2hex(crypto.getRandomValues(new Uint8Array(bytesCount)));
}

/**
 * @param   {String} plaintext - Plaintext to be encrypted.
 * @param   {String} passwordHash - Password to use to encrypt plaintext.
 * @returns {String} Encrypted cipherText.
 */
export async function aesGcmEncrypt(plaintext: string, passwordHash: string): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(IV_SIZE));
  const data = Buffer.from(plaintext, 'utf-8');
  const alg = { name: 'AES-GCM', iv };
  const key = await crypto.subtle.importKey('raw', str2buf(passwordHash), alg, false, ['encrypt', 'decrypt']);
  const encrypted = await crypto.subtle.encrypt(alg, key, data);
  const buffer = new Uint8Array(encrypted);
  const cipherIv = concatBuffers(iv, buffer);
  return buf2hex(cipherIv);
}

/**
 * @param   {String} cipherText - CipherText to be decrypted.
 * @param   {String} passwordHash - Password to use to decrypt cipherText.
 * @returns {String} Decrypted plaintext.
 */
export async function aesGcmDecrypt(cipherText: string, passwordHash: string): Promise<string> {
  const cipher = Buffer.from(cipherText, 'hex');
  const data = cipher.subarray(IV_SIZE);
  const iv = cipher.subarray(0, IV_SIZE);
  const alg = { name: 'AES-GCM', iv };
  const key = await crypto.subtle.importKey('raw', str2buf(passwordHash), alg, false, ['encrypt', 'decrypt']);
  const plainBuffer = await crypto.subtle.decrypt(alg, key, data);
  const plaintext = new TextDecoder().decode(plainBuffer);
  return plaintext;
}
