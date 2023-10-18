import axios from 'axios';
import { NftCollectionData, NftDetailResponse } from 'types';
import { GAMMA_COLLECTION_API, NFT_BASE_URI } from '../constant';

export async function getNftDetail(
  tokenId: string,
  contractAddress: string,
  contractName: string,
): Promise<NftDetailResponse> {
  const apiUrl = `${NFT_BASE_URI}/${contractAddress}.${contractName}/${tokenId}`;

  return axios
    .get<NftDetailResponse>(apiUrl, {
      timeout: 30000,
    })
    .then((response) => {
      return response.data;
    })
    .catch((error) => {
      throw error;
    });
}

export async function getNftsCollectionData(collectionId: string): Promise<NftCollectionData | undefined> {
  try {
    const apiUrl = `${GAMMA_COLLECTION_API}/${collectionId}?include=floorItem`;

    const response = await axios.get<NftCollectionData>(apiUrl, {
      timeout: 30000,
    });

    return response.data;
  } catch (error) {
    return undefined;
  }
}
