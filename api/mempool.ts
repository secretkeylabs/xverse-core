import axios from 'axios';
import { BTC_BASE_URI_REGTEST } from '../constant';
import { NetworkType, RecommendedFeeResponse } from '../types';

const mempoolUrl = 'https://mempool.space';
const mempoolSuffix = 'api/v1';
const networkRouteMap: Record<NetworkType, string> = {
  Mainnet: `${mempoolUrl}/${mempoolSuffix}`,
  Testnet: `${mempoolUrl}/testnet/${mempoolSuffix}`,
  Signet: `${mempoolUrl}/signet/${mempoolSuffix}`,
  Regtest: BTC_BASE_URI_REGTEST,
};

const getRecommendedFees = async (network: NetworkType): Promise<RecommendedFeeResponse> => {
  const { data } = await axios.get<RecommendedFeeResponse>(`${networkRouteMap[network]}/fees/recommended`);
  return data;
};

export default {
  getRecommendedFees,
};
