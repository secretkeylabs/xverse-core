import { NetworkType } from 'types/network';
import { networks, bip32, payments } from 'bitcoinjs-lib';
import bs58check from 'bs58check';

/**
  This function is used to get the public key from the xpub at a given index
  @param xpub - the extended public key - compressed
  @param index - the address index
  @param network - the network type
  @returns the public key in compressed format
**/
export function getPublicKeyFromXpubAtIndex(
  xpub: string,
  index: number,
  network: NetworkType
): Buffer {
  const btcNetwork = network === 'Mainnet' ? networks.bitcoin : networks.testnet;
  const { publicKey } = bip32.fromBase58(xpub, btcNetwork).derivePath(`0/${index}`);
  return publicKey;
}

/**
 * This function is used to get the nested segwit account data from the xpub at a given index
 * @param xpub - the extended public key - compressed
 * @param index - the address index
 * @param network - the network type
 * @returns the public key in compressed format, the address, the witness script and the redeem script
 * */
export function getNestedSegwitAccountDataFromXpub(
  xpub: string,
  index: number,
  network: NetworkType
): {
  publicKey: Buffer;
  address: string;
  witnessScript: Buffer;
  redeemScript: Buffer;
} {
  const publicKey = getPublicKeyFromXpubAtIndex(xpub, index, network);
  const btcNetwork = network === 'Mainnet' ? networks.bitcoin : networks.testnet;
  const p2wpkh = payments.p2wpkh({ pubkey: publicKey, network: btcNetwork });
  const p2sh = payments.p2sh({ redeem: p2wpkh, network: btcNetwork });
  const address = p2sh.address;

  if (!address) {
    throw new Error('Address is null');
  }

  if (!p2sh.output || !p2sh.redeem?.output) {
    throw new Error('p2sh output is null');
  }
  return {
    publicKey,
    address,
    witnessScript: p2sh.output,
    redeemScript: p2sh.redeem.output,
  };
}

/**
 * This function is used to decompress an extended public key
 * @param xpub - the extended public key - compressed
 * @returns the uncompressed extended public key - 78 bytes
 * */
export function decompressXpub(xpub: string): Buffer {
  return Buffer.from(bs58check.decode(xpub));
}
