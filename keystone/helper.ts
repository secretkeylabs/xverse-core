export { networks } from 'bitcoinjs-lib';
import * as ecc from '@bitcoinerlab/secp256k1';
import Bitcoin from '@keystonehq/hw-app-bitcoin';
import * as bip32 from '@scure/bip32';
import { initEccLib, networks, payments } from 'bitcoinjs-lib';
import { NetworkType } from '../types/network';
import { KeystoneTransport } from './types';

export async function getMasterFingerPrintFromKeystone(transport: KeystoneTransport): Promise<string> {
  const app = new Bitcoin(transport);
  const masterFingerPrint = await app.getMasterFingerprint();
  return masterFingerPrint;
}

/**
 * This function is used to get the coin type depending on network type
 * @param network - the network type
 * @returns coin type in number format
 **/
export const getCoinType = (network: NetworkType) => (network === 'Mainnet' ? 0 : 1);

/**
  This function is used to get the public key from the xpub at a given index
  @param xpub - the extended public key - compressed
  @param index - the address index
  @param network - the network type
  @returns the public key in compressed format
**/
export function getPublicKeyFromXpubAtIndex(xpub: string, index: number): Buffer {
  const { publicKey } = bip32.HDKey.fromExtendedKey(xpub).derive(`0/${index}`);
  return Buffer.from(publicKey!);
}

/**
 * This function is used to get the native segwit account data from the xpub at a given index
 * @param xpub - the extended public key - compressed
 * @param index - the address index
 * @param network - the network type
 * @returns the public key in compressed format, the address and the witness script
 * */
export function getNativeSegwitAccountDataFromXpub(
  xpub: string,
  index: number,
  network: NetworkType,
): {
  publicKey: Buffer;
  address: string;
  witnessScript: Buffer;
} {
  initEccLib(ecc);

  const publicKey = getPublicKeyFromXpubAtIndex(xpub, index);
  const btcNetwork = network === 'Mainnet' ? networks.bitcoin : networks.testnet;
  const p2wpkh = payments.p2wpkh({ pubkey: publicKey, network: btcNetwork });
  const address = p2wpkh.address;

  if (!address) {
    throw new Error('Address is null');
  }

  if (!p2wpkh.output) {
    throw new Error('p2wpkh output is null');
  }

  return {
    publicKey,
    address,
    witnessScript: p2wpkh.output,
  };
}

/**
 * This function is used to get the taproot account data from the xpub at a given index
 * @param xpub - the extended public key - compressed
 * @param index - the address index
 * @param network - the network type
 * @returns the public key in compressed format, the address, the internal public key and the taproot script
 * */
export function getTaprootAccountDataFromXpub(
  xpub: string,
  index: number,
  network: NetworkType,
): {
  publicKey: Buffer;
  address: string;
  internalPubkey: Buffer;
  taprootScript: Buffer;
} {
  initEccLib(ecc);

  const publicKey = getPublicKeyFromXpubAtIndex(xpub, index);
  const p2tr = payments.p2tr({
    internalPubkey: publicKey.slice(1),
    network: network === 'Mainnet' ? networks.bitcoin : networks.testnet,
  });

  if (!p2tr.output || !p2tr.address || !p2tr.internalPubkey) {
    throw new Error('p2tr output, address or internalPubkey is null');
  }

  return {
    publicKey,
    address: p2tr.address,
    internalPubkey: p2tr.internalPubkey,
    taprootScript: p2tr.output,
  };
}
