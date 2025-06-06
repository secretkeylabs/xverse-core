import { hashMessage } from '@stacks/encryption';
import {
  ClarityValue,
  signMessageHashRsv,
  signStructuredData,
  privateKeyToPublic,
  publicKeyToHex,
} from '@stacks/transactions';
import { buf2hex } from '../utils/arrayBuffers';

export interface SignatureData {
  signature: string;
  publicKey: string;
}

export function signStacksMessage(message: string, privateKey: string): SignatureData {
  const hash = hashMessage(message);
  return {
    signature: signMessageHashRsv({
      privateKey,
      messageHash: buf2hex(hash),
    }),
    publicKey: publicKeyToHex(privateKeyToPublic(privateKey)),
  };
}

export function signStructuredDataMessage(
  message: ClarityValue,
  domain: ClarityValue,
  privateKey: string,
): SignatureData {
  const signature = signStructuredData({
    message,
    domain,
    privateKey,
  });

  return {
    signature,
    publicKey: publicKeyToHex(privateKeyToPublic(privateKey)),
  };
}
