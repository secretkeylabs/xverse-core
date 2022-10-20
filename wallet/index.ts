import crypto from 'crypto';
import * as bip39 from 'bip39';
import * as bip32 from 'bip32';
import {
  BTC_PATH_WITHOUT_INDEX,
  BTC_TESTNET_PATH_WITHOUT_INDEX,
  ENTROPY_BYTES,
  STX_PATH_WITHOUT_INDEX,
} from '../constant';
import { deriveRootKeychainFromMnemonic } from '@stacks/keychain/dist/esm';
import {
  ChainID,
  publicKeyToString,
  getPublicKey,
  createStacksPrivateKey,
  getAddressFromPrivateKey,
  TransactionVersion,
  AddressVersion,
} from '@stacks/transactions/dist/esm';
import { payments, networks, ECPair, BIP32Interface } from 'bitcoinjs-lib';
import { NetworkType } from 'types';
import { c32addressDecode } from 'c32check';
import * as bitcoin from 'bitcoinjs-lib';
import { ecPairToHexString } from './helper';

export const derivationPaths = {
  [ChainID.Mainnet]: STX_PATH_WITHOUT_INDEX,
  [ChainID.Testnet]: STX_PATH_WITHOUT_INDEX,
};

function getDerivationPath(chain: ChainID, index: BigInt) {
  return `${derivationPaths[chain]}${index.toString()}`;
}

function deriveStxAddressChain(chain: ChainID, index: BigInt = BigInt(0)) {
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

export async function newWallet(): Promise<{
  stxAddress: string;
  btcAddress: string;
  masterPubKey: string;
  stxPublicKey: string;
  btcPublicKey: string;
  seedPhrase: string;
}> {
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
}): Promise<{
  stxAddress: string;
  btcAddress: string;
  masterPubKey: string;
  stxPublicKey: string;
  btcPublicKey: string;
  seedPhrase: string;
}> {
  const rootNode = await deriveRootKeychainFromMnemonic(mnemonic);
  const deriveStxAddressKeychain = deriveStxAddressChain(
    network === 'Mainnet' ? ChainID.Mainnet : ChainID.Testnet,
    index,
  );
  const {address, privateKey} = deriveStxAddressKeychain(rootNode);
  const stxAddress = address;

  const seed = await bip39.mnemonicToSeed(mnemonic);
  const master = bip32.fromSeed(seed);
  const masterPubKey = master.publicKey.toString('hex');
  const stxPublicKey = publicKeyToString(getPublicKey(createStacksPrivateKey(privateKey)));

  // derive segwit btc address

  const btcChild = master.derivePath(getBitcoinDerivationPath({ index, network }));

  const keyPair = ECPair.fromPrivateKey(btcChild.privateKey!);
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
  return {
    stxAddress,
    btcAddress,
    masterPubKey,
    stxPublicKey,
    btcPublicKey,
    seedPhrase: mnemonic,
  };
}

function getBitcoinDerivationPath({ index, network }: { index: BigInt; network: NetworkType }) {
  return network === 'Mainnet'
    ? `${BTC_PATH_WITHOUT_INDEX}${index.toString()}`
    : `${BTC_TESTNET_PATH_WITHOUT_INDEX}${index.toString()}`;
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
  const btcNetwork = network === 'Mainnet' ? bitcoin.networks.bitcoin : bitcoin.networks.testnet;
  try {
    bitcoin.address.toOutputScript(btcAddress, btcNetwork);
    return true;
  } catch (error) {
    return false;
  }
}
interface EncryptMnemonicArgs {
  password: string,
  seed: string,
  passwordHashGenerator: (password: string) => Promise<{
    salt: string,
    hash: string,
  }>
  mnemonicEncryptionHandler: (seed: string, key: string) => Promise<Buffer>
}

interface DecryptMnemonicArgs {
  password: string,
  encryptedSeed: string,
  passwordHashGenerator: (password: string) => Promise<{
    salt: string,
    hash: string,
  }>
  mnemonicDecryptionHandler: (seed: Buffer | string, key: string) => Promise<string>
}

export async function encryptMnemonicWithCallback(cb: EncryptMnemonicArgs) {
  const {
    mnemonicEncryptionHandler,
    passwordHashGenerator,
    password,
    seed,
  } = cb;
  try {
    const { hash } = await passwordHashGenerator(password);
    const encryptedSeedBuffer = await mnemonicEncryptionHandler(seed, hash);
    return encryptedSeedBuffer.toString('hex');
  } catch(err) {
    return Promise.reject(err)
  }
}


export async function decryptMnemonicWithCallback(cb: DecryptMnemonicArgs) {
  const {
    mnemonicDecryptionHandler,
    passwordHashGenerator,
    password,
    encryptedSeed,
  } = cb;
  try {
    const { hash } = await passwordHashGenerator(password);
    const seedPhrase = await mnemonicDecryptionHandler(encryptedSeed, hash);
    return seedPhrase;
  } catch(err) {
    return Promise.reject(err)
  }
}