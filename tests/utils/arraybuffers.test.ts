import { describe, expect, it } from 'vitest';
import { toUint8, str2buf, buf2hex, concatBuffers } from '../../utils/arrayBuffers';


describe('toUint8', () => {
  it('should convert a Buffer to a Uint8Array', () => {
    const buf = Buffer.from('hello world');
    const uint8 = toUint8(buf);
    expect(uint8).toBeInstanceOf(Uint8Array);
    expect(uint8).toEqual(new Uint8Array(buf));
  });
});

describe('concatBuffers', () => {
  it('should concatenate two Uint8Arrays', () => {
    const buf1 = new Uint8Array([1, 2, 3]);
    const buf2 = new Uint8Array([4, 5, 6]);
    const result = concatBuffers(buf1, buf2);
    expect(result).toBeInstanceOf(Uint8Array);
    expect(result).toEqual(new Uint8Array([1, 2, 3, 4, 5, 6]));
  });
});

describe('str2buf', () => {
  it('should encode a string as a Uint8Array', () => {
    const str = 'hello world';
    const result = str2buf(str);
    expect(result).toBeInstanceOf(Uint8Array);
    expect(result).toEqual(new TextEncoder().encode(str));
  });
});

describe('buf2hex', () => {
  it('should encode a buffer as a hex string', () => {
    const buf = Buffer.from('hello world');
    const result = buf2hex(buf);
    expect(result).toBe('68656c6c6f20776f726c64');
  });
});
