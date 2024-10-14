export { networks } from 'bitcoinjs-lib';
import * as ecc from '@bitcoinerlab/secp256k1';
import Bitcoin from '@keystonehq/hw-app-bitcoin';
import { TransportWebUSB } from '@keystonehq/hw-transport-webusb';
import { NetworkType } from '../types/network';
import { initEccLib, networks, payments } from 'bitcoinjs-lib';
import { bip32 } from '../utils';

export async function getMasterFingerPrintFromKeystone(transport: TransportWebUSB): Promise<string> {
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
export function getPublicKeyFromXpubAtIndex(xpub: string, index: number, network: NetworkType): Buffer {
  const btcNetwork = network === 'Mainnet' ? networks.bitcoin : networks.testnet;
  const { publicKey } = bip32.fromBase58(xpub, btcNetwork).derivePath(`0/${index}`);
  return publicKey;
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

  const publicKey = getPublicKeyFromXpubAtIndex(xpub, index, network);
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

  const publicKey = getPublicKeyFromXpubAtIndex(xpub, index, network);
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
