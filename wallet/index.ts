import crypto from 'crypto';
import * as bip39 from 'bip39';
import * as bip32 from 'bip32';
import {
  BTC_PATH_WITHOUT_INDEX,
  BTC_TESTNET_PATH_WITHOUT_INDEX,
  ENTROPY_BYTES,
  STX_PATH_WITHOUT_INDEX,
} from '../constant';
import { deriveRootKeychainFromMnemonic } from '@stacks/keychain';
import {
  ChainID,
  publicKeyToString,
  getPublicKey,
  createStacksPrivateKey,
  getAddressFromPrivateKey,
  TransactionVersion,
} from '@stacks/transactions';
import { payments, networks, ECPair, BIP32Interface } from 'bitcoinjs-lib';

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
  network: StacksNetworkType;
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
    network === 'Mainnet' ? ChainID.Mainnet : ChainID.Testnet
    // index
  );
  const { childKey, address, privateKey } = deriveStxAddressKeychain(
    rootNode.derivePath(
      getDerivationPath(network === 'Mainnet' ? ChainID.Mainnet : ChainID.Testnet, index)
    )
  );
  const stxAddress = address;

  const seed = await bip39.mnemonicToSeed(mnemonic);
  const master = bip32.fromSeed(seed);
  const masterPubKey = master.publicKey.toString('hex');
  const stxPublicKey = publicKeyToString(getPublicKey(createStacksPrivateKey(privateKey)));

  // derive segwit btc address

  const btcChild = master.derivePath(getBitcoinDerivationPath(index, network));

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

function getBitcoinDerivationPath(index: BigInt, network: StacksNetworkType = 'Mainnet') {
  return network === 'Mainnet'
    ? `${BTC_PATH_WITHOUT_INDEX}${index.toString()}`
    : `${BTC_TESTNET_PATH_WITHOUT_INDEX}${index.toString()}`;
}

export async function getBtcPrivateKey(
  seedPhrase: string,
  index: BigInt = BigInt(0),
  network: StacksNetworkType = 'Mainnet'
): Promise<string> {
  const seed = await bip39.mnemonicToSeed(seedPhrase);
  const master = bip32.fromSeed(seed);

  const btcChild = master.derivePath(getBitcoinDerivationPath(index, network));
  return btcChild.privateKey!.toString('hex');
}

function ecPairToHexString(secretKey: ECPair.ECPairInterface) {
  const ecPointHex = secretKey.privateKey!.toString('hex');
  if (secretKey.compressed) {
    return `${ecPointHex}01`;
  } else {
    return ecPointHex;
  }
}
