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
  const validMainnetAddress = '38yVkkFHMJrSkYcnDXUogzpQDb34G3ZcSr';
  const validTestnetAddress = '2MvD5Ug9arybH1K4rJNDwiNaSCw9cPxfyZn';
  const invalidAddress = 'invalid_address';

  it('should return true for a valid mainnet address', () => {
    const result = validateBtcAddress({
      btcAddress: validMainnetAddress,
      network: 'Mainnet',
    });
    expect(result).toBe(true);
  });

  it('should return true for a valid testnet address', () => {
    const result = validateBtcAddress({
      btcAddress: validTestnetAddress,
      network: 'Testnet',
    });
    expect(result).toBe(true);
  });

  it('should return false for valid mainnet on testnet', () => {
    const result = validateBtcAddress({
      btcAddress: validMainnetAddress,
      network: 'Testnet',
    });
    expect(result).toBe(false);
  });

  it('should return false for valid testnet on mainnet', () => {
    const result = validateBtcAddress({
      btcAddress: validTestnetAddress,
      network: 'Mainnet',
    });
    expect(result).toBe(false);
  });

  it('should return false for an invalid address', () => {
    const result = validateBtcAddress({
      btcAddress: invalidAddress,
      network: 'Mainnet',
    });
    expect(result).toBe(false);
  });
});
