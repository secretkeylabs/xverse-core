/* eslint-disable max-len */
import { describe, expect, it } from 'vitest';

import { Verifier } from 'bip322-js';
import { verify } from 'bitcoinjs-message';

import { bip0322Hash, signMessage } from '../../connect/messageSigning';
import { MessageSigningProtocols } from '../../types';
import { testRootNode, walletAccounts } from '../mocks/restore.mock';

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
      accountIndex: 0n,
      derivationType: 'index',
      network: 'Mainnet',
      address: walletAccounts[0].btcAddresses.taproot.address,
      protocol: MessageSigningProtocols.BIP322,
      rootNode: testRootNode,
    });
    // Function generates a signature
    expect(signedMessage.signature.length).toBeGreaterThan(0);

    // positive test
    const shouldBeValid = Verifier.verifySignature(
      walletAccounts[0].btcAddresses.taproot.address,
      message,
      signedMessage.signature,
    );
    expect(shouldBeValid).toEqual(true);

    // negative test
    const shouldBeInValid = Verifier.verifySignature(
      walletAccounts[0].btcAddresses.taproot.address,
      message + 'not my original message',
      signedMessage.signature,
    );
    expect(shouldBeInValid).toEqual(false);
  });

  it('generates a valid Bip322 signature for segwit Address', async () => {
    const message = 'Hello world';
    const signedMessage = await signMessage({
      message,
      accountIndex: 0n,
      derivationType: 'index',
      network: 'Mainnet',
      address: walletAccounts[0].btcAddresses.nested!.address,
      rootNode: testRootNode,
      protocol: MessageSigningProtocols.BIP322,
    });
    // Function generates a signature
    expect(signedMessage.signature.length).toBeGreaterThan(0);
    // Function generates the same signature
    expect(signedMessage.signature).toEqual(
      'AkgwRQIhAOOz/DsVTdCHHJR/bUtQ42vwjEP2Qypk29laJXzCs8fbAiARV2Qiwx0Z1rAuA+hGjgP/mTZzRWcH1xXBY+iUxdQTKAEhAyIV2BIoLAeSyFNcNwLMqZT149qc2FAsPhkNQi8AZv3/',
    );

    // positive test
    const shouldBeValid = Verifier.verifySignature(
      walletAccounts[0].btcAddresses.nested!.address,
      message,
      signedMessage.signature,
    );
    expect(shouldBeValid).toEqual(true);

    // negative test
    const shouldBeInValid = Verifier.verifySignature(
      walletAccounts[0].btcAddresses.nested!.address,
      message + 'not my original message',
      signedMessage.signature,
    );
    expect(shouldBeInValid).toEqual(false);
  });
});

describe('ECDSA Signatures', () => {
  it('generates a valid ECDSA signature for p2sh address', async () => {
    const message = 'Hello world';
    const signedMessage = await signMessage({
      message,
      accountIndex: 0n,
      derivationType: 'index',
      network: 'Mainnet',
      address: walletAccounts[0].btcAddresses.nested!.address,
      rootNode: testRootNode,
      protocol: MessageSigningProtocols.ECDSA,
    });
    // Function generates a signature
    expect(signedMessage.signature.length).toBeGreaterThan(0);
    // Function generates the same signature
    expect(signedMessage.signature).toEqual(
      'JAA5OEh613wRJaMzfUkYILNP7Ny5MsPk77syQxznAG4QIkckJO5knVoQHi8L9BcMM6beSMEOjklBWQdOsnGaBak=',
    );

    // positive test
    const shouldBeValid = verify(message, walletAccounts[0].btcAddresses.nested!.address, signedMessage.signature);
    expect(shouldBeValid).toEqual(true);
    // negative test
    const shouldBeInValid = verify(
      message + 'not my original message',
      walletAccounts[0].btcAddresses.nested!.address,
      signedMessage.signature,
    );
    expect(shouldBeInValid).toEqual(false);
  });

  it('generates a valid ECDSA signature for p2wpkh address', async () => {
    const message = 'Hello world';
    const signedMessage = await signMessage({
      message,
      accountIndex: 0n,
      derivationType: 'index',
      network: 'Mainnet',
      address: walletAccounts[0].btcAddresses.native!.address,
      rootNode: testRootNode,
      protocol: MessageSigningProtocols.ECDSA,
    });
    // Function generates a signature
    expect(signedMessage.signature.length).toBeGreaterThan(0);
    // Function generates the same signature
    expect(signedMessage.signature).toEqual(
      'KGIUZBfSMSKFPwmSrU7RkxYwkTwtmGqLdi6ZCKeSrLQFHQ9KgcyD7ofH+7djs0Qq+MRUwP6EmD0K4BzjpDC/4Mo=',
    );

    // positive test
    const shouldBeValid = verify(message, walletAccounts[0].btcAddresses.native!.address, signedMessage.signature);
    expect(shouldBeValid).toEqual(true);
    // negative test
    const shouldBeInValid = verify(
      message + 'not my original message',
      walletAccounts[0].btcAddresses.native!.address,
      signedMessage.signature,
    );
    expect(shouldBeInValid).toEqual(false);
  });
});
