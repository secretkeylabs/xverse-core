export function ecPairToHexString(secretKey: any) {
  var ecPointHex = secretKey.privateKey.toString('hex');
  if (secretKey.compressed) {
    return ecPointHex + '01';
  } else {
    return ecPointHex;
  }
}
