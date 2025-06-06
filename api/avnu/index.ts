import axios, { AxiosInstance, AxiosResponse } from 'axios';

interface TokenDto {
  name: string;
  symbol: string;
  address: string;
  decimals: number;
  logoUri?: string;
  coingeckoId?: string;
  verified: boolean;
  market: {
    currentPrice: number;
    priceChange1h: number;
    priceChange24h: number;
    priceChange7d: number;
    starknetTradingVolume24h: number;
    starknetTvl: number;
    starknetVolume24h: number;
  };
  tags: string[];
}

export class AvnuApi {
  private client: AxiosInstance;

  constructor(baseUrl = 'https://starknet.impulse.avnu.fi') {
    this.client = axios.create({
      baseURL: baseUrl,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }

  /**
   * Get detailed information of a token.
   * @param tokenAddress The Starknet token address (hex format).
   * @returns Promise resolving to the token details.
   */
  async getTokenInfo(tokenAddress: string): Promise<TokenDto> {
    const response: AxiosResponse<TokenDto> = await this.client.get(`/v1/tokens/${tokenAddress}`);
    return response.data;
  }
}
