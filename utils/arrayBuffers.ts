export const toUint8 = (buf: Buffer): Uint8Array => {
  return new Uint8Array(buf);
};

export function concatBuffers(buf1: Uint8Array, buf2: Uint8Array) {
  return new Uint8Array([...buf1, ...buf2]);
}

/**
 * Encodes a utf8 string as a byte array.
 * @param {String} str
 * @returns {Uint8Array}
 */
export function str2buf(str: string): Uint8Array {
  return new TextEncoder().encode(str);
}

/**
 * Encodes a byte array as a string of hex.
 * @param {Uint8Array} buffer
 * @returns {String}
 */
export function buf2hex(buffer: ArrayBuffer): string {
  return Buffer.from(buffer).toString('hex');
}
