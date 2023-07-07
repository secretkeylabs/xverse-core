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
  console.log('🚀 ~ file: encryptionUtils.ts:39 ~ aesGcmDecrypt ~ passwordHash:', passwordHash.length);
  toUint8(Buffer.from(passwordHash));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ivStr = Buffer.from(iv).toString('base64');
  const alg = { name: 'AES-GCM', iv };
  console.log(toUint8(Buffer.from(passwordHash)).byteLength);
  console.log(
    '🚀 ~ file: encryptionUtils.ts:24 ~ aesGcmEncrypt ~ toUint8(Buffer.from(passwordHash)):',
    toUint8(Buffer.from(passwordHash)),
  );
  const key = await crypto.subtle.importKey('raw', Buffer.from(passwordHash), alg, false, ['encrypt']);
  const ptUint8 = new TextEncoder().encode(plaintext);
  const ctBuffer = await crypto.subtle.encrypt(alg, key, ptUint8);
  const ctStr = Buffer.from(ctBuffer).toString('base64');
  return `${ivStr}.${ctStr}`;
}

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
  const key = await crypto.subtle.importKey('raw', Buffer.from(passwordHash), alg, false, ['decrypt']);
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
