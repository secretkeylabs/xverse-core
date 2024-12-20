import * as ecc from '@bitcoinerlab/secp256k1';
import { makeDIDFromAddress } from '@stacks/auth';
import { publicKeyToBtcAddress } from '@stacks/encryption';
import StacksApp from '@zondax/ledger-stacks';
import base64url from 'base64url';
import { initEccLib, networks, payments } from 'bitcoinjs-lib';
import ecdsaFormat from 'ecdsa-sig-formatter';
import { AppClient } from 'ledger-bitcoin';
import { uuid } from 'uuidv4';
import { NetworkType } from '../types/network';
import { bip32 } from '../utils/bip32';
import { LedgerStxJWTAuthProfile, Transport } from './types';

/**
 * This function is used to get the coin type depending on network type
 * @param network - the network type
 * @returns coin type in number format
 **/
export const getCoinType = (network: NetworkType) => (network === 'Mainnet' ? 0 : 1);

/**
 * This function is used to get the STX path depending on account index and address index
 * @param accountIndex - the account index of the account to sign with
 * @param addressIndex - the index of the account address to sign with
 * @returns path in string format
 **/
export const getStxPath = ({ accountIndex, addressIndex }: { addressIndex: number; accountIndex: number }) => {
  return `m/44'/5757'/${accountIndex}'/0/${addressIndex}`;
};

/**
 * This function is used to get the master fingerprint from the ledger
 * @param transport - the transport object with connected ledger device
 * @returns master key fingerprint as a string of 8 hexadecimal digits
 * */
export async function getMasterFingerPrint(transport: Transport): Promise<string> {
  const app = new AppClient(transport);
  const masterFingerPrint = await app.getMasterFingerprint();
  return masterFingerPrint;
}

/**
  This function is used to get the public key from the xpub at a given index
  @param xpub - the extended public key - compressed
  @param index - the address index
  @param network - the network type
  @returns the public key in compressed format
**/
export function getPublicKeyFromXpubAtIndex(xpub: string, index: number, network: NetworkType): Buffer {
  const btcNetwork =
    network === 'Mainnet' ? networks.bitcoin : network === 'Regtest' ? networks.regtest : networks.testnet;
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
  const btcNetwork =
    network === 'Mainnet' ? networks.bitcoin : network === 'Regtest' ? networks.regtest : networks.testnet;
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
 * This function is used to create a ledger compatible unsigned auth response payload
 * @param dataPublicKey - the public key of the identity chain
 * @param profile - the auth profile
 * @returns the unsigned auth response payload
 * */
export async function makeLedgerCompatibleUnsignedAuthResponsePayload(
  dataPublicKey: string,
  profile: LedgerStxJWTAuthProfile,
): Promise<string> {
  const address = publicKeyToBtcAddress(dataPublicKey);

  if (!address) {
    throw new Error("Can't create address from public key");
  }

  const expiresAt = new Date().getTime() + 30 * 24 * 60 * 60 * 1000;
  const payload = {
    jti: uuid(),
    iat: Math.floor(new Date().getTime() / 1000), // JWT times are in seconds
    exp: Math.floor(expiresAt / 1000), // JWT times are in seconds
    iss: makeDIDFromAddress(address),
    public_keys: [dataPublicKey],
    profile,
  };

  const header = { typ: 'JWT', alg: 'ES256K' };

  const formedHeader = base64url.encode(JSON.stringify(header));

  const formedPayload = base64url.encode(JSON.stringify(payload));

  const inputToSign = [formedHeader, formedPayload].join('.');

  return inputToSign;
}

/**
 * This function is used to sign a Stacks JWT with the Ledger
 * @param transport - the transport object with a connected ledger
 * @param accountIndex - the account index to sign with
 * @param payload - the payload to sign
 * @returns the signed JWT
 * */
export async function signStxJWTAuth(transport: Transport, accountIndex: number, payload: string) {
  const appStacks = new StacksApp(transport);
  const response = await appStacks.sign_jwt(`m/888'/0'/${accountIndex}'`, payload);

  const resultingSig = ecdsaFormat.derToJose(Buffer.from(response.signatureDER), 'ES256');
  return [payload, resultingSig].join('.');
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
    network: network === 'Mainnet' ? networks.bitcoin : network === 'Regtest' ? networks.regtest : networks.testnet,
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
