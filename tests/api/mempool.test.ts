import axios from 'axios';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import mempool from '../../api/mempool';

vi.mock('axios');

describe('Mempool fees url', () => {
  beforeEach(() => {
    vi.mocked(axios.get).mockReset();
  });

  it('mainnet', async () => {
    vi.mocked(axios.get).mockResolvedValue({
      data: {
        fastestFee: 1,
        halfHourFee: 2,
        hourFee: 3,
      },
    });

    const r = await mempool.getRecommendedFees('Mainnet');
    console.log(r);
    expect(axios.get).toHaveBeenCalledWith('https://mempool.space/api/v1/fees/recommended');
  });

  it('signet', async () => {
    vi.mocked(axios.get).mockResolvedValue({
      data: {
        fastestFee: 1,
        halfHourFee: 2,
        hourFee: 3,
      },
    });

    const r = await mempool.getRecommendedFees('Signet');
    console.log(r);
    expect(axios.get).toHaveBeenCalledWith('https://mempool.space/signet/api/v1/fees/recommended');
  });

  it('testnet', async () => {
    vi.mocked(axios.get).mockResolvedValue({
      data: {
        fastestFee: 1,
        halfHourFee: 2,
        hourFee: 3,
      },
    });

    await mempool.getRecommendedFees('Testnet');
    expect(axios.get).toHaveBeenCalledWith('https://mempool.space/testnet/api/v1/fees/recommended');
  });

  it('regtest', async () => {
    vi.mocked(axios.get).mockResolvedValue({
      data: {
        fastestFee: 1,
        halfHourFee: 2,
        hourFee: 3,
      },
    });

    const r = await mempool.getRecommendedFees('Regtest');
    console.log(r);
    expect(axios.get).toHaveBeenCalledWith('https://beta.sbtc-mempool.tech/api/proxy/fees/recommended');
  });
});
