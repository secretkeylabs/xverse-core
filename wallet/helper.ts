export function ecPairToHexString(secretKey) {
    var ecPointHex = secretKey.privateKey.toString('hex');
    if (secretKey.compressed) {
      return ecPointHex + "01";
    } else {
      return ecPointHex;
    }
  }