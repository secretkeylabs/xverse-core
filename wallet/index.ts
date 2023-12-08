/* eslint-disable @typescript-eslint/no-use-before-define */
import * as secp256k1 from '@noble/secp256k1';
import { hex } from '@scure/base';
import * as btc from '@scure/btc-signer';
import { hashMessage } from '@stacks/encryption';
import {
  AddressVersion,
  ChainID,
  TransactionVersion,
  createStacksPrivateKey,
  getAddressFromPrivateKey,
  getPublicKey,
  publicKeyToString,
} from '@stacks/transactions';
import * as bip39 from 'bip39';
import { AddressType, Network as btcAddressNetwork, getAddressInfo, validate } from 'bitcoin-address-validation';
import { networks, payments } from 'bitcoinjs-lib';
import { c32addressDecode } from 'c32check';
import crypto from 'crypto';
import {
  BTC_SEGWIT_PATH_PURPOSE,
  BTC_TAPROOT_PATH_PURPOSE,
  BTC_WRAPPED_SEGWIT_PATH_PURPOSE,
  ENTROPY_BYTES,
  STX_PATH_WITHOUT_INDEX,
} from '../constant';
import { getBtcNetwork } from '../transactions/btcNetwork';
import { BaseWallet, Keychain, NetworkType } from '../types';
import { BIP32Interface, bip32 } from '../utils/bip32';
import { ECPair } from '../utils/ecpair';
import { ecPairToHexString } from './helper';

export * from './encryptionUtils';
export { hashMessage };

export const derivationPaths = {
  [ChainID.Mainnet]: STX_PATH_WITHOUT_INDEX,
  [ChainID.Testnet]: STX_PATH_WITHOUT_INDEX,
};

function getDerivationPath(chain: ChainID, index: bigint) {
  return `${derivationPaths[chain]}${index.toString()}`;
}

export function deriveStxAddressChain(chain: ChainID, index = 0n) {
  return (rootNode: BIP32Interface) => {
    const childKey = rootNode.derivePath(getDerivationPath(chain, index));
    if (!childKey.privateKey) {
      throw new Error('Unable to derive private key from `rootNode`, bip32 master keychain');
    }
    const ecPair = ECPair.fromPrivateKey(childKey.privateKey);
    const privateKey = ecPairToHexString(ecPair);
    const txVersion = chain === ChainID.Mainnet ? TransactionVersion.Mainnet : TransactionVersion.Testnet;
    return {
      childKey,
      address: getAddressFromPrivateKey(privateKey, txVersion),
      privateKey,
    };
  };
}

export function generateMnemonic(): string {
  const entropy = crypto.randomBytes(ENTROPY_BYTES);
  const mnemonic = bip39.entropyToMnemonic(entropy);

  return mnemonic;
}

export async function newWallet(): Promise<BaseWallet> {
  const mnemonic = generateMnemonic();
  return walletFromSeedPhrase({ mnemonic, index: 0n, network: 'Mainnet' });
}

export async function getWalletFromRootNode({
  index,
  network,
  rootNode,
  master,
}: {
  index: bigint;
  network: NetworkType;
  rootNode: BIP32Interface;
  master: BIP32Interface;
}): Promise<Omit<BaseWallet, 'masterPubKey' | 'seedPhrase'>> {
  const deriveStxAddressKeychain = deriveStxAddressChain(
    network === 'Mainnet' ? ChainID.Mainnet : ChainID.Testnet,
    index,
  );

  const { address, privateKey } = await deriveStxAddressKeychain(rootNode);
  const stxAddress = address;

  const stxPublicKey = publicKeyToString(getPublicKey(createStacksPrivateKey(privateKey)));

  // derive segwit btc address
  const btcChild = master.derivePath(getBitcoinDerivationPath({ index, network }));
  const keyPair = ECPair.fromPrivateKey(btcChild.privateKey!);

  // derive taproot btc address
  const taprootBtcChild = master.derivePath(getTaprootDerivationPath({ index, network }));
  const privKey = hex.decode(taprootBtcChild.privateKey!.toString('hex'));
  const btcNetwork = getBtcNetwork(network);
  const ordinalsAddress = btc.getAddress('tr', privKey, btcNetwork)!;

  const segwitBtcAddress = payments.p2sh({
    redeem: payments.p2wpkh({
      pubkey: keyPair.publicKey,
      network: network === 'Mainnet' ? networks.bitcoin : networks.testnet,
    }),
    pubkey: keyPair.publicKey,
    network: network === 'Mainnet' ? networks.bitcoin : networks.testnet,
  });
  const btcAddress = segwitBtcAddress.address!;
  const btcPublicKey = keyPair.publicKey.toString('hex');
  const taprootInternalPubKey = secp256k1.schnorr.getPublicKey(privKey);
  const ordinalsPublicKey = hex.encode(taprootInternalPubKey);

  return {
    stxAddress,
    btcAddress,
    ordinalsAddress,
    stxPublicKey,
    btcPublicKey,
    ordinalsPublicKey,
    accountType: 'software',
  };
}

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

  const master = bip32.fromSeed(seed);
  const masterPubKey = master.publicKey.toString('hex');

  const wallet = await getWalletFromRootNode({
    index,
    network,
    rootNode,
    master,
  });

  return {
    stxAddress: wallet.stxAddress,
    btcAddress: wallet.btcAddress,
    ordinalsAddress: wallet.ordinalsAddress,
    masterPubKey,
    stxPublicKey: wallet.stxPublicKey,
    btcPublicKey: wallet.btcPublicKey,
    ordinalsPublicKey: wallet.ordinalsPublicKey,
    seedPhrase: mnemonic,
    accountType: wallet.accountType,
  };
}

