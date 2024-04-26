import { StacksTransaction } from '@stacks/transactions';
import axios, { AxiosInstance, AxiosResponse } from 'axios';
import BigNumber from 'bignumber.js';
import EsploraApiProvider from '../api/esplora/esploraAPiProvider';
import { API_TIMEOUT_MILLI, XVERSE_API_BASE_URL, XVERSE_SPONSOR_URL } from '../constant';
import {
  AppFeaturesBody,
  AppFeaturesContext,
  AppFeaturesResponse,
  AppInfo,
  Brc20TokensResponse,
  BtcFeeResponse,
  CoinsResponse,
  CollectionMarketDataResponse,
  CollectionsList,
  DappSectionData,
  Inscription,
  InscriptionInCollectionsList,
  NetworkType,
  NotificationBanner,
  OrdinalInfo,
  SignedUrlResponse,
  SponsorInfoResponse,
  SponsorTransactionResponse,
  StackerInfo,
  StackingPoolInfo,
  SupportedCurrency,
  TokenFiatRateResponse,
} from '../types';
import { getXClientVersion } from '../utils/xClientVersion';
import { handleAxiosError } from './error';
import { fetchBtcOrdinalsData } from './ordinals';

class XverseApi {
  private client: AxiosInstance;

  private network: NetworkType;

  constructor(network: NetworkType) {
    this.client = axios.create({
      baseURL: XVERSE_API_BASE_URL(network),
      headers: {
        'Content-Type': 'application/json',
        'X-Client-Version': getXClientVersion() || undefined,
      },
    });

    this.network = network;
  }

  async fetchBtcFeeRate(): Promise<BtcFeeResponse> {
    const response = await this.client.get('/v1/fees/btc');
    return response.data;
  }

  async fetchStxToBtcRate(): Promise<BigNumber> {
    const response = await this.client.get('/v1/prices/stx/btc', { timeout: API_TIMEOUT_MILLI });
    return new BigNumber(response.data.stxBtcRate.toString());
  }

  async fetchBtcToCurrencyRate({ fiatCurrency }: { fiatCurrency: SupportedCurrency }): Promise<BigNumber> {
    const response = await this.client.get(`/v1/prices/btc/${fiatCurrency}`, { timeout: API_TIMEOUT_MILLI });
    return new BigNumber(response.data.btcFiatRate.toString());
  }

  async fetchTokenFiateRate(ft: string, fiatCurrency: string): Promise<BigNumber> {
    const url = `/v1/prices/${ft}/${fiatCurrency}`;

    return this.client
      .get<TokenFiatRateResponse>(url, { timeout: API_TIMEOUT_MILLI })
      .then((response) => {
        return new BigNumber(response.data.tokenFiatRate);
      })
      .catch(() => {
        return new BigNumber(0);
      });
  }

  async getCoinsInfo(contractids: string[], fiatCurrency: string): Promise<CoinsResponse> {
    const response = await this.client.post<CoinsResponse>('/v1/coins', {
      currency: fiatCurrency,
      coins: JSON.stringify(contractids),
    });
    return response.data;
  }

  /**
   * get BRC-20 supported tokens with the fiat rate
   * @param tickers provided to get the fiat rate along with supported tokens
   * @param fiatCurrency
   */
  async getBrc20Tokens(tickers: string[], fiatCurrency: string): Promise<Brc20TokensResponse> {
    const response = await this.client.get<Brc20TokensResponse>('/v1/brc20/tokens', {
      params: {
        currency: fiatCurrency,
        tickers: tickers,
      },
    });
    return response.data;
  }

  async fetchAppInfo(): Promise<AppInfo> {
    const response = await this.client.get<AppInfo>('/v1/info');
    return response.data;
  }

  async fetchStackingPoolInfo(): Promise<StackingPoolInfo> {
    const response = await this.client.get<StackingPoolInfo>(`/v1/pool/info?pool_version=5`);
    return response.data;
  }

  async fetchPoolStackerInfo(stxAddress: string): Promise<StackerInfo> {
    const response = await this.client.get<StackerInfo>(`/v1/pool/${stxAddress}/status`);
    return response.data;
  }

  async getMoonPaySignedUrl(unsignedUrl: string): Promise<SignedUrlResponse> {
    const response = await this.client.post<SignedUrlResponse>('/v1/sign-url', {
      url: unsignedUrl,
    });
    return response.data;
  }

  async getBinanceSignature(srcData: string): Promise<SignedUrlResponse> {
    const response = await this.client.post<SignedUrlResponse>('/v1/binance/sign', {
      url: srcData,
    });
    return response.data;
  }

  async getOrdinalInfo(ordinalId: string): Promise<OrdinalInfo> {
    const response = await this.client.get(`/v1/ordinals/${ordinalId}`);
    return response.data;
  }

  async getErc721Metadata(tokenContract: string, tokenId: string): Promise<string> {
    const response = await this.client.get(`/v1/eth/${tokenContract}/${tokenId}`);
    return response.data;
  }

