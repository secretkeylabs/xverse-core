import { StacksMainnet } from '@stacks/network';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getNftsData } from '../../api';
import { getAllNftContracts, organizeNftsIntoCollection } from '../../stacksCollectible';
import { NftCollectionData, NftEventsResponse, NonFungibleToken } from '../../types';

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
        block_height: 3333,
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
    const maxLimit = 200;
    const totalItems = 3500; // Total should not be a multiple of the limit to test edge cases
    const expectedCalls = Math.ceil(totalItems / maxLimit);
    for (let i = 0; i < expectedCalls; i++) {
      const offset = i * maxLimit;
      const responseLimit = i === expectedCalls - 1 ? totalItems % maxLimit : maxLimit;
      vi.mocked(getNftsData).mockResolvedValueOnce(await mockResponse(offset, responseLimit, totalItems));
    }
    const contracts = await getAllNftContracts(address, network);
    expect(vi.mocked(getNftsData)).toHaveBeenCalledTimes(expectedCalls);
    expect(contracts).toHaveLength(totalItems);
    for (let i = 0; i < totalItems; i++) {
      expect(contracts[i].asset_identifier).toBe(`asset-${i}`);
    }
  });
});

describe('organizeNftsIntoCollection', () => {
  describe('real address returning duplicated holdings', () => {
    it('should return a empty object', () => {
      const nftArray: NonFungibleToken[] = [];
      const nftCollectionDataArray: NftCollectionData[] = [];
      const result = organizeNftsIntoCollection(nftArray, nftCollectionDataArray);

      const expected = {};
      expect(result).toStrictEqual(expected);
    });
    it('should return sorted all_nfts', () => {
      const nftArray: NonFungibleToken[] = [
        {
          asset_identifier: 'SP125J1ADVYWGWB9NQRCVGKYAG73R17ZNMV17XEJ7.mutant-monkeys::mutant-monkeys',
          block_height: 56107,
          tx_id: '0x90a81c4c6b364b1b7034c0a2cc10f142662c7d2af251e1fd31252a2b4b453f27',
          value: {
            hex: '0x01000000000000000000000000000007c2',
            repr: 'u1986',
          },
          identifier: {
            tokenId: '1986',
            contractName: 'mutant-monkeys',
            contractAddress: 'SP125J1ADVYWGWB9NQRCVGKYAG73R17ZNMV17XEJ7',
          },
        },
      ];
      const nftCollectionDataArray: NftCollectionData[] = [];
      const result = organizeNftsIntoCollection(nftArray, nftCollectionDataArray);

      const expected = {
        'SP125J1ADVYWGWB9NQRCVGKYAG73R17ZNMV17XEJ7.mutant-monkeys': {
          all_nfts: [
            {
              asset_identifier: 'SP125J1ADVYWGWB9NQRCVGKYAG73R17ZNMV17XEJ7.mutant-monkeys::mutant-monkeys',
              block_height: 56107,
              tx_id: '0x90a81c4c6b364b1b7034c0a2cc10f142662c7d2af251e1fd31252a2b4b453f27',
              value: {
                hex: '0x01000000000000000000000000000007c2',
                repr: 'u1986',
              },
              identifier: {
                tokenId: '1986',
                contractName: 'mutant-monkeys',
                contractAddress: 'SP125J1ADVYWGWB9NQRCVGKYAG73R17ZNMV17XEJ7',
              },
            },
          ],
          collection_id: 'SP125J1ADVYWGWB9NQRCVGKYAG73R17ZNMV17XEJ7.mutant-monkeys',
          collection_name: 'SP125J1ADVYWGWB9NQRCVGKYAG73R17ZNMV17XEJ7.mutant-monkeys',
          floor_price: 0,
        },
      };
      expect(result).toStrictEqual(expected);
    });

    it('should sort bns names', () => {
      const nftArray: NonFungibleToken[] = [
        {
          asset_identifier: 'SP000000000000000000002Q6VF78.bns::names',
          block_height: 30124,
          tx_id: '0x0eadd48d421907991ba56bbdd707f77c67e341c3ababbc0290a3e0fcac006fac',
          value: {
            hex: '0x0c00000002046e616d65020000000464756c62096e616d6573706163650200000003627463',
            repr: '(tuple (name 0x64756c62) (namespace 0x627463))',
          },
          identifier: {
            tokenId: '(tuple (name 0x64756c62) (namespace 0x627463))',
            contractName: 'names',
            contractAddress: 'SP000000000000000000002Q6VF78.bns',
          },
        },
        {
          asset_identifier: 'SP125J1ADVYWGWB9NQRCVGKYAG73R17ZNMV17XEJ7.mutant-monkeys::mutant-monkeys',
          block_height: 56107,
          tx_id: '0x90a81c4c6b364b1b7034c0a2cc10f142662c7d2af251e1fd31252a2b4b453f27',
          value: {
            hex: '0x01000000000000000000000000000007c2',
            repr: 'u1986',
          },
          identifier: {
            tokenId: '1986',
            contractName: 'mutant-monkeys',
            contractAddress: 'SP125J1ADVYWGWB9NQRCVGKYAG73R17ZNMV17XEJ7',
          },
        },
      ];
      const nftCollectionDataArray: NftCollectionData[] = [];
      const result = organizeNftsIntoCollection(nftArray, nftCollectionDataArray);

      const expected = {
        'SP125J1ADVYWGWB9NQRCVGKYAG73R17ZNMV17XEJ7.mutant-monkeys': {
          all_nfts: [
            {
              asset_identifier: 'SP125J1ADVYWGWB9NQRCVGKYAG73R17ZNMV17XEJ7.mutant-monkeys::mutant-monkeys',
              block_height: 56107,
              tx_id: '0x90a81c4c6b364b1b7034c0a2cc10f142662c7d2af251e1fd31252a2b4b453f27',
              value: {
                hex: '0x01000000000000000000000000000007c2',
                repr: 'u1986',
              },
              identifier: {
                tokenId: '1986',
                contractName: 'mutant-monkeys',
                contractAddress: 'SP125J1ADVYWGWB9NQRCVGKYAG73R17ZNMV17XEJ7',
              },
            },
          ],
          collection_id: 'SP125J1ADVYWGWB9NQRCVGKYAG73R17ZNMV17XEJ7.mutant-monkeys',
          collection_name: 'SP125J1ADVYWGWB9NQRCVGKYAG73R17ZNMV17XEJ7.mutant-monkeys',
          floor_price: 0,
        },
        bns: {
          all_nfts: [
            {
              asset_identifier: 'SP000000000000000000002Q6VF78.bns::names',
              block_height: 30124,
              tx_id: '0x0eadd48d421907991ba56bbdd707f77c67e341c3ababbc0290a3e0fcac006fac',
              value: {
                hex: '0x0c00000002046e616d65020000000464756c62096e616d6573706163650200000003627463',
                repr: '(tuple (name 0x64756c62) (namespace 0x627463))',
              },
              identifier: {
                tokenId: '(tuple (name 0x64756c62) (namespace 0x627463))',
                contractName: 'names',
                contractAddress: 'SP000000000000000000002Q6VF78.bns',
              },
            },
          ],
          collection_id: 'SP000000000000000000002Q6VF78.bns',
          collection_name: 'BNS Names',
        },
      };
      expect(result).toStrictEqual(expected);
    });

    it('should return sorted all_nfts by tokenId', () => {
      const nftArray: NonFungibleToken[] = [
        {
          asset_identifier: 'SP125J1ADVYWGWB9NQRCVGKYAG73R17ZNMV17XEJ7.mutant-monkeys::mutant-monkeys',
          block_height: 56107,
          tx_id: '0x90a81c4c6b364b1b7034c0a2cc10f142662c7d2af251e1fd31252a2b4b453f27',
          value: {
            hex: '0x01000000000000000000000000000007c2',
            repr: 'u1986',
          },
          identifier: {
            tokenId: '1986',
            contractName: 'mutant-monkeys',
            contractAddress: 'SP125J1ADVYWGWB9NQRCVGKYAG73R17ZNMV17XEJ7',
          },
        },
        {
          asset_identifier: 'SP125J1ADVYWGWB9NQRCVGKYAG73R17ZNMV17XEJ7.mutant-monkeys::mutant-monkeys',
          block_height: 56107,
          tx_id: '0x90a81c4c6b364b1b7034c0a2cc10f142662c7d2af251e1fd31252a2b4b453f27',
          value: {
            hex: '0x01000000000000000000000000000007c2',
            repr: 'u1222',
          },
          identifier: {
            tokenId: '1222',
            contractName: 'mutant-monkeys',
            contractAddress: 'SP125J1ADVYWGWB9NQRCVGKYAG73R17ZNMV17XEJ7',
          },
        },
      ];
      const nftCollectionDataArray: NftCollectionData[] = [];
      const result = organizeNftsIntoCollection(nftArray, nftCollectionDataArray);

      const expectedAllNfts = [
        {
          asset_identifier: 'SP125J1ADVYWGWB9NQRCVGKYAG73R17ZNMV17XEJ7.mutant-monkeys::mutant-monkeys',
          block_height: 56107,
          tx_id: '0x90a81c4c6b364b1b7034c0a2cc10f142662c7d2af251e1fd31252a2b4b453f27',
          value: {
            hex: '0x01000000000000000000000000000007c2',
            repr: 'u1222',
          },
          identifier: {
            tokenId: '1222',
            contractName: 'mutant-monkeys',
            contractAddress: 'SP125J1ADVYWGWB9NQRCVGKYAG73R17ZNMV17XEJ7',
          },
        },
        {
          asset_identifier: 'SP125J1ADVYWGWB9NQRCVGKYAG73R17ZNMV17XEJ7.mutant-monkeys::mutant-monkeys',
          block_height: 56107,
          tx_id: '0x90a81c4c6b364b1b7034c0a2cc10f142662c7d2af251e1fd31252a2b4b453f27',
          value: {
            hex: '0x01000000000000000000000000000007c2',
            repr: 'u1986',
          },
          identifier: {
            tokenId: '1986',
            contractName: 'mutant-monkeys',
            contractAddress: 'SP125J1ADVYWGWB9NQRCVGKYAG73R17ZNMV17XEJ7',
          },
        },
      ];
      const resultAllNfts = result['SP125J1ADVYWGWB9NQRCVGKYAG73R17ZNMV17XEJ7.mutant-monkeys'].all_nfts;
      expect(resultAllNfts).toStrictEqual(expectedAllNfts);
    });

    it('should return no duplicates', () => {
      const nftArray: NonFungibleToken[] = [
        {
          asset_identifier: 'SP125J1ADVYWGWB9NQRCVGKYAG73R17ZNMV17XEJ7.mutant-monkeys::mutant-monkeys',
          block_height: 56107,
          tx_id: '0x90a81c4c6b364b1b7034c0a2cc10f142662c7d2af251e1fd31252a2b4b453f27',
          value: {
            hex: '0x01000000000000000000000000000007c2',
            repr: 'u1986',
          },
          identifier: {
            tokenId: '1986',
            contractName: 'mutant-monkeys',
            contractAddress: 'SP125J1ADVYWGWB9NQRCVGKYAG73R17ZNMV17XEJ7',
          },
        },
        {
          asset_identifier: 'SP125J1ADVYWGWB9NQRCVGKYAG73R17ZNMV17XEJ7.mutant-monkeys::mutant-monkeys',
          block_height: 56107,
          tx_id: '0x90a81c4c6b364b1b7034c0a2cc10f142662c7d2af251e1fd31252a2b4b453f27',
          value: {
            hex: '0x01000000000000000000000000000007c2',
            repr: 'u1222',
          },
          identifier: {
            tokenId: '1222',
            contractName: 'mutant-monkeys',
            contractAddress: 'SP125J1ADVYWGWB9NQRCVGKYAG73R17ZNMV17XEJ7',
          },
        },
        {
          asset_identifier: 'SP125J1ADVYWGWB9NQRCVGKYAG73R17ZNMV17XEJ7.mutant-monkeys::mutant-monkeys',
          block_height: 56107,
          tx_id: '0x90a81c4c6b364b1b7034c0a2cc10f142662c7d2af251e1fd31252a2b4b453f27',
          value: {
            hex: '0x01000000000000000000000000000007c2',
            repr: 'u1986',
          },
          identifier: {
            tokenId: '1986',
            contractName: 'mutant-monkeys',
            contractAddress: 'SP125J1ADVYWGWB9NQRCVGKYAG73R17ZNMV17XEJ7',
          },
        },
      ];
      const nftCollectionDataArray: NftCollectionData[] = [];
      const result = organizeNftsIntoCollection(nftArray, nftCollectionDataArray);

      const expectedAllNfts = [
        {
          asset_identifier: 'SP125J1ADVYWGWB9NQRCVGKYAG73R17ZNMV17XEJ7.mutant-monkeys::mutant-monkeys',
          block_height: 56107,
          tx_id: '0x90a81c4c6b364b1b7034c0a2cc10f142662c7d2af251e1fd31252a2b4b453f27',
          value: {
            hex: '0x01000000000000000000000000000007c2',
            repr: 'u1222',
          },
          identifier: {
            tokenId: '1222',
            contractName: 'mutant-monkeys',
            contractAddress: 'SP125J1ADVYWGWB9NQRCVGKYAG73R17ZNMV17XEJ7',
          },
        },
        {
          asset_identifier: 'SP125J1ADVYWGWB9NQRCVGKYAG73R17ZNMV17XEJ7.mutant-monkeys::mutant-monkeys',
          block_height: 56107,
          tx_id: '0x90a81c4c6b364b1b7034c0a2cc10f142662c7d2af251e1fd31252a2b4b453f27',
          value: {
            hex: '0x01000000000000000000000000000007c2',
            repr: 'u1986',
          },
          identifier: {
            tokenId: '1986',
            contractName: 'mutant-monkeys',
            contractAddress: 'SP125J1ADVYWGWB9NQRCVGKYAG73R17ZNMV17XEJ7',
          },
        },
      ];
      const resultAllNfts = result['SP125J1ADVYWGWB9NQRCVGKYAG73R17ZNMV17XEJ7.mutant-monkeys'].all_nfts;
      expect(resultAllNfts).toStrictEqual(expectedAllNfts);
    });
  });
});
