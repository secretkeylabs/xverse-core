import * as ecc from '@bitcoinerlab/secp256k1';
import { BIP32Factory, BIP32Interface } from 'bip32';

export const bip32 = BIP32Factory(ecc);
export type { BIP32Interface };
