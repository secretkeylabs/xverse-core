import { BigNumber } from 'bignumber.js';
import JSONBigBase from 'json-bigint';

// ensure BigNumber doesn't switch to exponential notation
const bigNumberPrecisionConfig = {
  EXPONENTIAL_AT: 1e9,
};

// Avoid mutating the "global" BigNumber class.
const BN = BigNumber.clone();
BN.config(bigNumberPrecisionConfig);

// this is a workaround for json-bigint not having a way to set the exponential limit
// it's hacky but it's the only way to access the internal BigNumber instance
const forceBigNumberExponentialForJsonBig = (jsonBigInstance: { parse: (val: string) => any }) => {
  const temp = jsonBigInstance.parse('{"big":1234567890123456789012345678901234567890}');
  temp.big.constructor.config(bigNumberPrecisionConfig);
};

const JSONBig = JSONBigBase({
  alwaysParseAsBig: true,
});

const JSONBigOnDemand = JSONBigBase();

forceBigNumberExponentialForJsonBig(JSONBig);
forceBigNumberExponentialForJsonBig(JSONBigOnDemand);

// general utils
const bigMinMax =
  (isMax: boolean) =>
  (first: BigNumber | bigint | number, ...args: (BigNumber | bigint | number)[]): BigNumber => {
    let best = BN.isBigNumber(first) ? first : new BN(first.toString());

    for (const arg of args) {
      const big = BN.isBigNumber(arg) ? arg : new BN(arg.toString());

      if (best === undefined || (isMax && big.gt(best)) || (!isMax && big.lt(best))) {
        best = big;
      }
    }

    return best;
  };

const bigUtils = {
  min: bigMinMax(false),
  max: bigMinMax(true),
};

export { BN as BigNumber, JSONBig, JSONBigOnDemand, bigUtils };
