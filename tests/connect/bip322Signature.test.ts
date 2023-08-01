/* eslint-disable max-len */
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { getPublicKey, recoverPublicKey, verify as secpVerify } from '@noble/secp256k1';
import { AddressType, getAddressInfo } from 'bitcoin-address-validation';
import { signAsync, verify } from 'bitcoinjs-message';

import { bip0322Hash, signBip322Message, verifySignature } from '../../connect/bip322Signature';
import { getSigningDerivationPath } from '../../transactions/psbt';
import { testSeed } from '../mocks/restore.mock';

vi.mock('bitcoin-address-validation');
vi.mock('bitcoinjs-message');
vi.mock('@noble/secp256k1');
vi.mock('../../transactions/psbt');

describe('bip0322Hash', () => {
  it('should return the BIP0322 message hash', () => {
    const message = 'test message';
    const result = bip0322Hash(message);
    expect(result).toEqual('540afc386b9cefbea3d48b0cf0dbc532eab94b68d6fc27959f3fc6bf49fd426a');
  });
});

describe('signBip322Message', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('should sign a message for p2sh address type', async () => {
    const dummyAccount = {
      id: 0,
      stxAddress: 'stacksAddress',
      btcAddress: 'bitcoinAddress',
      ordinalsAddress: 'ordinalsAddress',
      masterPubKey: 'masterPubKey',
      stxPublicKey: 'stxPublicKey',
      btcPublicKey: 'btcPublicKey',
      ordinalsPublicKey: 'ordinalsPublicKey',
    };

    const options = {
      accounts: [dummyAccount],
      signatureAddress: 'test-address',
      message: 'test message',
      network: 'Mainnet' as const,
      seedPhrase: testSeed,
    };

    vi.mocked(getAddressInfo).mockReturnValueOnce({ type: AddressType.p2sh } as any);
    vi.mocked(getSigningDerivationPath).mockReturnValueOnce("m/49'/0'/0'/0/0");
    vi.mocked(signAsync).mockResolvedValueOnce(Buffer.from('test-buffer'));

    // Call the function
    const result = await signBip322Message(options);

    // Assertions
    expect(result).toBeDefined();
    expect(result).toBe('dGVzdC1idWZmZXI=');
    expect(signAsync).toHaveBeenCalledWith(options.message, expect.any(Buffer), false, {
      segwitType: 'p2sh(p2wpkh)',
    });
  });

  it('should sign a message for non-p2sh address type', async () => {
    const dummyAccount = {
      id: 0,
      stxAddress: 'stacksAddress',
      btcAddress: 'bitcoinAddress',
      ordinalsAddress: 'ordinalsAddress',
      masterPubKey: 'masterPubKey',
      stxPublicKey: 'stxPublicKey',
      btcPublicKey: 'btcPublicKey',
      ordinalsPublicKey: 'ordinalsPublicKey',
    };

    const options = {
      accounts: [dummyAccount],
      signatureAddress: 'test-address',
      message: 'test message',
      network: 'Mainnet' as const,
      seedPhrase: testSeed,
    };

    vi.mocked(getAddressInfo).mockReturnValueOnce({ type: AddressType.p2wpkh } as any);
    vi.mocked(getSigningDerivationPath).mockReturnValueOnce("m/49'/0'/0'/0/0");
    vi.mocked(getPublicKey).mockRestore();

    // Call the function
    const result = await signBip322Message(options);

    // Assertions
    expect(signAsync).not.toHaveBeenCalled();
    expect(result).toBeDefined();
    expect(result).toBe(
      'AkgwRQIhAJqtIE5QYZCwE4+AaERx/ZhbWz9stWJLuD70bMGYBFQ8AiBenMfPaiQ+hzKmTQj5zb6PLqh32zVfpbttKvQoQWTAdgEhAyIV2BIoLAeSyFNcNwLMqZT149qc2FAsPhkNQi8AZv3/',
    );
  });

  it('should throw an error if accounts are not provided', async () => {
    const options = {
      accounts: [],
      signatureAddress: 'test-address',
      message: 'test message',
      network: 'Mainnet' as const,
      seedPhrase: 'test seed phrase',
    };

    await expect(signBip322Message(options)).rejects.toThrow('List of Accounts are required');
  });
});

describe('verifySignature', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('should verify p2sh signature', () => {
    const address = 'test-address';
    const message = 'test message';
    const signature = 'test-signature';

    vi.mocked(getAddressInfo).mockReturnValueOnce({ type: AddressType.p2sh } as any);
    vi.mocked(verify).mockReturnValueOnce(true);

    const result = verifySignature(address, message, signature);

    expect(result).toBeDefined();
    expect(result).toBe(true);
    expect(getAddressInfo).toHaveBeenCalledWith(address);
    expect(verify).toHaveBeenCalledWith(message, address, signature);
  });

  it('should verify non-p2sh signature', () => {
    const address = 'test-address';
    const message = 'test message';
    const signature = 'dGVzdC1zaWduYXR1cmU=';

    vi.mocked(getAddressInfo).mockReturnValueOnce({ type: AddressType.p2wpkh } as any);

    const mockPublicKey = Buffer.from('public-key');
    vi.mocked(recoverPublicKey).mockReturnValueOnce(mockPublicKey);

    vi.mocked(secpVerify).mockReturnValueOnce(true);

    const result = verifySignature(address, message, signature);

    expect(result).toBeDefined();
    expect(result).toBe(true);

    expect(getAddressInfo).toHaveBeenCalledWith(address);
    expect(verify).not.toHaveBeenCalled();
    expect(recoverPublicKey).toHaveBeenCalledWith(
      '540afc386b9cefbea3d48b0cf0dbc532eab94b68d6fc27959f3fc6bf49fd426a',
      expect.any(Uint8Array),
      1,
    );
    expect(secpVerify).toHaveBeenCalledWith(
      expect.any(Uint8Array),
      '540afc386b9cefbea3d48b0cf0dbc532eab94b68d6fc27959f3fc6bf49fd426a',
      mockPublicKey,
      { strict: false },
    );
  });

  it('should throw an error for invalid address', () => {
    const address = null as any;
    const message = 'test message';
    const signature = 'test-signature';

    expect(() => verifySignature(address, message, signature)).toThrow('Invalid Address');
  });
});
