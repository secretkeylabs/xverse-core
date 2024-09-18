import { StacksNetwork } from '@stacks/network';
import BigNumber from 'bignumber.js';
import { getNftsCollectionData, getNftsData } from '../api';
import { BNS_CONTRACT_ID } from '../constant';
import { microstacksToStx } from '../currency';
import {
  CollectionsListFilters,
  NftCollectionData,
  NftEventsResponse,
  NonFungibleToken,
  NonFungibleTokenApiResponse,
} from '../types';

export interface StacksCollectionData {
  collection_id: string | null;
  collection_name: string | null;
  all_nfts: NonFungibleToken[]; //stores entire list of nft in collection
  floor_price?: number;
}
export interface StacksCollectionList {
  total_nfts: number;
  results: StacksCollectionData[];
}

export async function getAllNftContracts(
  address: string,
  network: StacksNetwork,
): Promise<NonFungibleTokenApiResponse[]> {
  const BATCH_SIZE = 4;
  const MAX_LIMIT = 200;
  // make initial call to get the total inscriptions count
  const { total, results: initialResults } = await getNftsData(address, network, 0, MAX_LIMIT);
  const listOfContracts = initialResults;
  let offset = MAX_LIMIT;
  // Prepare all remaining API call promises
  const promises: Promise<NftEventsResponse>[] = [];
  while (offset < total) {
    promises.push(getNftsData(address, network, offset, MAX_LIMIT));
    offset += MAX_LIMIT;
  }
  // Process promises in batches
  for (let i = 0; i < promises.length; i += BATCH_SIZE) {
    const batch = promises.slice(i, i + BATCH_SIZE);
    const responses = await Promise.all(batch);
    responses.forEach(({ results }) => listOfContracts.push(...results));
  }
  return listOfContracts;
}

async function fetchNftData(nfts: NonFungibleTokenApiResponse[]) {
  const collectionDataPromises: Promise<NftCollectionData | undefined>[] = [];
  const collectionDataPromiseMap: Record<string, Promise<NftCollectionData | undefined>> = {};
  const nftArray: NonFungibleToken[] = [];
  for (const nft of nfts) {
    const principal: string[] = nft.asset_identifier?.split('::');
    const tokenId = nft.value.repr.replace('u', '');
    const contractId = principal[0];
    const contractInfo: string[] = contractId?.split('.');
    const contractAddress = contractInfo[0];
    const contractName = contractInfo[1];
    const nftData = {
      ...nft,
      identifier: {
        tokenId,
        contractName,
        contractAddress,
      },
    };
    if (!(contractId in collectionDataPromiseMap)) {
      collectionDataPromiseMap[contractId] = getNftsCollectionData(contractId);
    }
    collectionDataPromises.push(collectionDataPromiseMap[contractId]);
    nftArray.push(nftData);
  }
  const collectionData = await Promise.all(collectionDataPromises);
  return { collectionData, nftData: nftArray };
}

export function organizeNftsIntoCollection(
  nftArray: NonFungibleToken[],
  nftCollectionDataArray: Array<NftCollectionData | undefined>,
) {
  const organized: Record<string, StacksCollectionData> = {};
  for (let i = 0; i < nftArray.length; i++) {
    const nft = nftArray[i];
    const principal: string[] = nft.asset_identifier.split('::');
    const contractInfo: string[] = principal[0].split('.');
    const contractId = principal[0];
    if (contractInfo[1] === 'bns') {
      // currently stacks only supports 1 bns name per address
      organized.bns = {
        collection_id: contractId,
        collection_name: 'BNS Names',
        all_nfts: [nft],
      };
      continue;
    }
    const collectionData = nftCollectionDataArray[i];
    // group NFTs into collections
    if (organized[contractId]) {
      organized[contractId].all_nfts.push(nft);
    } else {
      organized[contractId] = {
        collection_id: contractId,
        collection_name: collectionData?.collection?.name ?? contractId,
        all_nfts: [nft],
        floor_price: collectionData?.collection?.floorItem?.price
          ? microstacksToStx(new BigNumber(collectionData?.collection?.floorItem?.price)).toNumber()
          : 0,
      };
    }
  }
  // sort and unique all_nfts
  Object.values(organized).forEach((collection) => {
    const map = new Map(collection.all_nfts.map((nft) => [nft.identifier.tokenId, nft]));
    const sorted = Array.from(map.values()).sort((a, b) => (a.identifier.tokenId < b.identifier.tokenId ? -1 : 1));
    collection.all_nfts = sorted;
  });
  return organized;
}

