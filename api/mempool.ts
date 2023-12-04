import axios from 'axios';
import { NetworkType, RecommendedFeeResponse } from '../types';

const getRecommendedFees = async (network: NetworkType): Promise<RecommendedFeeResponse> => {
  const { data } = await axios.get<RecommendedFeeResponse>(
    `https://mempool.space/${network === 'Mainnet' ? '' : 'testnet/'}api/v1/fees/recommended`,
  );
  return data;
};

export default {
  getRecommendedFees,
};
