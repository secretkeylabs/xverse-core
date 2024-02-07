import { hashMessage } from '@stacks/encryption';
import {
  ClarityValue,
  createStacksPrivateKey,
  getPublicKey,
  publicKeyToString,
  signMessageHashRsv,
  signStructuredData,
} from '@stacks/transactions';
import { buf2hex } from '../utils/arrayBuffers';

export interface SignatureData {
  signature: string;
  publicKey: string;
}

export function signMessage(message: string, privateKey: string): SignatureData {
  const hash = hashMessage(message);
  const sk = createStacksPrivateKey(privateKey);
  return {
    signature: signMessageHashRsv({
      privateKey: sk,
      messageHash: buf2hex(hash),
    }).data,
    publicKey: publicKeyToString(getPublicKey(sk)),
  };
}

export function signStructuredDataMessage(
  message: ClarityValue,
  domain: ClarityValue,
  privateKey: string,
): SignatureData {
  const sk = createStacksPrivateKey(privateKey);
  const signature = signStructuredData({
    message,
    domain,
    privateKey: sk,
  }).data;

  return {
    signature,
    publicKey: publicKeyToString(getPublicKey(sk)),
  };
}
