import { SigHash } from '@scure/btc-signer';

export type SighashFlags = {
  isSigHashAll: boolean;
  hasSigHashNone: boolean;
  hasSigHashSingle: boolean;
  hasAnyoneCanPay: boolean;
};

/**
 * Classify a sighash type for PSBT consent UI / summary finality.
 *
 * Notes on bit overlap (@scure/btc-signer):
 * - SINGLE=3, NONE=2, ALL=1 — SINGLE must be checked before NONE/ALL
 * - ANYONECANPAY is the 0x80 bit (DEFAULT_ANYONECANPAY=128)
 * - undefined sighash is signed as ALL/DEFAULT (fully bound, no ACP)
 */
export const classifySighash = (sigHash: number | undefined): SighashFlags => {
  if (sigHash === undefined || sigHash === SigHash.DEFAULT) {
    return {
      isSigHashAll: true,
      hasSigHashNone: false,
      hasSigHashSingle: false,
      hasAnyoneCanPay: false,
    };
  }

  const hasAnyoneCanPay = (sigHash & SigHash.DEFAULT_ANYONECANPAY) === SigHash.DEFAULT_ANYONECANPAY;

  // Strip ACP bit for base-type checks so DEFAULT_ANYONECANPAY (128) is not treated as ALL.
  const base = sigHash & ~SigHash.DEFAULT_ANYONECANPAY;

  if (base === SigHash.DEFAULT) {
    // Taproot DEFAULT|ANYONECANPAY — outputs bound like DEFAULT, inputs not.
    return {
      isSigHashAll: true,
      hasSigHashNone: false,
      hasSigHashSingle: false,
      hasAnyoneCanPay,
    };
  }

  const hasSigHashSingle = (base & SigHash.SINGLE) === SigHash.SINGLE;
  if (hasSigHashSingle) {
    return {
      isSigHashAll: false,
      hasSigHashNone: false,
      hasSigHashSingle: true,
      hasAnyoneCanPay,
    };
  }

  const hasSigHashNone = (base & SigHash.NONE) === SigHash.NONE;
  if (hasSigHashNone) {
    return {
      isSigHashAll: false,
      hasSigHashNone: true,
      hasSigHashSingle: false,
      hasAnyoneCanPay,
    };
  }

  const isSigHashAll = (base & SigHash.ALL) === SigHash.ALL;
  return {
    isSigHashAll,
    hasSigHashNone: false,
    hasSigHashSingle: false,
    hasAnyoneCanPay,
  };
};

export const mergeSighashFlags = (acc: SighashFlags, next: SighashFlags): SighashFlags => ({
  // isSigHashAll = "at least one fully-typed ALL/DEFAULT input" (OR). Do NOT use alone for finality.
  isSigHashAll: acc.isSigHashAll || next.isSigHashAll,
  hasSigHashNone: acc.hasSigHashNone || next.hasSigHashNone,
  hasSigHashSingle: acc.hasSigHashSingle || next.hasSigHashSingle,
  hasAnyoneCanPay: acc.hasAnyoneCanPay || next.hasAnyoneCanPay,
});

/**
 * Wallet-final / fee-trustworthy only when every signed input is ALL/DEFAULT and none use
 * NONE, SINGLE, or ANYONECANPAY. Mixed ALL+SINGLE must NOT be treated as final.
 */
export const isFullyBoundSighashFlags = (flags: SighashFlags): boolean =>
  flags.isSigHashAll && !flags.hasSigHashNone && !flags.hasSigHashSingle && !flags.hasAnyoneCanPay;
