/* eslint-disable max-len */
import { describe, expect, it } from 'vitest';

import { Verifier } from 'bip322-js';
import { verify } from 'bitcoinjs-message';

import { bip0322Hash, MessageSigningProtocols, signMessage } from '../../connect/messageSigning';
import { testSeed, walletAccounts } from '../mocks/restore.mock';

describe('bip0322Hash', () => {
  it('should return the BIP0322 message hash', () => {
    const message = 'test message';
    const result = bip0322Hash(message);
    expect(result).toEqual('540afc386b9cefbea3d48b0cf0dbc532eab94b68d6fc27959f3fc6bf49fd426a');
  });
});

describe('Bip322 Signatures', () => {
  it('generates a valid Bip322 signature for taproot Address', async () => {
    const message = 'Hello world';
    const signedMessage = await signMessage({
      message,
      accounts: walletAccounts,
      network: 'Mainnet',
      address: walletAccounts[0].ordinalsAddress,
      protocol: MessageSigningProtocols.BIP322,
      seedPhrase: testSeed,
    });
    // Function generates a signature
    expect(signedMessage.signature.length).toBeGreaterThan(0);

    // positive test
    const shouldBeValid = Verifier.verifySignature(walletAccounts[0].ordinalsAddress, message, signedMessage.signature);
    expect(shouldBeValid).toEqual(true);

    // negative test
    const shouldBeInValid = Verifier.verifySignature(
      walletAccounts[0].ordinalsAddress,
      message + 'not my original message',
      signedMessage.signature,
    );
    expect(shouldBeInValid).toEqual(false);
  });

  it('generates a valid Bip322 signature for segwit Address', async () => {
    const message = 'Hello world';
    const signedMessage = await signMessage({
      message,
      accounts: walletAccounts,
      network: 'Mainnet',
      address: walletAccounts[0].btcAddress,
      seedPhrase: testSeed,
      protocol: MessageSigningProtocols.BIP322,
    });
    // Function generates a signature
    expect(signedMessage.signature.length).toBeGreaterThan(0);
    // Function generates the same signature
    expect(signedMessage.signature).toEqual(
      'AkgwRQIhAOOz/DsVTdCHHJR/bUtQ42vwjEP2Qypk29laJXzCs8fbAiARV2Qiwx0Z1rAuA+hGjgP/mTZzRWcH1xXBY+iUxdQTKAEhAyIV2BIoLAeSyFNcNwLMqZT149qc2FAsPhkNQi8AZv3/',
    );

    // positive test
    const shouldBeValid = Verifier.verifySignature(walletAccounts[0].btcAddress, message, signedMessage.signature);
    expect(shouldBeValid).toEqual(true);

    // negative test
    const shouldBeInValid = Verifier.verifySignature(
      walletAccounts[0].btcAddress,
      message + 'not my original message',
      signedMessage.signature,
    );
    expect(shouldBeInValid).toEqual(false);
  });

  it('should throw an error if accounts are not provided', async () => {
    const options = {
      accounts: [],
      address: 'test-address',
      message: 'test message',
      network: 'Mainnet' as const,
      seedPhrase: 'test seed phrase',
      protocol: MessageSigningProtocols.BIP322,
    };

    await expect(signMessage(options)).rejects.toThrow('List of Accounts are required');
  });
});

describe('ECDSA Signatures', () => {
  it('generates a valid ECDSA signature for p2sh address', async () => {
    const message = 'Hello world';
    const signedMessage = await signMessage({
      message,
      accounts: walletAccounts,
      network: 'Mainnet',
      address: walletAccounts[0].btcAddress,
      seedPhrase: testSeed,
      protocol: MessageSigningProtocols.ECDSA,
    });
    // Function generates a signature
    expect(signedMessage.signature.length).toBeGreaterThan(0);
    // Function generates the same signature
    expect(signedMessage.signature).toEqual(
      'JAA5OEh613wRJaMzfUkYILNP7Ny5MsPk77syQxznAG4QIkckJO5knVoQHi8L9BcMM6beSMEOjklBWQdOsnGaBak=',
    );

    // positive test
    const shouldBeValid = verify(message, walletAccounts[0].btcAddress, signedMessage.signature);
    expect(shouldBeValid).toEqual(true);
    // negative test
    const shouldBeInValid = verify(
      message + 'not my original message',
      walletAccounts[0].btcAddress,
      signedMessage.signature,
    );
    expect(shouldBeInValid).toEqual(false);
  });
});
