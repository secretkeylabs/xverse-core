import crypto from 'crypto';
import * as bip39 from 'bip39';
import { hashMessage } from "@stacks/encryption";
import {
  BTC_PATH_WITHOUT_INDEX,
  BTC_TESTNET_PATH_WITHOUT_INDEX,
  BTC_TAPROOT_PATH_WITHOUT_INDEX,
  BTC_TAPROOT_TESTNET_PATH_WITHOUT_INDEX,
  ENTROPY_BYTES,
  STX_PATH_WITHOUT_INDEX,
  BTC_WRAPPED_SEGWIT_PATH_PURPOSE,
  BTC_SEGWIT_PATH_PURPOSE,
  BTC_TAPROOT_PATH_PURPOSE
} from '../constant';
import {
  ChainID,
  publicKeyToString,
  getPublicKey,
  createStacksPrivateKey,
  getAddressFromPrivateKey,
  TransactionVersion,
  AddressVersion,
} from '@stacks/transactions';
import { payments, networks, ECPair, bip32, BIP32Interface } from 'bitcoinjs-lib';
import { NetworkType } from 'types/network';
import { c32addressDecode } from 'c32check';
import { ecPairToHexString } from './helper';
import { Keychain } from 'types/api/xverse/wallet';
import { BaseWallet } from 'types/wallet';
import { deriveWalletConfigKey } from '../gaia';
import {validate, Network as btcAddressNetwork} from 'bitcoin-address-validation';
import * as btc from 'micro-btc-signer';
import { hex } from '@scure/base';
import * as secp256k1 from '@noble/secp256k1'
import { getBtcNetwork } from '../transactions/btcNetwork';

export const derivationPaths = {
  [ChainID.Mainnet]: STX_PATH_WITHOUT_INDEX,
  [ChainID.Testnet]: STX_PATH_WITHOUT_INDEX,
};

function getDerivationPath(chain: ChainID, index: BigInt) {
  return `${derivationPaths[chain]}${index.toString()}`;
}

export function deriveStxAddressChain(chain: ChainID, index: BigInt = BigInt(0)) {
  return (rootNode: BIP32Interface) => {
    const childKey = rootNode.derivePath(getDerivationPath(chain, index));
    if (!childKey.privateKey) {
      throw new Error('Unable to derive private key from `rootNode`, bip32 master keychain');
    }
    const ecPair = ECPair.fromPrivateKey(childKey.privateKey);
    const privateKey = ecPairToHexString(ecPair);
    const txVersion =
      chain === ChainID.Mainnet ? TransactionVersion.Mainnet : TransactionVersion.Testnet;
    return {
      childKey,
      address: getAddressFromPrivateKey(privateKey, txVersion),
      privateKey,
    };
  };
}

export async function newWallet(): Promise<BaseWallet> {
  const entropy = crypto.randomBytes(ENTROPY_BYTES);
  const mnemonic = bip39.entropyToMnemonic(entropy);
  return walletFromSeedPhrase({ mnemonic, index: 0n, network: 'Mainnet' });
}

export async function walletFromSeedPhrase({
  mnemonic,
  index,
  network,
}: {
  mnemonic: string;
  index: BigInt;
  network: NetworkType;
}): Promise<BaseWallet> {
  const seed = await bip39.mnemonicToSeed(mnemonic);
  const rootNode = bip32.fromSeed(Buffer.from(seed));

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
  const nativeSegwitBtcChild = master.derivePath(getSegwitDerivationPath({ index, network}));
  const nativeSegwitBtcAddressKeypair = ECPair.fromPrivateKey(nativeSegwitBtcChild.privateKey!);

  const nativeSegwitBtcAddress = payments.p2wpkh({
    pubkey: nativeSegwitBtcAddressKeypair.publicKey,
    network: network === 'Mainnet' ? networks.bitcoin : networks.testnet,
  });

  const dlcBtcAddress = nativeSegwitBtcAddress.address!;
  const dlcBtcPublicKey = nativeSegwitBtcAddressKeypair.publicKey.toString('hex');

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

  return {
    stxAddress,
    btcAddress,
    dlcBtcAddress,
    dlcBtcPublicKey,
    ordinalsAddress,
    masterPubKey,
    stxPublicKey,
    btcPublicKey,
    ordinalsPublicKey: hex.encode(taprootInternalPubKey),
    seedPhrase: mnemonic,
  };
}