function sortNftCollectionList(nftCollectionList: StacksCollectionData[]) {
  //sort according to total nft in a collection
  return nftCollectionList.sort((a, b) => {
    //place bns collection at the bottom of nft list
    if (a.collection_id === BNS_CONTRACT_ID) return 1;
    else if (b.collection_id === BNS_CONTRACT_ID) return -1;
    return b.all_nfts.length - a.all_nfts.length;
  });
}

export function applySortAndCollectionsFilters(
  collections: StacksCollectionData[],
  filters: CollectionsListFilters = {},
): StacksCollectionData[] {
  const { showHiddenOnly = false, hiddenCollectibleIds = [], starredCollectibleIds = [] } = filters;
  const hideCollectibleIdsSet = new Set(hiddenCollectibleIds);

  if (showHiddenOnly) {
    const hiddenCollectiblesList = collections.filter(({ collection_id }) => {
      return collection_id && hideCollectibleIdsSet.has(collection_id);
    });
    return sortNftCollectionList(hiddenCollectiblesList);
  }
  const notHiddenCollectiblesList: StacksCollectionData[] = hiddenCollectibleIds.length
    ? collections.filter(({ collection_id }) => collection_id && !hideCollectibleIdsSet.has(collection_id))
    : collections;

  if (starredCollectibleIds.length === 0) return sortNftCollectionList(notHiddenCollectiblesList);

  const unstarredCollectiblesData: StacksCollectionData[] = [];
  const starredCollectiblesDataMap = new Map<StacksCollectionData, number>();
  for (const collection of notHiddenCollectiblesList) {
    const starredCollectionIndex = collection.collection_id
      ? starredCollectibleIds.indexOf(collection.collection_id)
      : -1;
    const orderedCollection = {
      ...collection,
      all_nfts: collection.all_nfts.sort((a, b) => {
        const aStarred = starredCollectibleIds.indexOf(`${a.asset_identifier}::${a.identifier.tokenId}`);
        const bStarred = starredCollectibleIds.indexOf(`${b.asset_identifier}::${b.identifier.tokenId}`);
        // Non-starred items have -1, so they should move to the right
        if (aStarred === -1) return 1;
        if (bStarred === -1) return -1;
        // Both are starred, sort by their order in starCollectibleIds
        return aStarred - bStarred;
      }),
    };
    if (starredCollectionIndex === -1) {
      unstarredCollectiblesData.push(orderedCollection);
    } else {
      starredCollectiblesDataMap.set(orderedCollection, starredCollectionIndex);
    }
  }
  const starredCollectiblesDataPlaceholder: (StacksCollectionData | undefined)[] = [];
  for (const [starredCollection, index] of starredCollectiblesDataMap.entries()) {
    starredCollectiblesDataPlaceholder[index] = starredCollection;
  }
  const starredCollectiblesData = starredCollectiblesDataPlaceholder.filter(
    (collection): collection is StacksCollectionData => !!collection,
  );
  return [...starredCollectiblesData, ...sortNftCollectionList(unstarredCollectiblesData)];
}

export async function getNftCollections(
  stxAddress: string,
  network: StacksNetwork,
  filters?: CollectionsListFilters,
): Promise<StacksCollectionList> {
  const nftContracts = await getAllNftContracts(stxAddress, network);
  const { nftData, collectionData } = await fetchNftData(nftContracts);
  const nftCollectionList = Object.values(organizeNftsIntoCollection(nftData, collectionData));
  const filteredNftCollectionList = applySortAndCollectionsFilters(nftCollectionList, filters);
  const totalNfts = filteredNftCollectionList.reduce((total, collection) => total + collection.all_nfts.length, 0);
  return {
    total_nfts: totalNfts,
    results: filteredNftCollectionList,
  };
}
