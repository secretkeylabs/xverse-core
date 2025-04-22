import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getRuneInfoMock, ownBtcAddresses, runeBurnMinted, runeBurnPartial } from '../../../mocks/btc.indexer.txs';
import BigNumber from 'bignumber.js';
import { fetchPastBtcTransactions, mapRuneToRuneInfo } from '../../../../api/btc';
import { getRunesClient } from '../../../../api/runes/provider';
import { XverseApi } from '../../../../api/xverse';
import { MasterVault } from '../../../../vaults/masterVault';
import { VaultConfig } from '../../../../vaults/types';
import { Account } from '../../../../types/account';
import { RuneInfo } from '../../../../types';

const mockGetPastBtcTransactions = vi.fn();

const mockGetRuneInfo = vi.fn();

vi.mock('../../../../api/xverse', () => ({
  getXverseApiClient: () => ({
    getPastBtcTransactions: mockGetPastBtcTransactions,
  }),
}));

vi.mock('../../../../api/runes/provider', () => ({
  getRunesClient: () => ({
    getRuneInfo: mockGetRuneInfo,
  }),
}));

const sessionStorageAdapter = {
  get: vi.fn(),
  set: vi.fn(),
  remove: vi.fn(),
  getAllKeys: vi.fn(),
};
const encryptedDataStorageAdapter = {
  get: vi.fn(),
  set: vi.fn(),
  remove: vi.fn(),
  getAllKeys: vi.fn(),
};
const commonStorageAdapter = {
  get: vi.fn(),
  set: vi.fn(),
  remove: vi.fn(),
  getAllKeys: vi.fn(),
};
const cryptoUtilsAdapter = {
  encrypt: vi.fn(),
  decrypt: vi.fn(),
  hash: vi.fn(),
  generateRandomBytes: vi.fn(),
};
const config: VaultConfig = {
  sessionStorageAdapter,
  encryptedDataStorageAdapter,
  commonStorageAdapter,
  cryptoUtilsAdapter,
};

