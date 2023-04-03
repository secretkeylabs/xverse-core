import { 
  NetworkType, 
  Account
} from '../types';
import { getSigningDerivationPath } from './helper';
import * as btc from 'micro-btc-signer';
import { hex, base64 } from '@scure/base';
import * as bip39 from 'bip39';
import { bip32 } from 'bitcoinjs-lib';
import * as secp256k1 from '@noble/secp256k1'

import { getBtcNetwork } from './btcNetwork';

export async function signMessageBip340(
  seedPhrase: string,
  accounts: Array<Account>, 
  address: string,
  messageHash: string,
  network?: NetworkType
) : Promise<string> {
  const networkType = network ?? "Mainnet";

  const seed = await bip39.mnemonicToSeed(seedPhrase);
  const master = bip32.fromSeed(seed);
  const signingDerivationPath = getSigningDerivationPath(accounts, address, networkType);
  const child = master.derivePath(signingDerivationPath);
  const privateKey = child.privateKey!.toString('hex');

  const signature = await secp256k1.schnorr.sign(
    hex.decode(messageHash), 
    hex.decode(privateKey)
  );

  return hex.encode(signature);
}
