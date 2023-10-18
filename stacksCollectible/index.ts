/* eslint-disable @typescript-eslint/naming-convention */
import { StacksNetwork } from '@stacks/network';
import BigNumber from 'bignumber.js';
import { NftCollectionData, NonFungibleToken } from 'types';
import { getNftDetail, getNftsCollectionData } from '../api/gamma';
import { getNftsData } from '../api/stacks';
import { microstacksToStx } from '../currency';

export interface StacksCollectionData {
  collection_contract_id: string;
  collection_name: string;
  total_nft: number;
  nft_list: Array<NonFungibleToken>;
  floorprice?: number;
}
export interface StacksCollectionList {
  total: number;
  nft_collection_list: Array<StacksCollectionData>;
}

export async function getNftCollections(
  stxAddress: string,
  network: StacksNetwork,
  offset: number,
): Promise<StacksCollectionList> {
  const nfts = await getNftsData(stxAddress, network, offset);
  const collectionRecord: Record<string, StacksCollectionData> = {};

  for (const nft of nfts.results) {
    const principal: string[] = nft.asset_identifier.split('::');
    const contractInfo: string[] = principal[0].split('.');

    if (contractInfo[1] === 'bns') {
      //make custom collection for bns names
      const bnsCollection: StacksCollectionData = {
        collection_contract_id: 'bns',
        collection_name: 'BNS Names',
        total_nft: 1,
        nft_list: [nft],
      };
      collectionRecord[bnsCollection.collection_contract_id] = bnsCollection;
    } else {
      const contractId = principal[0];

      const detail = await getNftDetail(nft.value.repr.replace('u', ''), contractInfo[0], contractInfo[1]);
      if (detail) {
        nft.data = detail.data;
      }

      //get collection data for nft
      const collectionData: NftCollectionData = await getNftsCollectionData(contractId);
      if (collectionRecord[contractId]) {
        const data = collectionRecord[contractId];
        data.nft_list.push(nft);
        data.total_nft += 1;
      } else {
        collectionRecord[contractId] = {
          collection_contract_id: contractId,
          collection_name: collectionData?.collection?.name ?? contractId,
          total_nft: 1,
          nft_list: [nft],
          floorprice: microstacksToStx(new BigNumber(collectionData?.collection.floorItem.price)).toNumber() ?? 0,
        };
      }
    }
  }
  const nft_collection_list = Object.values(collectionRecord);

  //sort according to total nft in a collection
  nft_collection_list.sort((a, b) => {
    return b.total_nft - a.total_nft;
  });

  return {
    total: nft_collection_list.length,
    nft_collection_list,
  };
}
