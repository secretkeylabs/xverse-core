import axios, { AxiosInstance } from 'axios';
import { XVERSE_API_BASE_URL } from '../../constant';
import { FungibleToken, NetworkType, Rune, runeTokenToFungibleToken } from '../../types';
import { BigNumber, JSONBig } from '../../utils/bignumber';
import { RunesApiInterface } from './types';

export class RunesApi implements RunesApiInterface {
  client: AxiosInstance;

  clientBigNumber: AxiosInstance;

  constructor(network: NetworkType) {
    this.client = axios.create({
      baseURL: `${XVERSE_API_BASE_URL(network)}`,
      transformRequest: (req) => JSONBig.stringify(req),
    });

    this.clientBigNumber = axios.create({
      baseURL: `${XVERSE_API_BASE_URL(network)}`,
      transformResponse: (res, _headers, status) => {
        if (status !== 200) {
          return res;
        }
        return JSONBig.parse(res);
      },
      transformRequest: (req) => JSONBig.stringify(req),
    });
  }

  async getRuneBalance(address: string): Promise<Record<string, BigNumber>> {
    const response = await this.clientBigNumber.get<Record<string, BigNumber>>(`/v1/address/${address}/rune-balance`);
    return response.data;
  }

  async getRuneInfo(runeName: string): Promise<Rune> {
    const response = await this.clientBigNumber.get<Rune>(`/v1/runes/${runeName}`);
    return response.data;
  }

  async getRuneInfos(runeNames: string[]): Promise<Record<string, Rune>> {
    if (runeNames.length === 0) {
      return {};
    }

    const response = await this.clientBigNumber.get<Record<string, Rune>>(`/v1/runes`, {
      params: { runeNames: runeNames.join(',') },
    });
    return response.data;
  }

  async getRuneFungibleTokens(address: string): Promise<FungibleToken[]> {
    const runeBalances = await this.getRuneBalance(address);
    const runeNames = Object.keys(runeBalances);

    if (!runeNames.length) return [];

    const runeInfos = await this.getRuneInfos(runeNames);

    return runeNames
      .map((runeName) =>
        runeTokenToFungibleToken(
          runeName,
          runeBalances[runeName],
          // The API returns rune names without dots in them, so we need to remove them from the rune names
          runeInfos[runeName.replace(/[.•]/g, '')].entry.divisibility.toNumber(),
        ),
      )
      .sort((a, b) => {
        if (a.assetName < b.assetName) {
          return -1;
        }
        if (a.assetName > b.assetName) {
          return 1;
        }
        return 0;
      });
  }

  async getRuneVarintFromNum(num: BigNumber): Promise<number[]> {
    const response = await this.client.get<number[]>(`/v1/runes/tools/num-to-varint/${num.toString(10)}`);
    return response.data;
  }
}
