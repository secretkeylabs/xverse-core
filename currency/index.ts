import BigNumber from 'bignumber.js';
import { fetchBtcFeeRate } from '../api/xverse';

const satsToBtc = (sats: BigNumber): BigNumber => sats.multipliedBy(0.00000001);

const btcToSats = (btc: BigNumber): BigNumber => btc.multipliedBy(100000000);

const microstacksToStx = (microstacks: BigNumber): BigNumber => microstacks.multipliedBy(0.000001);

const stxToMicrostacks = (stacks: BigNumber): BigNumber => stacks.multipliedBy(1000000);

const getStxFiatEquivalent = (stxAmount: BigNumber, stxBtcRate: BigNumber, btcFiatRate: BigNumber): BigNumber =>
  microstacksToStx(stxAmount).multipliedBy(stxBtcRate).multipliedBy(btcFiatRate);

const getBtcFiatEquivalent = (btcAmount: BigNumber, btcFiatRate: BigNumber): BigNumber =>
  satsToBtc(btcAmount).multipliedBy(btcFiatRate);

const getFiatBtcEquivalent = (fiatAmount: BigNumber, btcFiatRate: BigNumber): BigNumber =>
  new BigNumber(fiatAmount.dividedBy(btcFiatRate).toFixed(8));

const getStxTokenEquivalent = (fiatAmount: BigNumber, stxBtcRate: BigNumber, btcFiatRate: BigNumber): BigNumber =>
  fiatAmount.dividedBy(stxBtcRate).dividedBy(btcFiatRate);

const getBtcEquivalent = (fiatAmount: BigNumber, btcFiatRate: BigNumber): BigNumber =>
  fiatAmount.dividedBy(btcFiatRate);

export {
  btcToSats,
  fetchBtcFeeRate,
  getBtcEquivalent,
  getBtcFiatEquivalent,
  getFiatBtcEquivalent,
  getStxFiatEquivalent,
  getStxTokenEquivalent,
  microstacksToStx,
  satsToBtc,
  stxToMicrostacks,
};
