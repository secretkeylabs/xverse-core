/* eslint-disable @typescript-eslint/naming-convention */
import { StacksNetwork } from '@stacks/network';
import BigNumber from 'bignumber.js';
import { NftEventsResponse, NonFungibleToken } from 'types';
import { getNftDetail, getNftsCollectionData } from '../api/gamma';
import { getNftsData } from '../api/stacks';
import { microstacksToStx } from '../currency';

export interface StacksCollectionData {
  collection_contract_id: string | null;
  collection_name: string | null;
  total_nft: number;
  thumbnail_nft: Array<NonFungibleToken>; //stores a max of four nfts
  nft_list: Array<NonFungibleToken>; //stores entire list of nft in collection
  floorprice?: number;
}
export interface StacksCollectionList {
  total: number;
  nft_collection_list: Array<StacksCollectionData>;
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

export async function getNftCollections(stxAddress: string, network: StacksNetwork): Promise<StacksCollectionList> {
  const nfts = await getAllNftContracts(stxAddress, network);
  const collectionRecord: Record<string, StacksCollectionData> = {};

  for (const nft of nfts) {
    const principal: string[] = nft.asset_identifier.split('::');
    const contractInfo: string[] = principal[0].split('.');

    if (contractInfo[1] === 'bns') {
      //make custom collection for bns names
      const bnsCollection: StacksCollectionData = {
        collection_contract_id: 'bns',
        collection_name: 'BNS Names',
        total_nft: 1,
        thumbnail_nft: [nft],
        nft_list: [nft],
      };
      collectionRecord[contractInfo[1]] = bnsCollection;
    } else {
      const contractId = principal[0];

      const detail = await getNftDetail(nft.value.repr.replace('u', ''), contractInfo[0], contractInfo[1]);
      if (detail) {
        nft.data = detail.data;
      }

      //get collection data for nft
      const collectionData = await getNftsCollectionData(contractId);

      if (collectionRecord[contractId]) {
        const data = collectionRecord[contractId];

        data.nft_list.push(nft);
        if (data.total_nft < 4) {
          data?.thumbnail_nft.push(nft);
        }
        data.total_nft += 1;
      } else {
        collectionRecord[contractId] = {
          collection_contract_id: contractId,
          collection_name: collectionData?.collection?.name ?? contractId,
          total_nft: 1,
          nft_list: [nft],
          thumbnail_nft: [nft],
          floorprice: collectionData?.collection?.floorItem?.price
            ? microstacksToStx(new BigNumber(collectionData?.collection?.floorItem?.price)).toNumber()
            : 0,
        };
      }
    }
  }

  const nft_collection_list = Object.values(collectionRecord);

  //sort according to total nft in a collection
  nft_collection_list.sort((a, b) => {
    //place bns collection at the bottom of nft list
    if (a.collection_contract_id === 'bns' || b.collection_contract_id === 'bns') return -1;
    return b.total_nft - a.total_nft;
  });

  return {
    total: nft_collection_list.length,
    nft_collection_list,
  };
}
