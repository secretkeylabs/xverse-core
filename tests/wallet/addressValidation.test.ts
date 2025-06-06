import { describe, expect, it } from 'vitest';

import { validateBtcAddress, validateStxAddress } from '../../wallet';

describe('validateStxAddress', () => {
  const validMainnetAddress = 'SP3K8BC0PPEVCV7NZ6QSRWPQ2JE9E5B6N3PA0KBR9';
  const validTestnetAddress = 'ST2X2FYCY01Y7YR2TGC2Y6661NFF3SMH0NGXPWTV5';
  const invalidAddress = 'invalid_address';

  it('should return true for a valid mainnet address', () => {
    const result = validateStxAddress({
      stxAddress: validMainnetAddress,
      network: 'Mainnet',
    });
    expect(result).toBe(true);
  });

  it('should return true for a valid testnet address', () => {
    const result = validateStxAddress({
      stxAddress: validTestnetAddress,
      network: 'Testnet',
    });
    expect(result).toBe(true);
  });

  it('should return false for valid mainnet on testnet', () => {
    const result = validateStxAddress({
      stxAddress: validMainnetAddress,
      network: 'Testnet',
    });
    expect(result).toBe(false);
  });

  it('should return false for valid testnet on mainnet', () => {
    const result = validateStxAddress({
      stxAddress: validTestnetAddress,
      network: 'Mainnet',
    });
    expect(result).toBe(false);
  });

  it('should return false for an invalid address', () => {
    const result = validateStxAddress({
      stxAddress: invalidAddress,
      network: 'Mainnet',
    });
    expect(result).toBe(false);
  });

  it('should return false for an invalid network type', () => {
    const result = validateStxAddress({
      stxAddress: validMainnetAddress,
      network: 'InvalidNetwork' as any,
    });
    expect(result).toBe(false);
  });
});

describe('validateBtcAddress', () => {
  const validMainnetP2shAddress = '38yVkkFHMJrSkYcnDXUogzpQDb34G3ZcSr';
  const validTestnetP2shAddress = '2MvD5Ug9arybH1K4rJNDwiNaSCw9cPxfyZn';
  const invalidAddress = 'invalid_address';

  it('should return true for a valid mainnet address', () => {
    const result = validateBtcAddress({
      btcAddress: validMainnetP2shAddress,
      network: 'Mainnet',
    });
    expect(result).toBe(true);
  });

  it('should return true for a native segwit mainnet address', () => {
    const result = validateBtcAddress({
      btcAddress: 'bc1q7wgqsjkjf26vmhhkwcfl5famhcytvunphn4phh',
      network: 'Mainnet',
    });
    expect(result).toBe(true);
  });

  it('should return true for taproot mainnet address', () => {
    const result = validateBtcAddress({
      btcAddress: 'bc1phrkher5h44sx4pelukf6kwahladmhzs9l96us8mcnqhxsd90cfyq9gm0l2',
      network: 'Mainnet',
    });
    expect(result).toBe(true);
  });

  it('should return true for a valid testnet address', () => {
    const result = validateBtcAddress({
      btcAddress: validTestnetP2shAddress,
      network: 'Testnet',
    });
    expect(result).toBe(true);
  });

  it('should return false for valid mainnet on testnet', () => {
    const result = validateBtcAddress({
      btcAddress: validMainnetP2shAddress,
      network: 'Testnet',
    });
    expect(result).toBe(false);
  });

  it('should return false for valid testnet on mainnet', () => {
    const result = validateBtcAddress({
      btcAddress: validTestnetP2shAddress,
      network: 'Mainnet',
    });
    expect(result).toBe(false);
  });

  it('should return true for valid p2sh regtest', () => {
    const result = validateBtcAddress({
      btcAddress: '2N9J2yG51mJVsnD2n8jUBcjHmaEawR6PB4t',
      network: 'Regtest',
    });
    expect(result).toBe(true);
  });

  it('should return true for valid p2sh regtest', () => {
    const result = validateBtcAddress({
      btcAddress: 'bcrt1q5tplkx6srek9qx9k0p46ngvh3vx76ductkr70m',
      network: 'Regtest',
    });
    expect(result).toBe(true);
  });

  it('should return false for an invalid address', () => {
    const result = validateBtcAddress({
      btcAddress: invalidAddress,
      network: 'Mainnet',
    });
    expect(result).toBe(false);
  });
});
