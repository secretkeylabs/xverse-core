import axios, { AxiosInstance, AxiosResponse } from 'axios';
import { XVERSE_API_BASE_URL } from '../../constant';
import {
  Artifact,
  Edict,
  EncodeResponse,
  FungibleToken,
  NetworkType,
  Rune,
  runeTokenToFungibleToken,
} from '../../types';
import { BigNumber, JSONBig } from '../../utils/bignumber';
import { getXClientVersion } from '../../utils/xClientVersion';

// these are static cache instances that will live for the lifetime of the application
// Rune info is immutable, so we can cache it indefinitely
const runeInfoCache = {
  network: undefined as NetworkType | undefined,
  byName: {} as Record<string, Rune>,
  byId: new Map<bigint, Rune>(),
};

const configureCacheForNetwork = (network: NetworkType): void => {
  if (runeInfoCache.network !== network) {
    runeInfoCache.network = network;
    runeInfoCache.byName = {};
    runeInfoCache.byId = new Map<bigint, Rune>();
  }
};

const getRuneInfoFromCache = (runeNameOrId: string | bigint, network: NetworkType): Rune | undefined => {
  configureCacheForNetwork(network);

  if (typeof runeNameOrId === 'bigint') {
    return runeInfoCache.byId.get(runeNameOrId);
  }
  return runeInfoCache.byName[runeNameOrId.toUpperCase()];
};

const setRuneInfoInCache = (runeInfo: Rune | undefined, network: NetworkType): void => {
  if (!runeInfo) {
    return;
  }

  configureCacheForNetwork(network);

  const [block, txIdx] = runeInfo.id.split(':').map((part) => BigInt(part));

  const runeId = (block << 16n) + txIdx;

  runeInfoCache.byName[runeInfo.entry.spaced_rune] = runeInfo;
  runeInfoCache.byId.set(runeId, runeInfo);
};

class RunesApi {
  private clientBigNumber: AxiosInstance;

  private network: NetworkType;

  constructor(network: NetworkType) {
    this.clientBigNumber = axios.create({
      baseURL: `${XVERSE_API_BASE_URL(network)}`,
      headers: {
        'Content-Type': 'application/json',
        'X-Client-Version': getXClientVersion() || undefined,
      },
      transformResponse: (res, _headers, status) => {
        if (status !== 200) {
          return res;
        }
        return JSONBig.parse(res);
      },
      transformRequest: (req) => {
        return JSONBig.stringify(req);
      },
    });

    this.network = network;
  }

  /**
   * Get the balance of all rune tokens an address has
   * @param {string} address
   * @return {Promise<Record<string, BigNumber>>}
   */
  async getRuneBalance(address: string): Promise<Record<string, BigNumber>> {
    const response = await this.clientBigNumber.get<Record<string, BigNumber>>(`/v1/address/${address}/rune-balance`);
    return response.data;
  }

  /**
   * Get the rune details given its rune name or ID
   * @param {string} runeId
   * @return {Promise<Rune>}
   */
  async getRuneInfo(runeId: bigint): Promise<Rune | undefined>;
  async getRuneInfo(runeNameOrId: string): Promise<Rune | undefined>;
  async getRuneInfo(runeNameOrId: string | bigint): Promise<Rune | undefined> {
    const cachedRuneInfo = getRuneInfoFromCache(runeNameOrId, this.network);

    if (cachedRuneInfo) {
      return cachedRuneInfo;
    }

    let response: AxiosResponse<Rune, any>;

    if (typeof runeNameOrId === 'bigint') {
      const blockHeight = runeNameOrId >> 16n;
      const txIdx = runeNameOrId - (blockHeight << 16n);
      response = await this.clientBigNumber.get<Rune>(`/v1/runes/${blockHeight}:${txIdx}`, {
        validateStatus: (status) => status === 200 || status === 404,
      });
    } else {
      response = await this.clientBigNumber.get<Rune>(`/v1/runes/${runeNameOrId.toUpperCase()}`, {
        validateStatus: (status) => status === 200 || status === 404,
      });
    }

    const runeInfo = response.status === 200 ? response.data : undefined;
    setRuneInfoInCache(runeInfo, this.network);

    return runeInfo;
  }

  /**
   * Get many rune details given a list of rune names
   * @param {string[]} runeNames
   * @return {Promise<Rune[]>}
   */
  async getRuneInfos(runeNames: string[]): Promise<Record<string, Rune>> {
    if (runeNames.length === 0) {
      return {};
    }

    const response = await this.clientBigNumber.get<Record<string, Rune>>(`/v1/runes`, {
      params: { runeNames: runeNames.join(',') },
    });
    return response.data;
  }

  /**
   * Get rune details in fungible token format
   * @param {string} address
   * @return {Promise<FungibleToken[]>}
   */
  async getRuneFungibleTokens(address: string): Promise<FungibleToken[]> {
    const runeBalances = await this.getRuneBalance(address);
    const runeNames = Object.keys(runeBalances);

    if (!runeNames.length) return [];

    const runeInfos = await this.getRuneInfos(runeNames);

    return runeNames
      .filter((runeName) => runeName in runeInfos)
      .map((runeName) =>
        runeTokenToFungibleToken(runeName, runeBalances[runeName], runeInfos[runeName].entry.divisibility.toNumber()),
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

  /**
   * Encode edicts into an op return script
   * @param payload - The payload to encode. Can have edicts and/or pointer to change output vout
   * @returns {string} - The encoded script
   */
  async getEncodedScriptHex(payload: { edicts: Edict[]; pointer?: number }): Promise<string> {
    const response = await this.clientBigNumber.post<EncodeResponse>('/v1/runes/tools/encode-edicts', { payload });

    return response.data.payload;
  }

  /**
   * Decodes a script into a RuneStone
   * @param transactionHex - The op return script to decode
   * @returns {ArtifactResponse | undefined} - The decoded script or undefined if the script is invalid
   */
  async getDecodedRuneScript(transactionHex: string): Promise<Artifact | undefined> {
    const response = await this.clientBigNumber.post<Artifact>(
      `/v1/runes/tools/decode-script`,
      { transactionHex },
      {
        validateStatus: (status) => status === 200 || status === 400,
      },
    );

    if (response.status === 400) {
      return undefined;
    }

    return response.data;
  }
}

const apiClients: Partial<Record<NetworkType, RunesApi>> = {};

export const getRunesClient = (network: NetworkType): RunesApi => {
  if (!apiClients[network]) {
    apiClients[network] = new RunesApi(network);
  }
  return apiClients[network] as RunesApi;
};
