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
  total_nft: number;
  thumbnail_nfts: NonFungibleToken[]; //stores a max of four nfts
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

  //make initial call to get the total inscriptions count and limit
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

async function fetchNftData(
  nfts: NonFungibleTokenApiResponse[],
  collectionRecord: Record<string, StacksCollectionData>,
) {
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

    if (contractInfo[1] === 'bns') {
      // no further data required for BNS, arrange into collection
      // currently stacks only supports 1 bns name per address
      const bnsCollection: StacksCollectionData = {
        collection_id: contractId,
        collection_name: 'BNS Names',
        total_nft: 1,
        thumbnail_nfts: [nftData],
        all_nfts: [nftData],
      };
      collectionRecord.bns = bnsCollection;
    } else {
      if (!(contractId in collectionDataPromiseMap)) {
        collectionDataPromiseMap[contractId] = getNftsCollectionData(contractId);
      }

      collectionDataPromises.push(collectionDataPromiseMap[contractId]);
      nftArray.push(nftData);
    }
  }

  const collectionData = await Promise.all(collectionDataPromises);

  return { collectionData, nftArray };
}

function organizeNFTsIntoCollection(
  collectionRecord: Record<string, StacksCollectionData>,
  nftArray: Array<NonFungibleToken>,
  nftCollectionDataArray: Array<NftCollectionData | undefined>,
) {
  for (let i = 0; i < nftArray.length; i++) {
    const nft = nftArray[i];
    const principal: string[] = nft.asset_identifier.split('::');
    const contractInfo: string[] = principal[0].split('.');
    const contractId = principal[0];

    if (contractInfo[1] === 'bns') continue; //collection already assigned

    const collectionData = nftCollectionDataArray[i];

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

async function fetchNFTCollectionDetailsRecord(
  nfts: NonFungibleTokenApiResponse[],
): Promise<Record<string, StacksCollectionData>> {
  const collectionRecord: Record<string, StacksCollectionData> = {};

  const { collectionData, nftArray } = await fetchNftData(nfts, collectionRecord);

  organizeNFTsIntoCollection(collectionRecord, nftArray, collectionData);

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

export async function getNftCollections(stxAddress: string, network: StacksNetwork): Promise<StacksCollectionList> {
  const nfts = await getAllNftContracts(stxAddress, network, 200); // limit: 200 is max on the API

  const collectionRecord = await fetchNFTCollectionDetailsRecord(nfts);

  const nftCollectionList = sortNftCollectionList(Object.values(collectionRecord));

  const total_nfts = nftCollectionList.reduce((total, collection) => total + collection.total_nft, 0);

  return {
    total_nfts,
    results: nftCollectionList,
  };
}
