import * as ecc from '@bitcoinerlab/secp256k1';
import { initEccLib, Network, networks, payments } from 'bitcoinjs-lib';
import Bitcoin from '@keystonehq/hw-app-bitcoin';
import { BIP32Interface } from 'bip32';
import { bip32, convertZpubToXpub } from '../utils';
import { TransportWebUSB } from '@keystonehq/hw-transport-webusb';

const defaultNetwork = networks.bitcoin;

function getPathForNetwork(bipType: number, network: Network) {
  const coinType = network === networks.bitcoin ? 0 : 1;
  switch (bipType) {
    case 44:
      return `m/44'/${coinType}'/0'`;
    case 49:
      return `m/49'/${coinType}'/0'`;
    case 84:
      return `m/84'/${coinType}'/0'`;
    case 86:
      return `m/86'/${coinType}'/0'`;
    default:
      throw new Error('Unsupported BIP type');
  }
}

function getNativeSegwitKeyAndAddress(root: BIP32Interface, { subPath = '0/0', network = defaultNetwork }) {
  const child = root.derivePath(subPath);

  const { address, pubkey } = payments.p2wpkh({
    pubkey: child.publicKey,
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

function getTaprootPubkeyAndAddress(root: BIP32Interface, { subPath = '0/0', network = defaultNetwork }) {
  const child = root.derivePath(subPath);

  const pubkey = child.publicKey;
  const tweakedPubkey = ecc.xOnlyPointFromPoint(pubkey);

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

interface ImportAddressProps {
  transport: TransportWebUSB;
  network?: Network;
  addressIndex?: number;
}

export async function importNativeSegwitAccountFromKeystone({
  transport,
  network = networks.bitcoin,
  addressIndex = 0,
}: ImportAddressProps) {
  const bitcoin = new Bitcoin(transport);

  const nativeSegwitZpub = await bitcoin.getExtendedPublicKey(getPathForNetwork(84, network));
  const nativeSegwitXpub = convertZpubToXpub(nativeSegwitZpub);
  const nativeSegwitRoot = bip32.fromBase58(nativeSegwitXpub, network);
  const nativeSegwit = getNativeSegwitKeyAndAddress(nativeSegwitRoot, { subPath: `0/${addressIndex}`, network });

  return {
    xpub: nativeSegwitXpub,
    ...nativeSegwit,
  };
}

export async function importTaprootAccountFromKeystone({
  transport,
  network = networks.bitcoin,
  addressIndex = 0,
}: ImportAddressProps) {
  initEccLib(ecc);
  const bitcoin = new Bitcoin(transport);

  const taprootXpub = await bitcoin.getExtendedPublicKey(getPathForNetwork(86, network));
  const taprootRoot = bip32.fromBase58(taprootXpub, network);
  const taproot = getTaprootPubkeyAndAddress(taprootRoot, { subPath: `0/${addressIndex}`, network });

  return {
    xpub: taprootXpub,
    ...taproot,
  };
}
