import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getRuneInfoMock, runeBurnMinted, runeBurnPartial } from '../../../mocks/btc.indexer.txs';
import BigNumber from 'bignumber.js';
import { getRunesInfoDictionary, mapRuneToRuneInfo } from '../../../../api/btc';
import { getRunesClient } from '../../../../api/runes/provider';
import { ApiAddressTransaction, RuneInfo } from '../../../../types';

const mockGetRuneInfo = vi.fn();

vi.mock('../../../../api/runes/provider', () => ({
  getRunesClient: () => ({
    getRuneInfo: mockGetRuneInfo,
  }),
}));

describe('getRunesInfoDictionary', () => {
  // reset getRuneInfo mock
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should merge client runes info with fetched runes info', async () => {
    // Mock transactions with rune activities
    const mockTxs: ApiAddressTransaction[] = [runeBurnMinted, runeBurnPartial];

    // Mock client runes info
    const clientRunesInfo = new Map<string, RuneInfo>([
      ['842994:159', mapRuneToRuneInfo(getRuneInfoMock('842994:159'))],
    ]);

    mockGetRuneInfo.mockResolvedValueOnce(getRuneInfoMock('840080:127'));

    const runesApiClient = getRunesClient('Mainnet');

    const result = await getRunesInfoDictionary({
      txs: mockTxs,
      clientRunesInfo,
      runesApiClient,
    });

    // Assertions
    expect(mockGetRuneInfo).toHaveBeenCalledTimes(1);
    expect(result.size).toBe(2);
    expect(result.get('842994:159')).toEqual({
      symbol: '#',
      name: 'RUNE842994:159',
      divisibility: new BigNumber(4),
      inscriptionId: 'inscription842994:159',
    });
    expect(result.get('840080:127')).toEqual({
      symbol: '#',
      name: 'RUNE840080:127',
      divisibility: new BigNumber(4),
      inscriptionId: 'inscription840080:127',
    });
  });

  it('should fetch runes info from the api if not present in the client runes info', async () => {
    // Mock transactions with rune activities
    const mockTxs: ApiAddressTransaction[] = [runeBurnMinted, runeBurnPartial];

    // Mock client runes info
    const clientRunesInfo = new Map<string, RuneInfo>();

    mockGetRuneInfo.mockResolvedValueOnce(getRuneInfoMock('842994:159'));
    mockGetRuneInfo.mockResolvedValueOnce(getRuneInfoMock('840080:127'));

    const runesApiClient = getRunesClient('Mainnet');

    const result = await getRunesInfoDictionary({
      txs: mockTxs,
      clientRunesInfo,
      runesApiClient,
    });

    // Assertions
    expect(mockGetRuneInfo).toHaveBeenCalledTimes(2);
    expect(result.size).toBe(2);
    expect(result.get('842994:159')).toEqual({
      symbol: '#',
      name: 'RUNE842994:159',
      divisibility: new BigNumber(4),
      inscriptionId: 'inscription842994:159',
    });
    expect(result.get('840080:127')).toEqual({
      symbol: '#',
      name: 'RUNE840080:127',
      divisibility: new BigNumber(4),
      inscriptionId: 'inscription840080:127',
    });
  });

  it('should use the client runes info if present and not fetch from the api', async () => {
    // Mock transactions with rune activities
    const mockTxs: ApiAddressTransaction[] = [runeBurnMinted, runeBurnPartial];

    // Mock client runes info
    const clientRunesInfo = new Map<string, RuneInfo>([
      ['842994:159', mapRuneToRuneInfo(getRuneInfoMock('842994:159'))],
      ['840080:127', mapRuneToRuneInfo(getRuneInfoMock('840080:127'))],
    ]);

    const runesApiClient = getRunesClient('Mainnet');

    const result = await getRunesInfoDictionary({
      txs: mockTxs,
      clientRunesInfo,
      runesApiClient,
    });

    // Assertions
    expect(mockGetRuneInfo).toHaveBeenCalledTimes(0);
    expect(result.size).toBe(2);
    expect(result.get('842994:159')).toEqual({
      symbol: '#',
      name: 'RUNE842994:159',
      divisibility: new BigNumber(4),
      inscriptionId: 'inscription842994:159',
    });
    expect(result.get('840080:127')).toEqual({
      symbol: '#',
      name: 'RUNE840080:127',
      divisibility: new BigNumber(4),
      inscriptionId: 'inscription840080:127',
    });
  });
});
