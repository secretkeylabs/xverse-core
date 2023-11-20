/* eslint-disable @typescript-eslint/naming-convention */
import { StacksNetwork } from '@stacks/network';
import BigNumber from 'bignumber.js';
import { getNftsCollectionData } from '../api/gamma';
import { getNftsData } from '../api/stacks';
import { BNS_CONTRACT_ID } from '../constant';
import { microstacksToStx } from '../currency';
import { NftCollectionData, NftEventsResponse, NonFungibleToken, NonFungibleTokenApiResponse } from '../types';

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
  limit: number,
): Promise<NonFungibleTokenApiResponse[]> {
  const listofContracts: NonFungibleTokenApiResponse[] = [];

  // make initial call to get the total inscriptions count and limit
  let offset = 0;
  const response = await getNftsData(address, network, offset, limit);
  const total = response.total;
  offset += limit;
  listofContracts.push(...response.results);

  let listofContractPromises: Promise<NftEventsResponse>[] = [];

  // Make API calls in parallel to speed up fetching data
  while (offset < total) {
    listofContractPromises.push(getNftsData(address, network, offset, limit));
    offset += limit;

    if (listofContractPromises.length === 4) {
      // await promises in batches of 4
      const resolvedPromises = await Promise.all(listofContractPromises);

      resolvedPromises.forEach((resolvedPromise) => {
        listofContracts.push(...resolvedPromise.results);
      });

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

async function fetchNftData(nfts: NonFungibleTokenApiResponse[]) {
  const collectionDataPromises: Promise<NftCollectionData | undefined>[] = [];
  const collectionDataPromiseMap: Record<string, Promise<NftCollectionData | undefined>> = {};
  const nftArray: NonFungibleToken[] = [];

  for (const nft of nfts) {
    const principal: string[] = nft.asset_identifier?.split('::');
    const contractInfo: string[] = principal[0]?.split('.');
    const contractId = principal[0];

    const tokenId = nft.value.repr.replace('u', '');
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

  return { collectionData, nftArray };
}

export function organizeNFTsIntoCollection(
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
      const data = organized[contractId];
      data.all_nfts.push(nft);
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

async function fetchNFTCollectionDetailsRecord(
  nfts: NonFungibleTokenApiResponse[],
): Promise<Record<string, StacksCollectionData>> {
  const { collectionData, nftArray } = await fetchNftData(nfts);
  return organizeNFTsIntoCollection(nftArray, collectionData);
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

export async function getNftCollections(stxAddress: string, network: StacksNetwork): Promise<StacksCollectionList> {
  const nfts = await getAllNftContracts(stxAddress, network, 200); // limit: 200 is max on the API

  const collectionRecord = await fetchNFTCollectionDetailsRecord(nfts);

  const nftCollectionList = sortNftCollectionList(Object.values(collectionRecord));

  const total_nfts = nftCollectionList.reduce((total, collection) => total + collection.all_nfts.length, 0);

  return {
    total_nfts,
    results: nftCollectionList,
  };
}