  async getCollections(address: string, offset?: number, limit?: number): Promise<CollectionsList> {
    const response = await this.client.get(`/v1/address/${address}/ordinals/collections`, {
      params: {
        limit,
        offset,
      },
    });
    return response.data;
  }

  async getCollectionMarketData(collectionId: string): Promise<CollectionMarketDataResponse> {
    const response = await this.client.get(`/v1/ordinals/collections/${collectionId}`);
    return response.data;
  }

  async getCollectionSpecificInscriptions(
    address: string,
    collectionId: string,
    offset?: number,
    limit?: number,
  ): Promise<InscriptionInCollectionsList> {
    const response = await this.client.get(`/v1/address/${address}/ordinals/collections/${collectionId}`, {
      params: {
        limit,
        offset,
      },
    });
    return response.data;
  }

  async getInscription(address: string, inscriptionId: string): Promise<Inscription> {
    const response = await this.client.get(`/v1/address/${address}/ordinals/inscriptions/${inscriptionId}`);
    return response.data;
  }

  async getAppConfig() {
    const response = await this.client.get(`/v1/app-config`);
    return response;
  }

  async getFeaturedDapps(): Promise<DappSectionData[]> {
    const response = await this.client.get(`/v2/featured/dapp`);
    return response.data.featuredDapp;
  }

  async getNotificationBanners(): Promise<NotificationBanner[]> {
    const response = await this.client.get(`/v2/notification-banners`);
    return response.data.notificationBanners;
  }

  async getSpamTokensList() {
    const response = await this.client.get(`/v1/spam-tokens`);
    return response.data;
  }

  async getAppFeatures(context: Partial<AppFeaturesContext>) {
    const response = await this.client.post<
      AppFeaturesResponse,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- this is the axios default
      AxiosResponse<AppFeaturesResponse, any>,
      AppFeaturesBody
    >('/v1/app-features', { context: { ...context, network: this.network } });
    return response.data;
  }
}

const apiClients: Partial<Record<NetworkType, XverseApi>> = {};

export const getXverseApiClient = (network: NetworkType): XverseApi => {
  if (!apiClients[network]) {
    apiClients[network] = new XverseApi(network);
  }
  return apiClients[network] as XverseApi;
};

/**
 * @deprecated use XverseApi.fetchBtcFeeRate instead
 */
export async function fetchBtcFeeRate(network: NetworkType): Promise<BtcFeeResponse> {
  return getXverseApiClient(network).fetchBtcFeeRate();
}

/**
 * @deprecated use XverseApi.fetchStxToBtcRate instead
 */
export async function fetchStxToBtcRate(network: NetworkType): Promise<BigNumber> {
  return getXverseApiClient(network).fetchStxToBtcRate();
}

/**
 * @deprecated use XverseApi.fetchBtcToCurrencyRate instead
 */
export async function fetchBtcToCurrencyRate(
  network: NetworkType,
  { fiatCurrency }: { fiatCurrency: SupportedCurrency },
): Promise<BigNumber> {
  return getXverseApiClient(network).fetchBtcToCurrencyRate({ fiatCurrency });
}

/**
 * @deprecated use XverseApi.fetchTokenFiateRate instead
 */
export async function fetchTokenFiateRate(network: NetworkType, ft: string, fiatCurrency: string): Promise<BigNumber> {
  return getXverseApiClient(network).fetchTokenFiateRate(ft, fiatCurrency);
}

/**
 * @deprecated use XverseApi.getCoinsInfo instead
 */
export async function getCoinsInfo(
  network: NetworkType,
  contractids: string[],
  fiatCurrency: string,
): Promise<CoinsResponse | null> {
  return getXverseApiClient(network)
    .getCoinsInfo(contractids, fiatCurrency)
    .catch(() => null);
}

/**
 * @deprecated use XverseApi.getBrc20Tokens instead
 */
export async function getBrc20Tokens(
  network: NetworkType,
  tickers: string[],
  fiatCurrency: string,
): Promise<Brc20TokensResponse | null> {
  return getXverseApiClient(network)
    .getBrc20Tokens(tickers, fiatCurrency)
    .catch(() => null);
}

/**
 * @deprecated use XverseApi.fetchAppInfo instead
 */
export async function fetchAppInfo(network: NetworkType): Promise<AppInfo | null> {
  return getXverseApiClient(network)
    .fetchAppInfo()
    .catch(() => null);
}

/**
 * @deprecated use XverseApi.fetchStackingPoolInfo instead
 */
export async function fetchStackingPoolInfo(network: NetworkType): Promise<StackingPoolInfo> {
  return getXverseApiClient(network).fetchStackingPoolInfo();
}

/**
 * @deprecated use XverseApi.fetchPoolStackerInfo instead
 */
