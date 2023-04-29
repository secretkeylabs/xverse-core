import { describe, expect, it } from 'vitest';
import * as secp256k1 from '@noble/secp256k1';
import { bip0322Hash, signBip322Message } from '../../connect/bip322Signature';
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

    const validSignature = secp256k1.schnorr.verify(
      signature,
      bip0322Hash(message),
      walletAccounts[0].ordinalsPublicKey
    );
    // Function generates a valid signature
    expect(validSignature).toBeTruthy();
  });

  it('generates a valid Bip322 signature for segwit Address', async () => {
    const message: string = 'Hello world';

    const signature = await signBip322Message({
      message: message,
      accounts: walletAccounts,
      network: 'Mainnet',
      signatureAddress: walletAccounts[0].btcAddress,
      seedPhrase: testSeed,
    });
    // Function generates a signature
    expect(signature.length).toBeGreaterThan(0);
    // Function generates the same signature
    expect(signature).toEqual(
      'AkgwRQIhAPyNwo9jp4/LuwusHG/W4BrNTnmrGho4YufCw5KWTZ8JAiAbT9d6rhhulGi/0W5x3QMBcEuJYdUhwvH5ACS/VQHP+gEhAyIV2BIoLAeSyFNcNwLMqZT149qc2FAsPhkNQi8AZv3/'
    );
    const validSignature = secp256k1.schnorr.verify(
      signature,
      bip0322Hash(message),
      walletAccounts[0].btcPublicKey
    );
    // Function generates a valid signature
    expect(validSignature).toBeTruthy();
  });
});
