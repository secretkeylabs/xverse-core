import BigNumber from 'bignumber.js';

const BNCrypto = BigNumber.clone();
BNCrypto.config({
  // Set to the maximum allowed value to essentially disable exponential notation.
  EXPONENTIAL_AT: 1e9,
  // https://mikemcl.github.io/bignumber.js/#constructor-properties
  ROUNDING_MODE: BigNumber.ROUND_HALF_FLOOR,
});

const BNFiat = BigNumber.clone();
BNFiat.config({
  // Set to the maximum allowed value to essentially disable exponential notation.
  EXPONENTIAL_AT: 1e9,
  // https://mikemcl.github.io/bignumber.js/#constructor-properties
  ROUNDING_MODE: BigNumber.ROUND_HALF_UP,
});

export { BNCrypto, BNFiat };
