import { BigNumber } from 'bignumber.js';
import JSONBigBase from 'json-bigint';

// ensure BigNumber doesn't switch to exponential notation
BigNumber.config({ EXPONENTIAL_AT: 1e9 });

const JSONBig = JSONBigBase({
  alwaysParseAsBig: true,
});

const JSONBigOnDemand = JSONBigBase();

export { BigNumber, JSONBig, JSONBigOnDemand };
