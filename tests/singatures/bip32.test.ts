import { describe, expect, it } from 'vitest';
import { signBip322Message, verifySignature } from '../../connect/bip322Signature';
import { testSeed, walletAccounts } from '../mocks/restore.mock';

describe('Bip322 Signatures', () => {
  it('generates a valid Bip322 signature for taproot Address', async () => {
    const message: string = 'Hello world';
    const signature = await signBip322Message({
      message,
      accounts: walletAccounts,
      network: 'Mainnet',
      signatureAddress: walletAccounts[0].ordinalsAddress,
      seedPhrase: testSeed,
    });
    // Function generates a signature
    expect(signature.length).toBeGreaterThan(0);
    // Function generates a valid signature
    const validSignature = verifySignature(
      walletAccounts[0].ordinalsAddress,
      message,
      signature,
    );
    expect(validSignature).toBeTruthy();
  });

  it('generates a valid Bip322 signature for segwit Address', async () => {
    const message: string = 'Hello world';
    const signature = await signBip322Message({
      message,
      accounts: walletAccounts,
      network: 'Mainnet',
      signatureAddress: walletAccounts[0].btcAddress,
      seedPhrase: testSeed,
    });
    // Function generates a signature
    expect(signature.length).toBeGreaterThan(0);
    // Function generates the same signature
    expect(signature).toEqual(
      'JAA5OEh613wRJaMzfUkYILNP7Ny5MsPk77syQxznAG4QIkckJO5knVoQHi8L9BcMM6beSMEOjklBWQdOsnGaBak='
    );
  //  Function generates a valid signature
    const validSignature = verifySignature(
      walletAccounts[0].btcAddress,
      message,
      signature,
    );
    expect(validSignature).toBeTruthy();
  });
});