describe('fetchPastBtcTransactions', () => {
  // reset mocks
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should enhance a tx with without client runes info', async () => {
    // Mock transactions with rune activities

    mockGetPastBtcTransactions.mockResolvedValueOnce({
      transactions: [runeBurnMinted],
      offset: 0,
      limit: 10,
    });

    mockGetRuneInfo.mockResolvedValueOnce(getRuneInfoMock('842994:159'));

    // Mock client runes info
    const clientRunesInfo = new Map<string, RuneInfo>();

    const vault = new MasterVault(config);
    const xverseApiClient = new XverseApi(vault, 'Mainnet');
    const runesApiClient = getRunesClient('Mainnet');

    const result = await fetchPastBtcTransactions({
      account: { btcAddresses: ownBtcAddresses } as Account,
      offset: 0,
      limit: 10,
      clientRunesInfo,
      runesApiClient,
      xverseApiClient,
    });

    // Assertions
    expect(mockGetPastBtcTransactions).toHaveBeenCalledTimes(1);
    expect(mockGetRuneInfo).toHaveBeenCalledTimes(1);
    expect(result).toEqual({
      transactions: [
        {
          id: '0013cb4112c6cabc9bf09a29714c36c6ebd678467c3df9e328a261efc419d566',
          fees: 3432,
          satsAmount: -3432,
          hasMoreAddressesInTx: false,
          addressesInTx: { external: [], isOwnTaproot: true, isOwnNested: false, isOwnNative: false },
          blockHeight: 843090,
          blockTime: 1715481005,
          assetInTx: 'runes',
          txType: 'mintBurn',
          runes: {
            hasMore: false,
            items: [
              {
                runeId: '842994:159',
                address: '',
                sent: '0',
                received: '0',
                outgoing: '0',
                incoming: '0',
                symbol: '#',
                name: 'RUNE842994:159',
                divisibility: new BigNumber('4'),
                inscriptionId: 'inscription842994:159',
              },
            ],
          },
        },
      ],
      offset: 0,
      limit: 10,
    });
  });

  it('should enhance two txs with partial client runes info', async () => {
    // Mock transactions with rune activities
    mockGetPastBtcTransactions.mockResolvedValueOnce({
      transactions: [runeBurnMinted, runeBurnPartial],
      offset: 0,
      limit: 10,
    });

    mockGetRuneInfo.mockResolvedValueOnce(getRuneInfoMock('840080:127'));

    // Mock client runes info
    const clientRunesInfo = new Map<string, RuneInfo>([
      ['842994:159', mapRuneToRuneInfo(getRuneInfoMock('842994:159'))],
    ]);

    const vault = new MasterVault(config);
    const xverseApiClient = new XverseApi(vault, 'Mainnet');
    const runesApiClient = getRunesClient('Mainnet');

    const result = await fetchPastBtcTransactions({
      account: { btcAddresses: ownBtcAddresses } as Account,
      offset: 0,
      limit: 10,
      clientRunesInfo,
      runesApiClient,
      xverseApiClient,
    });

    // Assertions
    expect(mockGetPastBtcTransactions).toHaveBeenCalledTimes(1);
    expect(mockGetRuneInfo).toHaveBeenCalledTimes(1);
    expect(result).toEqual({
      transactions: [
        {
          id: '0013cb4112c6cabc9bf09a29714c36c6ebd678467c3df9e328a261efc419d566',
          fees: 3432,
          satsAmount: -3432,
          hasMoreAddressesInTx: false,
          addressesInTx: { external: [], isOwnTaproot: true, isOwnNested: false, isOwnNative: false },
          blockHeight: 843090,
          blockTime: 1715481005,
          assetInTx: 'runes',
          txType: 'mintBurn',
          runes: {
            hasMore: false,
            items: [
              {
                runeId: '842994:159',
                address: '',
                sent: '0',
                received: '0',
                outgoing: '0',
                incoming: '0',
                symbol: '#',
                name: 'RUNE842994:159',
                divisibility: new BigNumber('4'),
                inscriptionId: 'inscription842994:159',
              },
            ],
          },
        },
        {
          id: 'fc7a6d09f020ba6a4835c157232318b0032f9e1fe2e6f62d8b98aab702feeb36',
          fees: 1146,
          satsAmount: 0,
          hasMoreAddressesInTx: false,
          addressesInTx: {
            external: [{ address: '3AFJakCxnJwX8kooj8cWZ8nh7RLu58Aymb', type: 'sh' }],
            isOwnTaproot: false,
            isOwnNested: false,
            isOwnNative: false,
          },
          blockHeight: 863340,
          blockTime: 1727603401,
          assetInTx: 'runes',
          txType: 'burn',
          runes: {
            hasMore: false,
            items: [
              {
                address: 'bc1phrkher5h44sx4pelukf6kwahladmhzs9l96us8mcnqhxsd90cfyq9gm0l2',
                incoming: '882500000000',
                outgoing: '888000000000',
                received: '0',
                runeId: '840080:127',
                sent: '5500000000',
                symbol: '#',
                name: 'RUNE840080:127',
                divisibility: new BigNumber('4'),
                inscriptionId: 'inscription840080:127',
              },
            ],
          },
        },
      ],
      offset: 0,
      limit: 10,
    });
  });

  it('should enhance two txs with total client runes info', async () => {
    // Mock transactions with rune activities
    mockGetPastBtcTransactions.mockResolvedValueOnce({
      transactions: [runeBurnMinted, runeBurnPartial],
      offset: 0,
      limit: 10,
    });

    // Mock client runes info
    const clientRunesInfo = new Map<string, RuneInfo>([
      ['842994:159', mapRuneToRuneInfo(getRuneInfoMock('842994:159'))],
      ['840080:127', mapRuneToRuneInfo(getRuneInfoMock('840080:127'))],
    ]);

    const vault = new MasterVault(config);
    const xverseApiClient = new XverseApi(vault, 'Mainnet');
    const runesApiClient = getRunesClient('Mainnet');

    const result = await fetchPastBtcTransactions({
      account: { btcAddresses: ownBtcAddresses } as Account,
      offset: 0,
      limit: 10,
      clientRunesInfo,
      runesApiClient,
      xverseApiClient,
    });

    // Assertions
    expect(mockGetPastBtcTransactions).toHaveBeenCalledTimes(1);
    expect(mockGetRuneInfo).toHaveBeenCalledTimes(0);
    expect(result).toEqual({
      transactions: [
        {
          id: '0013cb4112c6cabc9bf09a29714c36c6ebd678467c3df9e328a261efc419d566',
          fees: 3432,
          satsAmount: -3432,
          hasMoreAddressesInTx: false,
          addressesInTx: { external: [], isOwnTaproot: true, isOwnNested: false, isOwnNative: false },
          blockHeight: 843090,
          blockTime: 1715481005,
          assetInTx: 'runes',
          txType: 'mintBurn',
          runes: {
            hasMore: false,
            items: [
              {
                runeId: '842994:159',
                address: '',
                sent: '0',
                received: '0',
                outgoing: '0',
                incoming: '0',
                symbol: '#',
                name: 'RUNE842994:159',
                divisibility: new BigNumber('4'),
                inscriptionId: 'inscription842994:159',
              },
            ],
          },
        },
        {
          id: 'fc7a6d09f020ba6a4835c157232318b0032f9e1fe2e6f62d8b98aab702feeb36',
          fees: 1146,
          satsAmount: 0,
          hasMoreAddressesInTx: false,
          addressesInTx: {
            external: [{ address: '3AFJakCxnJwX8kooj8cWZ8nh7RLu58Aymb', type: 'sh' }],
            isOwnTaproot: false,
            isOwnNested: false,
            isOwnNative: false,
          },
          blockHeight: 863340,
          blockTime: 1727603401,
          assetInTx: 'runes',
          txType: 'burn',
          runes: {
            hasMore: false,
            items: [
              {
                address: 'bc1phrkher5h44sx4pelukf6kwahladmhzs9l96us8mcnqhxsd90cfyq9gm0l2',
                incoming: '882500000000',
                outgoing: '888000000000',
                received: '0',
                runeId: '840080:127',
                sent: '5500000000',
                symbol: '#',
                name: 'RUNE840080:127',
                divisibility: new BigNumber('4'),
                inscriptionId: 'inscription840080:127',
              },
            ],
          },
        },
      ],
      offset: 0,
      limit: 10,
    });
  });
});
