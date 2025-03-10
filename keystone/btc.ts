import * as ecc from '@bitcoinerlab/secp256k1';
import Bitcoin from '@keystonehq/hw-app-bitcoin';
import { sha256 } from '@noble/hashes/sha256';
import { createBase58check } from '@scure/base';
import * as bip32 from '@scure/bip32';
import { initEccLib, Network, networks, payments } from 'bitcoinjs-lib';
import { NetworkType } from '../types';
import { bip32Utils } from '../utils/bip32';
import { KeystoneTransport } from './types';

const base58check = createBase58check(sha256);

function convertZpubToXpub(zpub: string, network: Network): string {
  const data = base58check.decode(zpub);
  const buffer = Buffer.from(data);
  buffer.writeUInt32BE(network.bip32.public, 0);
  return base58check.encode(buffer);
}

function getPathForNetwork(bipType: number, accountIndex: number, network: Network) {
  const coinType = network === networks.bitcoin ? 0 : 1;
  switch (bipType) {
    case 44:
      return `m/44'/${coinType}'/${accountIndex}'`;
    case 49:
      return `m/49'/${coinType}'/${accountIndex}'`;
    case 84:
      return `m/84'/${coinType}'/${accountIndex}'`;
    case 86:
      return `m/86'/${coinType}'/${accountIndex}'`;
    default:
      throw new Error('Unsupported BIP type');
  }
}

function getNativeSegwitKeyAndAddress(
  root: bip32.HDKey,
  { subPath, network }: { subPath: `m/${string}`; network: Network },
) {
  const child = root.derive(subPath);

  const { address, pubkey } = payments.p2wpkh({
    pubkey: Buffer.from(child.publicKey!),
    network,
  });

  if (!address) {
    throw new Error('Unable to get Native Segwit address');
  }

  if (!pubkey) {
    throw new Error('Unable to get Native Segwit public key');
  }

  return {
    address,
    publicKey: Buffer.from(pubkey).toString('hex'),
  };
}

function getTaprootPubkeyAndAddress(
  root: bip32.HDKey,
  { subPath, network }: { subPath: `m/${string}`; network: Network },
) {
  const child = root.derive(subPath);

  const pubkey = child.publicKey!;
  const tweakedPubkey = ecc.xOnlyPointFromPoint(Buffer.from(pubkey));

  const { address } = payments.p2tr({
    internalPubkey: Buffer.from(tweakedPubkey),
    network,
  });

  if (!address) {
    throw new Error('Unable to get Taproot address');
  }
  if (!pubkey) {
    throw new Error('Unable to get Taproot public key');
  }

  return {
    address,
    publicKey: Buffer.from(pubkey).toString('hex'),
  };
}

const getNetworkFromNetworkType = (networkType: NetworkType) =>
  networkType === 'Mainnet' ? networks.bitcoin : networks.testnet;

interface ImportAddressProps {
  transport: KeystoneTransport;
  network: NetworkType;
  accountIndex?: number;
  addressIndex?: number;
}

export async function importNativeSegwitAccountFromKeystone({
  transport,
  network: networkType,
  accountIndex = 0,
  addressIndex = 0,
}: ImportAddressProps) {
  const network = getNetworkFromNetworkType(networkType);
  const bitcoin = new Bitcoin(transport);

  const nativeSegwitZpub = await bitcoin.getExtendedPublicKey(getPathForNetwork(84, accountIndex, network));
  const nativeSegwitXpub = convertZpubToXpub(nativeSegwitZpub, network);
  const nativeSegwitRoot = bip32Utils.fromExtendedKey(nativeSegwitXpub);
  const nativeSegwit = getNativeSegwitKeyAndAddress(nativeSegwitRoot, { subPath: `m/0/${addressIndex}`, network });

  return {
    xpub: nativeSegwitXpub,
    ...nativeSegwit,
  };
}

export async function importTaprootAccountFromKeystone({
  transport,
  network: networkType,
  accountIndex = 0,
  addressIndex = 0,
}: ImportAddressProps) {
  initEccLib(ecc);
  const network = getNetworkFromNetworkType(networkType);
  const bitcoin = new Bitcoin(transport);

  const taprootXpub = await bitcoin.getExtendedPublicKey(getPathForNetwork(86, accountIndex, network));
  const taprootRoot = bip32Utils.fromExtendedKey(taprootXpub);
  const taproot = getTaprootPubkeyAndAddress(taprootRoot, { subPath: `m/0/${addressIndex}`, network });

  return {
    xpub: taprootXpub,
    ...taproot,
  };
}