export function getBitcoinDerivationPath({
  account,
  index,
  network,
}: {
  account?: bigint;
  index: bigint | number;
  network: NetworkType;
}) {
  const accountIndex = account ? account.toString() : '0';
  return network === 'Mainnet'
    ? `${BTC_WRAPPED_SEGWIT_PATH_PURPOSE}0'/${accountIndex}'/0/${index.toString()}`
    : `${BTC_WRAPPED_SEGWIT_PATH_PURPOSE}1'/${accountIndex}'/0/${index.toString()}`;
}

export function getSegwitDerivationPath({
  account,
  index,
  network,
}: {
  account?: bigint;
  index: bigint | number;
  network: NetworkType;
}) {
  const accountIndex = account ? account.toString() : '0';
  return network === 'Mainnet'
    ? `${BTC_SEGWIT_PATH_PURPOSE}0'/${accountIndex}'/0/${index.toString()}`
    : `${BTC_SEGWIT_PATH_PURPOSE}1'/${accountIndex}'/0/${index.toString()}`;
}

export function getTaprootDerivationPath({
  account,
  index,
  network,
}: {
  account?: bigint;
  index: bigint | number;
  network: NetworkType;
}) {
  const accountIndex = account ? account.toString() : '0';
  return network === 'Mainnet'
    ? `${BTC_TAPROOT_PATH_PURPOSE}0'/${accountIndex}'/0/${index.toString()}`
    : `${BTC_TAPROOT_PATH_PURPOSE}1'/${accountIndex}'/0/${index.toString()}`;
}

export async function getBtcPrivateKey({
  seedPhrase,
  index,
  network,
}: {
  seedPhrase: string;
  index: bigint;
  network: NetworkType;
}): Promise<string> {
  const seed = await bip39.mnemonicToSeed(seedPhrase);
  const master = bip32.fromSeed(seed);

  const btcChild = master.derivePath(getBitcoinDerivationPath({ index, network }));
  return btcChild.privateKey!.toString('hex');
}

export async function getBtcTaprootPrivateKey({
  seedPhrase,
  index,
  network,
}: {
  seedPhrase: string;
  index: bigint;
  network: NetworkType;
}): Promise<string> {
  const seed = await bip39.mnemonicToSeed(seedPhrase);
  const master = bip32.fromSeed(seed);

  const btcChild = master.derivePath(getTaprootDerivationPath({ index, network }));
  return btcChild.privateKey!.toString('hex');
}

export function validateStxAddress({ stxAddress, network }: { stxAddress: string; network: NetworkType }) {
  try {
    const result = c32addressDecode(stxAddress);
    if (result[0] && result[1]) {
      const addressVersion = result[0];
      if (network === 'Mainnet') {
        if (
          !(addressVersion === AddressVersion.MainnetSingleSig || addressVersion === AddressVersion.MainnetMultiSig)
        ) {
          return false;
        }
      } else {
        if (result[0] !== AddressVersion.TestnetSingleSig && result[0] !== AddressVersion.TestnetMultiSig) {
          return false;
        }
      }

      return true;
    }
    return false;
  } catch (error) {
    return false;
  }
}

export function validateBtcAddress({ btcAddress, network }: { btcAddress: string; network: NetworkType }): boolean {
  const btcNetwork = network === 'Mainnet' ? btcAddressNetwork.mainnet : btcAddressNetwork.testnet;
  try {
    return validate(btcAddress, btcNetwork);
  } catch (error) {
    return false;
  }
}

export async function getStxAddressKeyChain(
  mnemonic: string,
  chainID: ChainID,
  accountIndex: number,
): Promise<Keychain> {
  const seed = await bip39.mnemonicToSeed(mnemonic);
  const rootNode = bip32.fromSeed(Buffer.from(seed));
  const deriveStxAddressKeychain = deriveStxAddressChain(chainID, BigInt(accountIndex));
  return deriveStxAddressKeychain(rootNode);
}

export const validateBtcAddressIsTaproot = (btcAddress: string): boolean => {
  try {
    return getAddressInfo(btcAddress)?.type === AddressType.p2tr;
  } catch {
    return false;
  }
};
