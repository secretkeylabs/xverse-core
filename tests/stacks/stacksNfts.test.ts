import { StacksMainnet } from '@stacks/network';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getNftsData } from '../../api/stacks';
import { getAllNftContracts } from '../../stacksCollectible';
import { NftEventsResponse, NonFungibleToken } from '../../types';

vi.mock('../../api/stacks', () => ({
  getNftsData: vi.fn(() => Promise.resolve({ results: [], total: 0, limit: 0, offset: 0 })),
}));

describe('getAllNftContracts', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('should fetch all NFT contracts', async () => {
    const mockResponse = (offset: number, limit: number, total: number): Promise<NftEventsResponse> => {
      const results: NonFungibleToken[] = new Array(limit).fill(null).map((_, index) => ({
        asset_identifier: `asset-${offset + index}`,
        value: {
          hex: `hex-${offset + index}`,
          repr: `repr-${offset + index}`,
        },
        tx_id: `tx-${offset + index}`,
        data: {
          asset_id: `asset-id-${offset + index}`,
          collection_contract_id: `contract-${offset + index}`,
          token_id: offset + index,
          fully_qualified_token_id: `fq-token-id-${offset + index}`,
          token_metadata: {
            image_url: `http://example.com/image-${offset + index}.png`,
            image_type: 'png',
            image_protocol: 'http',
            asset_url: `http://example.com/asset-${offset + index}.png`,
            asset_type: 'image',
            asset_protocol: 'http',
            asset_id: `asset-id-${offset + index}`,
            name: `NFT ${offset + index}`,
            contract_id: `contract-id-${offset + index}`,
          },
          nft_token_attributes: [],
          rarity_rank: 'common',
          collection_count: 10,
          rarity_score: '0.1',
        },
        name: `NFT ${offset + index}`,
      }));

      return Promise.resolve({ results, total, limit, offset });
    };

    const address = 'SP3RW6BW9F5STYG2K8XS5EP5PM33E0DNQT4XEG864';
    const network = new StacksMainnet();
    const limit = 200;
    const totalItems = 3500; // Total should not be a multiple of the limit to test edge cases
    const expectedCalls = Math.ceil(totalItems / limit);

    for (let i = 0; i < expectedCalls; i++) {
      const offset = i * limit;
      const responseLimit = i === expectedCalls - 1 ? totalItems % limit : limit;
      vi.mocked(getNftsData).mockResolvedValueOnce(await mockResponse(offset, responseLimit, totalItems));
    }

    const contracts = await getAllNftContracts(address, network, limit);

    expect(vi.mocked(getNftsData)).toHaveBeenCalledTimes(expectedCalls);
    expect(contracts).toHaveLength(totalItems);
    for (let i = 0; i < totalItems; i++) {
      expect(contracts[i].asset_identifier).toBe(`asset-${i}`);
    }
  });
});
