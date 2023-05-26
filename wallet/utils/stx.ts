import * as bip39 from 'bip39';
import {
  AddressVersion,
  ChainID,
  TransactionVersion,
  getAddressFromPrivateKey,
} from '@stacks/transactions';
import { BIP32Interface, ECPair, bip32 } from 'bitcoinjs-lib';
import { ecPairToHexString } from '../helper';
import { STX_PATH_WITHOUT_INDEX } from '../../constant';
import { NetworkType } from '../../types/network';
import { Keychain } from '../../types/api/xverse/wallet';
import { c32addressDecode } from 'c32check';

export const stxDerivationPaths = {
  [ChainID.Mainnet]: STX_PATH_WITHOUT_INDEX,
  [ChainID.Testnet]: STX_PATH_WITHOUT_INDEX,
};

function getDerivationPath(chain: ChainID, index: bigint) {
  return `${stxDerivationPaths[chain]}${index.toString()}`;
}

export function deriveStxAddressChain(chain: ChainID, index = BigInt(0)) {
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
