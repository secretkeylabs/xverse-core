import * as bip32 from '@scure/bip32';
import * as bip39 from '@scure/bip39';
import * as btc from '@scure/btc-signer';
import { describe, expect, it } from 'vitest';
import { estimateVSize } from '../../../transactions/bitcoin/utils/transactionVsizeEstimator';

const dummySeedphrase = 'action action action action action action action action action action action action';
const dummySeed = bip39.mnemonicToSeedSync(dummySeedphrase);
const dummyKeyPair = bip32.HDKey.fromMasterSeed(dummySeed);

const createTransaction = (inputCount: number, outputCount: number, p2: btc.P2Ret, withOpReturn = false) => {
  const txn = new btc.Transaction({
    allowLegacyWitnessUtxo: true,
    allowUnknownInputs: true,
    allowUnknownOutputs: true,
  });

  for (let i = 0; i < inputCount; i++) {
    txn.addInput({
      txid: `${i}`.padStart(64, '0'),
      index: 5,
      witnessUtxo: {
        script: p2.script,
        amount: 1000000n,
      },
      ...p2,
    });
  }

  for (let i = 0; i < outputCount; i++) {
    txn.addOutputAddress(p2.address!, 10000n);
  }

  if (withOpReturn) {
    txn.addOutput({
      script: btc.Script.encode([btc.OP.RETURN, Buffer.from('hello world')]),
      amount: 0n,
    });
  }

  for (let i = 0; i < inputCount; i++) {
    txn.signIdx(dummyKeyPair.privateKey!, i);
  }

  return txn;
};

const fixtures = [
  [1, 1],
  [2, 1],
  [1, 2],
  [2, 2],
  [21, 1],
  [1, 25],
  [21, 25],
];

describe('estimateVSize util', () => {
  describe.each([
    ['p2pkh', btc.p2pkh(dummyKeyPair.publicKey!)],
    ['p2wpkh', btc.p2wpkh(dummyKeyPair.publicKey!)],
    ['p2sh-p2wpkh', btc.p2sh(btc.p2wpkh(dummyKeyPair.publicKey!))],
    ['p2tr', btc.p2tr(dummyKeyPair.publicKey!.slice(1))],
  ])('should return the correct vsize %s', (_label, p2Def) => {
    it.each(fixtures)('should return the correct vsize - %d, %d', (inputCount, outputCount) => {
      const txn = createTransaction(inputCount, outputCount, p2Def);
      const vsizeEstimate = estimateVSize(txn, { taprootSimpleSign: true });
      txn.finalize();
      const diff = Math.abs(vsizeEstimate - txn.vsize);
      // input signatures could differ by a single byte, so allow for that
      expect(diff).toBeLessThanOrEqual(inputCount);

      const txnWithOpReturn = createTransaction(inputCount, outputCount, p2Def, true);
      const vsizeEstimateWithOpReturn = estimateVSize(txnWithOpReturn, { taprootSimpleSign: true });
      txnWithOpReturn.finalize();
      const diffOpReturn = Math.abs(vsizeEstimateWithOpReturn - txnWithOpReturn.vsize);
      // input signatures could differ by a single byte, so allow for that
      expect(diffOpReturn).toBeLessThanOrEqual(inputCount);
    });
  });
});
