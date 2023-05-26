import { ECPairInterface } from '../utils/ecpair';

export function ecPairToHexString(secretKey: ECPairInterface): string {
  if (!secretKey.privateKey) {
    throw new Error('Unexpected: secretKey without privateKey provided for hex conversion');
  }

  const ecPointHex = secretKey.privateKey.toString('hex');

  if (secretKey.compressed) {
    return ecPointHex + '01';
  } else {
    return ecPointHex;
  }
}