export function getBitcoinDerivationPath({ account, index, network }: { account?: BigInt, index: BigInt; network: NetworkType }) {
  const accountIndex = account ? account.toString() : '0'
  return network === 'Mainnet'
    ? `${BTC_WRAPPED_SEGWIT_PATH_PURPOSE}0'/${accountIndex}'/0/${index.toString()}`
    : `${BTC_WRAPPED_SEGWIT_PATH_PURPOSE}1'/${accountIndex}'/0/${index.toString()}`
}

export function getSegwitDerivationPath({ account, index, network }: { account?: BigInt, index: BigInt; network: NetworkType }) {
  const accountIndex = account ? account.toString() : '0'
  return network === 'Mainnet'
    ? `${BTC_SEGWIT_PATH_PURPOSE}0'/${accountIndex}'/0/${index.toString()}`
    : `${BTC_SEGWIT_PATH_PURPOSE}1'/${accountIndex}'/0/${index.toString()}`
}

export function getTaprootDerivationPath({ account, index, network }: { account?: BigInt, index: BigInt; network: NetworkType }) {
  const accountIndex = account ? account.toString() : '0'
  return network === 'Mainnet'
    ? `${BTC_TAPROOT_PATH_PURPOSE}0'/${accountIndex}'/0/${index.toString()}`
    : `${BTC_TAPROOT_PATH_PURPOSE}1'/${accountIndex}'/0/${index.toString()}`
}

export async function getBtcPrivateKey({
  seedPhrase,
  index,
  network,
}: {
  seedPhrase: string;
  index: BigInt;
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
  index: BigInt;
  network: NetworkType;
}): Promise<string> {
  const seed = await bip39.mnemonicToSeed(seedPhrase);
  const master = bip32.fromSeed(seed);

  const btcChild = master.derivePath(getTaprootDerivationPath({ index, network }));
  return btcChild.privateKey!.toString('hex');
}

export function validateStxAddress({
  stxAddress,
  network,
}: {
  stxAddress: string;
  network: NetworkType;
}) {
  try {
    const result = c32addressDecode(stxAddress);
    if (result[0] && result[1]) {
      const addressVersion = result[0];
      if (network === 'Mainnet') {
        if (
          !(
            addressVersion === AddressVersion.MainnetSingleSig ||
            addressVersion === AddressVersion.MainnetMultiSig
          )
        ) {
          return false;
        }
      } else {
        if (
          result[0] !== AddressVersion.TestnetSingleSig &&
          result[0] !== AddressVersion.TestnetMultiSig
        ) {
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

export function validateBtcAddress({
  btcAddress,
  network,
}: {
  btcAddress: string;
  network: NetworkType;
}): boolean {
  const btcNetwork =
    network === 'Mainnet' ? btcAddressNetwork.mainnet : btcAddressNetwork.testnet;
  try {
    return validate(btcAddress, btcNetwork);
  } catch (error) {
    return false;
  }
}
interface EncryptMnemonicArgs {
  password: string;
  seed: string;
  passwordHashGenerator: (password: string) => Promise<{
    salt: string;
    hash: string;
  }>;
  mnemonicEncryptionHandler: (seed: string, key: string) => Promise<Buffer>;
}

interface DecryptMnemonicArgs {
  password: string;
  encryptedSeed: string;
  passwordHashGenerator: (password: string) => Promise<{
    salt: string;
    hash: string;
  }>;
  mnemonicDecryptionHandler: (seed: Buffer | string, key: string) => Promise<string>;
}

export async function encryptMnemonicWithCallback(cb: EncryptMnemonicArgs) {
  const { mnemonicEncryptionHandler, passwordHashGenerator, password, seed } = cb;
  try {
    const { hash } = await passwordHashGenerator(password);
    const encryptedSeedBuffer = await mnemonicEncryptionHandler(seed, hash);
    return encryptedSeedBuffer.toString('hex');
  } catch (err) {
    return Promise.reject(err);
  }
}

export async function decryptMnemonicWithCallback(cb: DecryptMnemonicArgs) {
  const { mnemonicDecryptionHandler, passwordHashGenerator, password, encryptedSeed } = cb;
  try {
    const { hash } = await passwordHashGenerator(password);
    const seedPhrase = await mnemonicDecryptionHandler(encryptedSeed, hash);
    return seedPhrase;
  } catch (err) {
    return Promise.reject(err);
  }
}

export async function getStxAddressKeyChain(
  mnemonic: string,
  chainID: ChainID,
  accountIndex: number
): Promise<Keychain> {
  const seed = await bip39.mnemonicToSeed(mnemonic);
  const rootNode = bip32.fromSeed(Buffer.from(seed));
  const deriveStxAddressKeychain = deriveStxAddressChain(chainID, BigInt(accountIndex));
  return deriveStxAddressKeychain(rootNode);
}

export { hashMessage };
