import { hex } from '@scure/base';
import * as bip32 from '@scure/bip32';
import * as bip39 from '@scure/bip39';
import * as btc from '@scure/btc-signer';
import { vi } from 'vitest';
import { UtxoCache } from '../../../api';
import EsploraProvider from '../../../api/esplora/esploraAPiProvider';
import { SeedVault } from '../../../seedVault';
import { AddressContext } from '../../../transactions/bitcoin/context';
import type { SupportedAddressType } from '../../../transactions/bitcoin/types';

export const seedPhrase = 'action action action action action action action action action action action action';
export const rootKeyPair = bip32.HDKey.fromMasterSeed(bip39.mnemonicToSeedSync(seedPhrase));

const createAddressItem = (index: number) => {
  const native = rootKeyPair.derive(`m/84'/0'/0'/0/${index}`);
  const p2Native = btc.p2wpkh(native.publicKey!);

  const nested = rootKeyPair.derive(`m/49'/0'/0'/0/${index}`);
  const p2NestedRedeem = btc.p2wpkh(nested.publicKey!);
  const p2Nested = btc.p2sh(p2NestedRedeem);

  const taproot = rootKeyPair.derive(`m/86'/0'/0'/0/${index}`);
  const p2Taproot = btc.p2tr(taproot.publicKey!.subarray(1));

  return {
    nativeSegwit: p2Native.address!,
    nativeSegwitPubKey: hex.encode(native.publicKey!),
    nativeSegwitSigner: native.privateKey!,
    nativeP2: p2Native,

    nestedSegwit: p2Nested.address!,
    nestedSegwitPubKey: hex.encode(nested.publicKey!),
    nestedSegwitSigner: nested.privateKey!,
    nestedP2: p2Nested,

    taproot: p2Taproot.address!,
    taprootPubKey: hex.encode(taproot.publicKey!),
    taprootSigner: taproot.privateKey!,
    taprootP2: p2Taproot,
  };
};

export const addresses = [createAddressItem(0), createAddressItem(1), createAddressItem(2)];

export class TestAddressContext extends AddressContext {
  constructor(
    type: SupportedAddressType,
    address: string,
    publicKey: string,
    accountIndex: number,
    seedVault: SeedVault,
    utxoCache: UtxoCache,
    esploraProvider: EsploraProvider,
  ) {
    super(type, address, publicKey, 'Mainnet', accountIndex, seedVault, utxoCache, esploraProvider);
  }

  getUtxos = vi.fn();

  getCommonUtxos = vi.fn();

  getEmbellishedUtxos = vi.fn();

  getUtxo = vi.fn();

  getPrivateKey = vi.fn();

  getDerivationPath = vi.fn();

  addInput = vi.fn();

  signInputs = vi.fn();

  toDummyInputs = vi.fn();

  getIOSizes = vi.fn();
}
