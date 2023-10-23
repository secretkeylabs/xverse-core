/* eslint-disable @typescript-eslint/naming-convention */
import { StacksNetwork } from '@stacks/network';
import BigNumber from 'bignumber.js';
import { NftCollectionData, NftDetailResponse, NftEventsResponse, NonFungibleToken } from 'types';
import { getNftDetail, getNftsCollectionData } from '../api/gamma';
import { getNftsData } from '../api/stacks';
import { microstacksToStx } from '../currency';

export interface StacksCollectionData {
  collection_id: string | null;
  collection_name: string | null;
  total_nft: number;
  thumbnail_nfts: Array<NonFungibleToken>; //stores a max of four nfts
  all_nfts: Array<NonFungibleToken>; //stores entire list of nft in collection
  floor_price?: number;
}
export interface StacksCollectionList {
  offset: number;
  limit: number;
  total: number;
  results: Array<StacksCollectionData>;
}

async function getAllNftContracts(address: string, network: StacksNetwork) {
  const listofContracts: Array<NonFungibleToken> = [];

  //make initial call to get the total inscriptions count and limit
  let offset = 0;
  const response = await getNftsData(address, network, 0);
  const total = response.total;
  offset += response.limit;
  listofContracts.push(...response.results);

  let listofContractPromises: Array<Promise<NftEventsResponse>> = [];

  // make API calls in parallel to speed up fetching data
  for (let i = offset; i <= total; i += response.limit) {
    listofContractPromises.push(getNftsData(address, network, i));

    if (listofContractPromises.length === 4) {
      const resolvedPromises = await Promise.all(listofContractPromises);
      resolvedPromises.forEach((resolvedPromise) => listofContracts.push(...resolvedPromise.results));
      listofContractPromises = [];
    }
  }

  return listofContracts;
}

export async function getNftCollections(
  stxAddress: string,
  network: StacksNetwork,
  offset: number,
  limit: number,
): Promise<StacksCollectionList> {
  const nfts = await getAllNftContracts(stxAddress, network);
  const collectionRecord: Record<string, StacksCollectionData> = {};

  // get NFT collection data and NFT metadata in batches
  const batchSize = 10;
  for (let index = 0; index < nfts.length; index += batchSize) {
    const nftDetailPromises: Array<Promise<NftDetailResponse>> = [];
    const collectionDataPromises: Array<Promise<NftCollectionData | undefined>> = [];
    const nftArray: Array<NonFungibleToken> = [];

    const batch = nfts.slice(index, index + batchSize);
    batch.forEach((nft) => {
      const principal: string[] = nft.asset_identifier.split('::');
      const contractInfo: string[] = principal[0].split('.');
      const contractId = principal[0];

      if (contractInfo[1] === 'bns') {
        //no further data required for BNS, arrange into collection
        const bnsCollection: StacksCollectionData = {
          collection_id: 'bns',
          collection_name: 'BNS Names',
          total_nft: 1,
          thumbnail_nfts: [nft],
          all_nfts: [nft],
        };
        collectionRecord[contractInfo[1]] = bnsCollection;
      } else {
        nftDetailPromises.push(getNftDetail(nft.value.repr.replace('u', ''), contractInfo[0], contractInfo[1]));
        collectionDataPromises.push(getNftsCollectionData(contractId));
        nftArray.push(nft);
      }
    });
    const resolvedNftDetailPromises = await Promise.all(nftDetailPromises);
    const resolvedCollectionDataPromises = await Promise.all(collectionDataPromises);

    for (let i = 0; i < nftArray.length; i++) {
      const nft = nftArray[i];
      const principal: string[] = nft.asset_identifier.split('::');
      const contractInfo: string[] = principal[0].split('.');
      const contractId = principal[0];

      if (contractInfo[1] === 'bns') continue; //collection already assigned

      const nftDetail = resolvedNftDetailPromises[i];
      const collectionData = resolvedCollectionDataPromises[i];

      if (nftDetail) nft.data = nftDetail.data;

      //group NFTs into collections
      if (collectionRecord[contractId]) {
        const data = collectionRecord[contractId];

        data.all_nfts.push(nft);
        if (data.total_nft < 4) {
          data?.thumbnail_nfts.push(nft);
        }
        data.total_nft += 1;
      } else {
        collectionRecord[contractId] = {
          collection_id: contractId,
          collection_name: collectionData?.collection?.name ?? contractId,
          total_nft: 1,
          all_nfts: [nft],
          thumbnail_nfts: [nft],
          floor_price: collectionData?.collection?.floorItem?.price
            ? microstacksToStx(new BigNumber(collectionData?.collection?.floorItem?.price)).toNumber()
            : 0,
        };
      }
    }
  }

  const nftCollectionList = Object.values(collectionRecord);

  //sort according to total nft in a collection
  nftCollectionList.sort((a, b) => {
    //place bns collection at the bottom of nft list
    if (a.collection_id === 'bns' || b.collection_id === 'bns') return -1;
    return b.total_nft - a.total_nft;
  });

  const requiredSortedCollectionsData = nftCollectionList?.slice(offset, offset + limit);

  return {
    offset,
    limit,
    total: nftCollectionList.length,
    results: requiredSortedCollectionsData,
  };
}
