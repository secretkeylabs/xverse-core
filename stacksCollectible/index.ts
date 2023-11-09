/* eslint-disable @typescript-eslint/naming-convention */
import { StacksNetwork } from '@stacks/network';
import BigNumber from 'bignumber.js';
import { BNS_CONTRACT_ID } from '../constant';
import { NftCollectionData, NftDetailResponse, NftEventsResponse, NonFungibleToken } from 'types';
import { getNftDetail, getNftsCollectionData } from '../api/gamma';
import { getNftsData } from '../api/stacks';
import { microstacksToStx } from '../currency';
import { getCacheValue, setCacheValue } from './stacksCollectionCache';

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

export async function getAllNftContracts(address: string, network: StacksNetwork): Promise<NonFungibleToken[]> {
  const listofContracts: Array<NonFungibleToken> = [];

  //make initial call to get the total inscriptions count and limit
  let offset = 0;
  const response = await getNftsData(address, network, 0);
  const total = response.total;
  const limit = response.limit;
  offset += limit;
  listofContracts.push(...response.results);

  let listofContractPromises: Array<Promise<NftEventsResponse>> = [];

  // Make API calls in parallel to speed up fetching data
  while (offset < total) {
    // Add new promise to the array
    listofContractPromises.push(getNftsData(address, network, offset));
    offset += limit;

    // When we have 4 promises, or when we are processing the last batch
    if (listofContractPromises.length === 4 || offset >= total) {
      // Await the promises we have collected so far
      const resolvedPromises = await Promise.all(listofContractPromises);
      // Push their results into the list of contracts
      resolvedPromises.forEach((resolvedPromise) => {
        listofContracts.push(...resolvedPromise.results);
      });
      // Reset the promises array for the next batch
      listofContractPromises = [];
    }
  }

  // Handle any promises left in case total count wasn't a multiple of 4
  if (listofContractPromises.length > 0) {
    const resolvedPromises = await Promise.all(listofContractPromises);
    resolvedPromises.forEach((resolvedPromise) => {
      listofContracts.push(...resolvedPromise.results);
    });
  }
  return listofContracts;
}

async function fetchBatchData(batch: Array<NonFungibleToken>, collectionRecord: Record<string, StacksCollectionData>) {
  const nftDetailPromises: Array<Promise<NftDetailResponse>> = [];
  const collectionDataPromises: Array<Promise<NftCollectionData | undefined>> = [];
  const nftArray: Array<NonFungibleToken> = [];

  batch.forEach((nft) => {
    const principal: string[] = nft.asset_identifier?.split('::');
    const contractInfo: string[] = principal[0]?.split('.');
    const contractId = principal[0];

    if (contractInfo[1] === 'bns') {
      // no further data required for BNS, arrange into collection
      // currently stacks only supports 1 bns name per address
      const bnsCollection: StacksCollectionData = {
        collection_id: contractId,
        collection_name: 'BNS Names',
        total_nft: 1,
        thumbnail_nfts: [nft],
        all_nfts: [nft],
      };
      collectionRecord.bns = bnsCollection;
    } else {
      nftDetailPromises.push(getNftDetail(nft.value.repr.replace('u', ''), contractInfo[0], contractInfo[1]));
      collectionDataPromises.push(getNftsCollectionData(contractId));
      nftArray.push(nft);
    }
  });

  return { nftDetailPromises, collectionDataPromises, nftArray };
}

function organizeNFTsIntoCollection(
  collectionRecord: Record<string, StacksCollectionData>,
  nftArray: Array<NonFungibleToken>,
  nftDetailArray: Array<NftDetailResponse>,
  nftCollectionDataArray: Array<NftCollectionData | undefined>,
): Record<string, StacksCollectionData> {
  for (let i = 0; i < nftArray.length; i++) {
    const nft = nftArray[i];
    const principal: string[] = nft.asset_identifier.split('::');
    const contractInfo: string[] = principal[0].split('.');
    const contractId = principal[0];

    if (contractInfo[1] === 'bns') continue; //collection already assigned

    const nftDetail = nftDetailArray[i];
    const collectionData = nftCollectionDataArray[i];

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
  return collectionRecord;
}

async function fetchNFTCollectionDetailsRecord(
  nfts: NonFungibleToken[],
): Promise<Record<string, StacksCollectionData>> {
  let collectionRecord: Record<string, StacksCollectionData> = {};
  const batchSize = 10;

  for (let index = 0; index < nfts.length; index += batchSize) {
    const batch = nfts.slice(index, index + batchSize);
    const { nftDetailPromises, collectionDataPromises, nftArray } = await fetchBatchData(batch, collectionRecord);

    const resolvedNftDetailPromises = await Promise.all(nftDetailPromises);
    const resolvedCollectionDataPromises = await Promise.all(collectionDataPromises);

    collectionRecord = organizeNFTsIntoCollection(
      collectionRecord,
      nftArray,
      resolvedNftDetailPromises,
      resolvedCollectionDataPromises,
    );
  }

  return collectionRecord;
}

function sortNftCollectionList(nftCollectionList: StacksCollectionData[]) {
  //sort according to total nft in a collection
  return nftCollectionList.sort((a, b) => {
    //place bns collection at the bottom of nft list
    if (a.collection_id === BNS_CONTRACT_ID) return 1;
    else if (b.collection_id === BNS_CONTRACT_ID) return -1;
    return b.total_nft - a.total_nft;
  });
}

async function checkCacheOrFetchNFTCollection(
  stxAddress: string,
  network: StacksNetwork,
): Promise<StacksCollectionData[]> {
  const cacheKey = `nft-collection-${stxAddress}`;
  const cachedValue = getCacheValue(cacheKey);

  if (cachedValue) {
    // return data from in-memory cache
    return cachedValue;
  }

  const nfts = await getAllNftContracts(stxAddress, network);

  const collectionRecord = await fetchNFTCollectionDetailsRecord(nfts);

  const nftCollectionList = Object.values(collectionRecord);

  const sortedNftCollectionList = sortNftCollectionList(nftCollectionList);
  //store in in-memory cache
  setCacheValue(cacheKey, sortedNftCollectionList);

  return sortedNftCollectionList;
}

export async function getNftCollections(
  stxAddress: string,
  network: StacksNetwork,
  offset: number,
  limit: number,
): Promise<StacksCollectionList> {
  const nftCollectionList = await checkCacheOrFetchNFTCollection(stxAddress, network);

  const requiredSortedCollectionsData = nftCollectionList?.slice(offset, offset + limit);

  return {
    offset,
    limit,
    total: nftCollectionList.length,
    results: requiredSortedCollectionsData,
  };
}
