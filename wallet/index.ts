import crypto from 'crypto';
import * as bip39 from 'bip39';
import * as btc from '@scure/btc-signer';
import { hex } from '@scure/base';
import * as secp256k1 from '@noble/secp256k1';
import { payments, networks, ECPair, bip32 } from 'bitcoinjs-lib';
import {
  ChainID,
  publicKeyToString,
  getPublicKey,
  createStacksPrivateKey,
} from '@stacks/transactions';
import {
  ENTROPY_BYTES,
} from '../constant';
import { NetworkType } from 'types/network';
import { BaseWallet } from 'types/wallet';
import { getBtcNetwork } from '../transactions/btcNetwork';
import { deriveStxAddressChain } from './utils/stx';
import { getBitcoinDerivationPath, getSegwitDerivationPath, getTaprootDerivationPath } from './utils/btc';


export async function walletFromSeedPhrase({
  mnemonic,
  index,
  network,
}: {
  mnemonic: string;
  index: bigint;
  network: NetworkType;
}): Promise<BaseWallet> {
  const seed = await bip39.mnemonicToSeed(mnemonic);
  const rootNode = bip32.fromSeed(Buffer.from(seed));
  let bitcoinNetwork: networks.Network;

  switch (network) {
    case 'Mainnet':
      bitcoinNetwork = networks.bitcoin;
      break;
    case 'Testnet':
      bitcoinNetwork = networks.testnet;
      break;
    case 'Regtest':
      bitcoinNetwork = networks.regtest;
      break;
    default:
      throw new Error('Invalid network provided.');
  }

  const deriveStxAddressKeychain = deriveStxAddressChain(
    network === 'Mainnet' ? ChainID.Mainnet : ChainID.Testnet,
    index
  );

  const { address, privateKey } = deriveStxAddressKeychain(rootNode);
  const stxAddress = address;

  const master = bip32.fromSeed(seed);
  const masterPubKey = master.publicKey.toString('hex');
  const stxPublicKey = publicKeyToString(getPublicKey(createStacksPrivateKey(privateKey)));

  // derive segwit btc address
  const btcChild = master.derivePath(getBitcoinDerivationPath({ index, network }));
  const keyPair = ECPair.fromPrivateKey(btcChild.privateKey!);

  // derive native segwit btc address
  const nativeSegwitBtcChild = master.derivePath(getSegwitDerivationPath({ index, network }));
  const nativeSegwitBtcAddressKeypair = ECPair.fromPrivateKey(nativeSegwitBtcChild.privateKey!);

  const nativeSegwitBtcAddress = payments.p2wpkh({
    pubkey: nativeSegwitBtcAddressKeypair.publicKey,
    network: bitcoinNetwork,
  });

  const mainBtcAddress = nativeSegwitBtcAddress.address!;
  const mainBtcPublicKey = nativeSegwitBtcAddressKeypair.publicKey.toString('hex');

  // derive taproot btc address
  const taprootBtcChild = master.derivePath(getTaprootDerivationPath({ index, network }));
  const privKey = hex.decode(taprootBtcChild.privateKey!.toString('hex'));
  const btcNetwork = getBtcNetwork(network);
  const ordinalsAddress = btc.getAddress('tr', privKey, btcNetwork)!;

  const segwitBtcAddress = payments.p2sh({
    redeem: payments.p2wpkh({
      pubkey: keyPair.publicKey,
      network: bitcoinNetwork,
    }),
    pubkey: keyPair.publicKey,
    network: bitcoinNetwork,
  });

  const btcAddress = segwitBtcAddress.address!;
  const btcPublicKey = keyPair.publicKey.toString('hex');
  const taprootInternalPubKey = secp256k1.schnorr.getPublicKey(privKey);

  return {
    stxAddress,
    btcAddress,
    mainBtcAddress,
    mainBtcPublicKey,
    ordinalsAddress,
    masterPubKey,
    stxPublicKey,
    btcPublicKey,
    ordinalsPublicKey: hex.encode(taprootInternalPubKey),
    seedPhrase: mnemonic,
  };
}


export async function newWallet(): Promise<BaseWallet> {
  const entropy = crypto.randomBytes(ENTROPY_BYTES);
  const mnemonic = bip39.entropyToMnemonic(entropy);
  return walletFromSeedPhrase({ mnemonic, index: 0n, network: 'Mainnet' });
}

export * from './helper';
export * from './utils/btc';
export * from './utils/stx';
