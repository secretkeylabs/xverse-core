import { bytesToHex } from '@stacks/transactions';
import { WALLET_CONFIG_PATH } from '../constant';
import { BIP32Interface } from 'bip32';

export function ecPairToHexString(secretKey: any) {
  var ecPointHex = secretKey.privateKey.toString('hex');
  if (secretKey.compressed) {
    return ecPointHex + '01';
  } else {
    return ecPointHex;
  }
}

export const deriveConfigPrivateKey = (rootNode: BIP32Interface): Uint8Array => {
  const derivedConfigKey = rootNode.derivePath(WALLET_CONFIG_PATH).privateKey;
  if (!derivedConfigKey) throw new TypeError('Unable to derive config key for wallet identities');
  return derivedConfigKey;
};

export async function deriveWalletConfigKey(rootNode: BIP32Interface): Promise<string> {
  return bytesToHex(deriveConfigPrivateKey(rootNode));
}
