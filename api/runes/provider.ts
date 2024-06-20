import axios, { AxiosAdapter, AxiosInstance, AxiosResponse } from 'axios';
import { XVERSE_API_BASE_URL } from '../../constant';
import {
  Artifact,
  CancelOrderRequest,
  CancelOrderResponse,
  Edict,
  EncodeResponse,
  FungibleToken,
  GetRunesUtxosResponse,
  NetworkType,
  Rune,
  RuneBalance,
  SimplePriceResponse,
  RuneMarketInfo,
  RuneSellRequest,
  RuneSellResponse,
  runeTokenToFungibleToken,
  SubmitCancelOrderRequest,
  SubmitCancelOrderResponse,
  SubmitRuneSellRequest,
  SubmitRunesSellResponse,
} from '../../types';
import { JSONBig } from '../../utils/bignumber';
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

  constructor(network: NetworkType, customAdapter?: AxiosAdapter) {
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
      adapter: customAdapter,
    });

    this.network = network;
  }

  /**
   * Get the balance of all rune tokens an address has
   * @param {string} address
   * @param {boolean} includeUnconfirmed Set to true to include unconfirmed transactions
   * in the balance (default is false)
   * @return {Promise<RuneBalance[]>}
   */
  async getRuneBalances(address: string, includeUnconfirmed = false): Promise<RuneBalance[]> {
    const response = await this.clientBigNumber.get<RuneBalance[]>(`/v2/address/${address}/rune-balance`, {
      params: { includeUnconfirmed },
    });
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
   * Get rune details in fungible token format
   * @param {string} address
   * @param {boolean} includeUnconfirmed Set to true to include unconfirmed transactions
   * in the balance (default is false)
   * @return {Promise<FungibleToken[]>}
   */
  async getRuneFungibleTokens(address: string, includeUnconfirmed = false): Promise<FungibleToken[]> {
    const runeBalances = await this.getRuneBalances(address, includeUnconfirmed);
    return runeBalances
      .map((runeBalance) => runeTokenToFungibleToken(runeBalance))
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

  async getRunesSellOrder(args: RuneSellRequest): Promise<RuneSellResponse> {
    const response = await this.clientBigNumber.post<RuneSellResponse>('/v1/market/runes/create-sell-order', args);
    return response.data;
  }

  async submitRunesSellOrder(args: SubmitRuneSellRequest): Promise<SubmitRunesSellResponse> {
    const response = await this.clientBigNumber.post<SubmitRunesSellResponse>(
      '/v1/market/runes/submit-sell-order',
      args,
    );
    return response.data;
  }

  async cancelRunesSellOrder(args: CancelOrderRequest): Promise<CancelOrderResponse> {
    const response = await this.clientBigNumber.post<CancelOrderResponse>('/v1/market/runes/cancel-sell-order', args);
    return response.data;
  }

  async submitCancelRunesSellOrder(args: SubmitCancelOrderRequest): Promise<SubmitCancelOrderResponse> {
    const response = await this.clientBigNumber.post<SubmitCancelOrderResponse>(
      '/v1/market/runes/submit-cancel-order',
      args,
    );
    return response.data;
  }

  async getRunesUtxos(params: { address: string; rune: string }): Promise<GetRunesUtxosResponse> {
    const response = await this.clientBigNumber.get<GetRunesUtxosResponse>(
      `/v1/market/address/${params.address}/rune/${params.rune}/utxos`,
    );
    return response.data;
  }

  async getRuneMarketData(rune: string): Promise<RuneMarketInfo> {
    const response = await this.clientBigNumber.get(`/v1/market/runes/${rune}/market-data`);
    return response.data;
  }

  /**
   * get rune fiat rate data by runeId
   * @param {string[]|string} runeIds - provided to get the fiat rates of supported tokens from coingecko
   * @param {string} fiatCurrency
   */
  async getRuneFiatRatesByRuneIds(runeIds: string[] | string, fiatCurrency: string): Promise<SimplePriceResponse> {
    const response = await this.clientBigNumber.get<SimplePriceResponse>('/v1/runes/fiat-rates', {
      params: {
        currency: fiatCurrency,
        runeIds,
      },
    });
    return response.data;
  }
}

const apiClients: Partial<Record<NetworkType, RunesApi>> = {};

export const getRunesClient = (network: NetworkType, adapter?: AxiosAdapter): RunesApi => {
  if (!apiClients[network]) {
    apiClients[network] = new RunesApi(network, adapter);
  }
  return apiClients[network] as RunesApi;
};
