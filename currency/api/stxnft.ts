import axios from 'axios';
import { NftDetailResponse } from '../../types';
import { NFT_BASE_URI } from '../../constant';

export async function getNftDetail(
  tokenId: string,
  contractAddress: string,
  contractName: string
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
