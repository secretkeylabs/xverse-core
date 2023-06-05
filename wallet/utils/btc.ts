import * as bip39 from 'bip39';
import { validate, Network as btcAddressNetwork } from 'bitcoin-address-validation';
import {
  BTC_SEGWIT_PATH_PURPOSE,
  BTC_TAPROOT_PATH_PURPOSE,
  BTC_WRAPPED_SEGWIT_PATH_PURPOSE,
} from '../../constant';
import { NetworkType } from '../../types/network';
import { bip32 } from 'bitcoinjs-lib';

export function getBitcoinDerivationPath({
  account,
  index,
  network,
}: {
  account?: bigint;
  index: bigint;
  network: NetworkType;
}) {
  const accountIndex = account ? account.toString() : '0';
  return network === 'Mainnet'
    ? `${BTC_WRAPPED_SEGWIT_PATH_PURPOSE}0'/${accountIndex}'/0/${index.toString()}`
    : `${BTC_WRAPPED_SEGWIT_PATH_PURPOSE}1'/${accountIndex}'/0/${index.toString()}`;
}

export function getSegwitDerivationPath({
  index,
  network,
}: {
  index: bigint;
  network: NetworkType;
}) {
  // Final Derivation Path m/84'/0'/0'/0/0
  return network === 'Mainnet'
    ? `${BTC_SEGWIT_PATH_PURPOSE}/${index}'/0/0`
    : `${BTC_SEGWIT_PATH_PURPOSE}/${index}'/0/0`;
}

export function getTaprootDerivationPath({
  account,
  index,
  network,
}: {
  account?: bigint;
  index: bigint;
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

export async function getBtcNativeSegwitPrivateKey({
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

  const nativeSegwitBtcChild = master.derivePath(getSegwitDerivationPath({ index, network }));
  return nativeSegwitBtcChild.privateKey!.toString('hex');
}

export function validateBtcAddress({
  btcAddress,
  network,
}: {
  btcAddress: string;
  network: NetworkType;
}): boolean {
  const btcNetwork = network === 'Mainnet' ? btcAddressNetwork.mainnet : btcAddressNetwork.testnet;
  try {
    return validate(btcAddress, btcNetwork);
  } catch (error) {
    return false;
  }
}
