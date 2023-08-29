export const toUint8 = (buf: Buffer): Uint8Array => {
  const uin = new Uint8Array(buf.length);
  return uin.map((a, index, arr) => (arr[index] = buf[index]));
};

export function concatBuffers(buf1: ArrayBuffer, buf2: ArrayBuffer) {
  const result = new Uint8Array(buf1.byteLength + buf2.byteLength);
  result.set(new Uint8Array(buf1), 0);
  result.set(new Uint8Array(buf2), buf1.byteLength);
  return result.buffer;
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
  return Array.prototype.slice
    .call(new Uint8Array(buffer))
    .map(x => [x >> 4, x & 15])
    .map(ab => ab.map(x => x.toString(16)).join(""))
    .join("");
}
