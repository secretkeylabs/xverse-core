import { SigHash } from '@scure/btc-signer';
import { describe, expect, it } from 'vitest';
import {
  classifySighash,
  isFullyBoundSighashFlags,
  mergeSighashFlags,
} from '../../../transactions/bitcoin/utils/sighashFlags';

describe('classifySighash', () => {
  it('treats undefined and DEFAULT as fully bound ALL', () => {
    expect(classifySighash(undefined)).toEqual({
      isSigHashAll: true,
      hasSigHashNone: false,
      hasSigHashSingle: false,
      hasAnyoneCanPay: false,
    });
    expect(classifySighash(SigHash.DEFAULT)).toEqual({
      isSigHashAll: true,
      hasSigHashNone: false,
      hasSigHashSingle: false,
      hasAnyoneCanPay: false,
    });
  });

  it('detects ALL', () => {
    expect(classifySighash(SigHash.ALL)).toMatchObject({
      isSigHashAll: true,
      hasSigHashNone: false,
      hasSigHashSingle: false,
      hasAnyoneCanPay: false,
    });
  });

  it('detects NONE (and not SINGLE)', () => {
    expect(classifySighash(SigHash.NONE)).toEqual({
      isSigHashAll: false,
      hasSigHashNone: true,
      hasSigHashSingle: false,
      hasAnyoneCanPay: false,
    });
  });

  it('detects SINGLE (and not NONE despite bit overlap)', () => {
    expect(classifySighash(SigHash.SINGLE)).toEqual({
      isSigHashAll: false,
      hasSigHashNone: false,
      hasSigHashSingle: true,
      hasAnyoneCanPay: false,
    });
  });

  it('detects ALL|ANYONECANPAY without silencing ACP', () => {
    expect(classifySighash(SigHash.ALL_ANYONECANPAY)).toEqual({
      isSigHashAll: true,
      hasSigHashNone: false,
      hasSigHashSingle: false,
      hasAnyoneCanPay: true,
    });
  });

  it('detects NONE|ANYONECANPAY', () => {
    expect(classifySighash(SigHash.NONE_ANYONECANPAY)).toEqual({
      isSigHashAll: false,
      hasSigHashNone: true,
      hasSigHashSingle: false,
      hasAnyoneCanPay: true,
    });
  });

  it('detects SINGLE|ANYONECANPAY', () => {
    expect(classifySighash(SigHash.SINGLE_ANYONECANPAY)).toEqual({
      isSigHashAll: false,
      hasSigHashNone: false,
      hasSigHashSingle: true,
      hasAnyoneCanPay: true,
    });
  });

  it('detects DEFAULT|ANYONECANPAY', () => {
    expect(classifySighash(SigHash.DEFAULT_ANYONECANPAY)).toEqual({
      isSigHashAll: true,
      hasSigHashNone: false,
      hasSigHashSingle: false,
      hasAnyoneCanPay: true,
    });
  });
});

describe('mergeSighashFlags', () => {
  it('ORs flags across inputs', () => {
    const merged = mergeSighashFlags(classifySighash(SigHash.SINGLE), classifySighash(SigHash.ALL_ANYONECANPAY));
    expect(merged).toEqual({
      isSigHashAll: true,
      hasSigHashNone: false,
      hasSigHashSingle: true,
      hasAnyoneCanPay: true,
    });
  });
});

describe('isFullyBoundSighashFlags', () => {
  it('is true only for pure ALL/DEFAULT', () => {
    expect(isFullyBoundSighashFlags(classifySighash(SigHash.ALL))).toBe(true);
    expect(isFullyBoundSighashFlags(classifySighash(SigHash.DEFAULT))).toBe(true);
    expect(isFullyBoundSighashFlags(classifySighash(undefined))).toBe(true);
  });

  it('is false for SINGLE, NONE, ACP, and mixed ALL+SINGLE', () => {
    expect(isFullyBoundSighashFlags(classifySighash(SigHash.SINGLE))).toBe(false);
    expect(isFullyBoundSighashFlags(classifySighash(SigHash.NONE))).toBe(false);
    expect(isFullyBoundSighashFlags(classifySighash(SigHash.ALL_ANYONECANPAY))).toBe(false);
    const mixed = mergeSighashFlags(classifySighash(SigHash.ALL), classifySighash(SigHash.SINGLE));
    expect(mixed.isSigHashAll).toBe(true);
    expect(mixed.hasSigHashSingle).toBe(true);
    expect(isFullyBoundSighashFlags(mixed)).toBe(false);
  });
});