export async function fetchPoolStackerInfo(network: NetworkType, stxAddress: string): Promise<StackerInfo> {
  return getXverseApiClient(network).fetchPoolStackerInfo(stxAddress);
}

/**
 * @deprecated use XverseApi.getMoonPaySignedUrl instead
 */
export async function getMoonPaySignedUrl(
  network: NetworkType,
  unsignedUrl: string,
): Promise<SignedUrlResponse | null> {
  return getXverseApiClient(network)
    .getMoonPaySignedUrl(unsignedUrl)
    .catch(() => null);
}

/**
 * @deprecated use XverseApi.getBinanceSignature instead
 */
export async function getBinaceSignature(network: NetworkType, srcData: string): Promise<SignedUrlResponse | null> {
  return getXverseApiClient(network)
    .getBinanceSignature(srcData)
    .catch(() => null);
}

// TODO move this to another file
/**
 * Return the sponsored signed transaction
 *
 * @param {StacksTransaction} signedTx
 * @param {string} [sponsorHost] - optional host for stacks-transaction-sponsor fork
 * @returns {Promise<string>}
 * @throws {ApiResponseError} - if api responded with an error status
 */
export async function sponsorTransaction(signedTx: StacksTransaction, sponsorHost?: string): Promise<string> {
  const url = `${sponsorHost ?? XVERSE_SPONSOR_URL}/v1/sponsor`;

  const data = {
    tx: signedTx.serialize().toString(),
  };

  return axios
    .post(url, data, { timeout: 45000 })
    .then((response: AxiosResponse<SponsorTransactionResponse>) => {
      return response.data.txid;
    })
    .catch(handleAxiosError);
}

// TODO move this to another file
/**
 * Get whether sponsor service is active
 *
 * @param {string} [sponsorHost] - optional host for stacks-transaction-sponsor fork
 * @returns {Promise<boolean>}
 * @throws {ApiResponseError} - if api responded with an error status
 */
export async function getSponsorInfo(sponsorHost?: string): Promise<boolean> {
  const url = `${sponsorHost ?? XVERSE_SPONSOR_URL}/v1/info`;

  return axios
    .get(url)
    .then((response: AxiosResponse<SponsorInfoResponse>) => {
      return response.data.active;
    })
    .catch(handleAxiosError);
}

// TODO move this to another file
export async function getOrdinalsByAddress(
  esploraProvider: EsploraApiProvider,
  network: NetworkType,
  ordinalsAddress: string,
) {
  return fetchBtcOrdinalsData(ordinalsAddress, esploraProvider, network);
}

/**
 * @deprecated use XverseApi.getOrdinalInfo instead
 */
export async function getOrdinalInfo(network: NetworkType, ordinalId: string): Promise<OrdinalInfo> {
  return getXverseApiClient(network).getOrdinalInfo(ordinalId);
}

/**
 * @deprecated use XverseApi.getErc721Metadata instead
 */
export async function getErc721Metadata(network: NetworkType, tokenContract: string, tokenId: string): Promise<string> {
  return getXverseApiClient(network).getErc721Metadata(tokenContract, tokenId);
}

/**
 * @deprecated use XverseApi.getCollections instead
 */
export async function getCollections(
  network: NetworkType,
  address: string,
  offset?: number,
  limit?: number,
): Promise<CollectionsList> {
  return getXverseApiClient(network).getCollections(address, offset, limit);
}

/**
 * @deprecated use XverseApi.getCollectionMarketData instead
 */
export async function getCollectionMarketData(
  network: NetworkType,
  collectionId: string,
): Promise<CollectionMarketDataResponse> {
  return getXverseApiClient(network).getCollectionMarketData(collectionId);
}

/**
 * @deprecated use XverseApi.getCollectionSpecificInscriptions instead
 */
export async function getCollectionSpecificInscriptions(
  network: NetworkType,
  address: string,
  collectionId: string,
  offset?: number,
  limit?: number,
): Promise<InscriptionInCollectionsList> {
  return getXverseApiClient(network).getCollectionSpecificInscriptions(address, collectionId, offset, limit);
}

/**
 * @deprecated use XverseApi.getInscription instead
 */
export async function getInscription(
  network: NetworkType,
  address: string,
  inscriptionId: string,
): Promise<Inscription> {
  return getXverseApiClient(network).getInscription(address, inscriptionId);
}

/**
 * @deprecated use XverseApi.getAppConfig instead
 */
export async function getAppConfig(network: NetworkType) {
  return getXverseApiClient(network).getAppConfig();
}

/**
 * @deprecated use XverseApi.getFeaturedDapps instead
 */
export async function getFeaturedDapps(network: NetworkType): Promise<DappSectionData[]> {
  return getXverseApiClient(network).getFeaturedDapps();
}

/**
 * @deprecated use XverseApi.getSpamTokensList instead
 */
export async function getSpamTokensList(network: NetworkType) {
  return getXverseApiClient(network).getSpamTokensList();
}
