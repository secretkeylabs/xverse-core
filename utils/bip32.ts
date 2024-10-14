import b58 from 'bs58check';
import * as ecc from '@bitcoinerlab/secp256k1';
import { BIP32Factory, BIP32Interface } from 'bip32';

export const bip32 = BIP32Factory(ecc);
export type { BIP32Interface };

export function convertZpubToXpub(zpub: string): string {
  const data = b58.decode(zpub);
  const buffer = Buffer.from(data);
  buffer.writeUInt32BE(0x0488b21e, 0);
  return b58.encode(buffer);
}
