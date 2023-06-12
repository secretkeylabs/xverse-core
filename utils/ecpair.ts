import * as ecc from '@bitcoinerlab/secp256k1';
import { ECPairFactory, ECPairInterface } from 'ecpair';

export const ECPair = ECPairFactory(ecc);
export type { ECPairInterface };
