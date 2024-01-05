import { describe, expect, it, vi } from 'vitest';
import ApiInstance from '../../api/instance';
import { BTC_BASE_URI_TESTNET } from '../../constant';

describe('ApiInstance', () => {
  it('should construct with a bitcoinApi', () => {
    const api = new ApiInstance({
      axiosConfig: { baseURL: BTC_BASE_URI_TESTNET },
    });
    expect(api.bitcoinApi).toBeTruthy();
  });

  it('should construct with a fallbackBitcoinApi if provided', () => {
    const api = new ApiInstance({
      axiosConfig: { baseURL: BTC_BASE_URI_TESTNET },
      fallbackUrl: 'https://btc-testnet.xverse.app',
    });
    expect(api.bitcoinApi).toBeTruthy();
    expect(api.fallbackBitcoinApi).toBeTruthy();
  });
});
