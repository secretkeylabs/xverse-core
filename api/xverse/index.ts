import axios, { AxiosInstance, AxiosResponse } from 'axios';
import BigNumber from 'bignumber.js';
import { API_TIMEOUT_MILLI, XVERSE_API_BASE_URL } from '../../constant';
import { runeTokenToFungibleToken } from '../../fungibleTokens';
import {
  Account,
  ApiAddressHistoryResult,
  APIGetRunesActivityForAddressResponse,
  AppFeaturesBody,
  AppFeaturesContext,
  AppFeaturesResponse,
  AppInfo,
  Brc20TokensResponse,
  BtcFeeResponse,
  CoinsMarket,
  CoinsResponse,
  CollectionMarketDataResponse,
  CollectionsList,
  CollectionsListFilters,
  CreateRuneListingCancellationRequest,
  CreateRuneListingCancellationResponse,
  CreateRuneListingRequest,
  CreateRuneListingResponse,
  DappSectionData,
  ExchangeRateAvailableCurrencies,
  ExchangeRateList,
  ExecuteOrderRequest,
  ExecuteOrderResponse,
  ExecuteStxOrderRequest,
  ExecuteStxOrderResponse,
  ExecuteUtxoOrderRequest,
  ExecuteUtxoOrderResponse,
  FungibleTokenProtocol,
  GetDestinationTokensRequest,
  GetDestinationTokensResponse,
  GetListedUtxosRequest,
  GetListedUtxosResponse,
  GetOrderHistoryRequest,
  GetOrderHistoryResponse,
  GetQuotesRequest,
  GetQuotesResponse,
  GetRuneMarketDataRequest,
  GetSourceTokensRequest,
  GetUtxosRequest,
  GetUtxosResponse,
  HistoricalDataParamsPeriod,
  HistoricalDataResponsePrices,
  Inscription,
  InscriptionInCollectionsList,
  ListingRuneMarketInfo,
  NetworkType,
  NotificationBanner,
  OrdinalInfo,
  PlaceOrderRequest,
  PlaceOrderResponse,
  PlaceStxOrderRequest,
  PlaceStxOrderResponse,
  PlaceUtxoOrderRequest,
  PlaceUtxoOrderResponse,
  PlaceXcOrderRequest,
  PlaceXcOrderResponse,
  PrincipalToFungibleToken,
  SignedUrlResponse,
  SimplePriceResponse,
  StackerInfo,
  StackingPoolInfo,
  SubmitRuneListingCancellationRequest,
  SubmitRuneListingCancellationResponse,
  SubmitRuneListingRequest,
  SubmitRuneListingResponse,
  SupportedCurrency,
  TokenBasic,
  TokenFiatRateResponse,
  TokenStatsAndInfoResponseType,
  TopTokens,
  TopTokensResponse,
} from '../../types';
import { AxiosRateLimit } from '../../utils/axiosRateLimit';
import { getXClientVersion } from '../../utils/xClientVersion';
import { MasterVault } from '../../vaults';
import AddressRegistrars from './addressRegistrar';
import { AuthenticatedClient } from './authenticatedClient';
import {
  StarknetTransactionListRequest,
  StarknetTransactionListResponse,
  StarknetTokenBalancesRequest,
  StarknetTokenBalancesResponse,
} from '../../types/api/xverse/starknet';

const produceHistoricalDataObject = (timestamp: number, price: number) => ({
  x: timestamp,
  y: price,
  tooltipLabel: new Date(timestamp).toLocaleString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }),
});

export class XverseApi {
  private client: AxiosInstance;

  private authenticatedClient: AuthenticatedClient;

  private network: NetworkType;

  rateLimiter: AxiosRateLimit;

  static readonly addressRegistrars = AddressRegistrars;

  constructor(vault: MasterVault, network: NetworkType) {
    this.client = axios.create({
      baseURL: XVERSE_API_BASE_URL(network),
      headers: {
        'Content-Type': 'application/json',
        'X-Client-Version': getXClientVersion() || undefined,
      },
    });

    this.authenticatedClient = new AuthenticatedClient(
      {
        baseURL: XVERSE_API_BASE_URL(network),
        headers: {
          'Content-Type': 'application/json',
          'X-Client-Version': getXClientVersion() || undefined,
        },
      },
      vault,
      network,
    );

    // we create a shared rate limiter for the client and the authenticated client
    this.rateLimiter = new AxiosRateLimit([this.client, this.authenticatedClient], {
      maxRPS: 10,
    });

    this.network = network;
  }

  fetchBtcFeeRate = async (): Promise<BtcFeeResponse> => {
    const response = await this.client.get('/v1/fees/btc');
    return response.data;
  };

  fetchStxToBtcRate = async (): Promise<BigNumber> => {
    const response = await this.client.get('/v1/prices/stx/btc', { timeout: API_TIMEOUT_MILLI });
    return new BigNumber(response.data.stxBtcRate.toString());
  };

  fetchBtcToCurrencyRate = async ({ fiatCurrency }: { fiatCurrency: SupportedCurrency }): Promise<BigNumber> => {
    const response = await this.client.get(`/v1/prices/btc/${fiatCurrency}`, { timeout: API_TIMEOUT_MILLI });
    return new BigNumber(response.data.btcFiatRate.toString());
  };

  fetchTokenFiateRate = async (ft: string, fiatCurrency: string): Promise<BigNumber> => {
    const url = `/v1/prices/${ft}/${fiatCurrency}`;

    return this.client
      .get<TokenFiatRateResponse>(url, { timeout: API_TIMEOUT_MILLI })
      .then((response) => {
        return new BigNumber(response.data.tokenFiatRate);
      })
      .catch(() => {
        return new BigNumber(0);
      });
  };

  getSip10Tokens = async (contractids: string[], fiatCurrency: string): Promise<CoinsResponse> => {
    const response = await this.client.post<CoinsResponse>('/v1/sip10/tokens', {
      currency: fiatCurrency,
      coins: JSON.stringify(contractids),
    });
    return response.data;
  };

  /**
   * get BRC-20 supported tokens with the fiat rate
   * @param tickers provided to get the fiat rate along with supported tokens
   * @param fiatCurrency
   */
  getBrc20Tokens = async (tickers: string[], fiatCurrency: string): Promise<Brc20TokensResponse> => {
    const response = await this.client.get<Brc20TokensResponse>('/v1/brc20/tokens', {
      params: {
        currency: fiatCurrency,
        tickers: tickers,
      },
    });
    return response.data;
  };

  getTokenStatsAndInfo = async (
    id: string,
    protocol: FungibleTokenProtocol,
  ): Promise<TokenStatsAndInfoResponseType> => {
    const response = await this.client.get<TokenStatsAndInfoResponseType>('/v2/token-stats-and-info', {
      params: { id, protocol },
    });
    return response.data;
  };

  /**
   * get rune fiat rate data
   * @param runeNames provided to get the fiat rates of supported tokens from coingecko
   * @param fiatCurrency
   * @deprecated use getRuneFiatRatesByRuneIds instead
   */
  getRuneFiatRates = async (runeNames: string[] | string, fiatCurrency: string): Promise<SimplePriceResponse> => {
    const response = await this.client.post<SimplePriceResponse>('/v2/runes/fiat-rates', {
      currency: fiatCurrency,
      runeNames,
    });
    return response.data;
  };

  /**
   * get rune tx history for a given address and rune
   * @param address ordinal address
   * @param runeName e.g.LFG•ROCKET•RUNE
   * @param offset
   * @param limit
   */
  getRuneTxHistory = async (
    address: string,
    runeName: string,
    offset: number,
    limit: number,
  ): Promise<APIGetRunesActivityForAddressResponse> => {
    const response = await this.client.get<APIGetRunesActivityForAddressResponse>(
      `/v1/address/${address}/rune/${runeName}?offset=${offset}&limit=${limit}`,
    );
    return response.data;
  };

  fetchAppInfo = async (): Promise<AppInfo> => {
    const response = await this.client.get<AppInfo>('/v1/info');
    return response.data;
  };

  fetchStackingPoolInfo = async (): Promise<StackingPoolInfo> => {
    const response = await this.client.get<StackingPoolInfo>(`/v1/pool/info?pool_version=5`);
    return response.data;
  };

  fetchPoolStackerInfo = async (stxAddress: string): Promise<StackerInfo> => {
    const response = await this.client.get<StackerInfo>(`/v1/pool/${stxAddress}/status`);
    return response.data;
  };

  getMoonPaySignedUrl = async (unsignedUrl: string): Promise<SignedUrlResponse> => {
    const response = await this.client.post<SignedUrlResponse>('/v1/sign-url', {
      url: unsignedUrl,
    });
    return response.data;
  };

  getBinanceSignature = async (srcData: string): Promise<SignedUrlResponse> => {
    const response = await this.client.post<SignedUrlResponse>('/v1/binance/sign', {
      url: srcData,
    });
    return response.data;
  };

  getOrdinalInfo = async (ordinalId: string): Promise<OrdinalInfo> => {
    const response = await this.client.get(`/v1/ordinals/${ordinalId}`);
    return response.data;
  };

  getErc721Metadata = async (tokenContract: string, tokenId: string): Promise<string> => {
    const response = await this.client.get(`/v1/eth/${tokenContract}/${tokenId}`);
    return response.data;
  };

  /**
   * Get inscription collections by address
   * @param address ordinal address
   * @param offset
   * @param limit
   * @param filters options to star/hide certain collectibleIds or inscriptionIds
   */
  getCollections = async (
    address: string,
    offset?: number,
    limit?: number,
    filters?: CollectionsListFilters,
  ): Promise<CollectionsList> => {
    const response = await this.client.post(`/v2/address/${address}/ordinals/collections`, {
      limit,
      offset,
      filters,
    });
    return response.data;
  };

  getCollectionSpecificInscriptions = async (
    address: string,
    collectionId: string,
    offset?: number,
    limit?: number,
    filters?: CollectionsListFilters,
  ): Promise<InscriptionInCollectionsList> => {
    const response = await this.client.get(`/v1/address/${address}/ordinals/collections/${collectionId}`, {
      params: {
        limit,
        offset,
        filters,
      },
    });
    return response.data;
  };

  getCollectionMarketData = async (collectionId: string): Promise<CollectionMarketDataResponse> => {
    const response = await this.client.get(`/v1/ordinals/collections/${collectionId}`);
    return response.data;
  };

  getInscription = async (address: string, inscriptionId: string): Promise<Inscription> => {
    const response = await this.client.get(`/v1/address/${address}/ordinals/inscriptions/${inscriptionId}`);
    return response.data;
  };

  getAppConfig = async () => {
    const response = await this.client.get(`/v1/app-config`);
    return response;
  };

  getFeaturedDapps = async (): Promise<DappSectionData[]> => {
    const response = await this.client.get(`/v2/featured/dapp`);
    return response.data.featuredDapp;
  };

  getNotificationBanners = async (): Promise<NotificationBanner[]> => {
    const response = await this.client.get(`/v2/notification-banners`);
    return response.data.notificationBanners;
  };

  getCoinsMarketData = async (ids: string[]): Promise<CoinsMarket[]> => {
    const response = await this.client.get(`/v2/coins-market-data?ids=${ids.join(',')}`);
    return response.data;
  };

  getExchangeRate = async (currency: ExchangeRateAvailableCurrencies): Promise<ExchangeRateList> => {
    const response = await this.client.get(`/v2/exchange-rate?currency=${currency}`);
    return response.data;
  };

  getHistoricalData = async (
    id: 'btc' | 'stx' | string,
    period: HistoricalDataParamsPeriod,
    exchangeRate = 1,
  ): Promise<HistoricalDataResponsePrices> => {
    const idMap: Record<string, string> = {
      btc: 'bitcoin',
      stx: 'stacks',
    };
    const formattedId = idMap[id.toLowerCase()] || id.toLowerCase();

    const response = await this.client.get<[number, number][]>(
      `/v2/historical-data?id=${formattedId}&period=${period}`,
    );
    return response.data.map(([timestamp, price]) => produceHistoricalDataObject(timestamp, price * exchangeRate));
  };

  getSpamTokensList = async () => {
    const response = await this.client.get(`/v1/spam-tokens`);
    return response.data;
  };

  getTopTokens = async (): Promise<TopTokensResponse> => {
    const response = await this.client.get<TopTokens>('/v1/top-tokens');
    const topRunesTokens: PrincipalToFungibleToken = {};
    for (const runeId in response.data.runes) {
      const runeData = response.data.runes[runeId];
      topRunesTokens[runeId] = runeTokenToFungibleToken(runeData);
    }
    return {
      ...response.data,
      runes: topRunesTokens,
    };
  };

  getAppFeatures = async (context?: Partial<AppFeaturesContext>, headers?: Record<string, string>) => {
    const response = await this.client.post<
      AppFeaturesResponse,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- this is the axios default
      AxiosResponse<AppFeaturesResponse, any>,
      AppFeaturesBody
    >('/v1/app-features', { context: { ...context, network: this.network } }, { headers });
    return response.data;
  };

  auth = {
    ensureAccountRegistered: async (account: Account) => {
      const addresses = Object.values(account.btcAddresses).map((a) => a.address);
      const alreadyAuthorized = await this.authenticatedClient.hasScope(addresses);

      if (alreadyAuthorized) {
        return;
      }

      if (account.accountType === 'ledger' || account.accountType === 'keystone') {
        const addressesToRegister = Object.values(account.btcAddresses).map((a) => a.address);
        return this.authenticatedClient.extend(addressesToRegister);
      }

      return this.authenticatedClient.extendSoftwareAccountScope(account);
    },
  };

  account = {
    fetchAddressBtcHistory: async (
      addresses: string[],
      options?: {
        offset?: number;
        limit?: number;
      },
    ): Promise<ApiAddressHistoryResult> => {
      const response = await this.authenticatedClient.get<ApiAddressHistoryResult>(`/v1/account/history`, {
        params: {
          addresses,
          ...options,
        },
      });
      return response.data;
    },

    fetchAccountBtcHistory: async (
      account: Account,
      options?: {
        offset?: number;
        limit?: number;
      },
    ): Promise<ApiAddressHistoryResult> => {
      const addresses = Object.values(account.btcAddresses).map((a) => a.address);
      return this.account.fetchAddressBtcHistory(addresses, options);
    },
  };

  listings = {
    getRuneMarketData: async (body: GetRuneMarketDataRequest): Promise<ListingRuneMarketInfo[]> => {
      const response = await this.client.post(`/v1/listings/runes/market-data`, body);
      return response.data;
    },
    getRuneSellOrder: async (body: CreateRuneListingRequest): Promise<CreateRuneListingResponse[]> => {
      const response = await this.client.post<CreateRuneListingResponse[]>('/v1/listings/runes/create-order', body);
      return response.data;
    },
    submitRuneSellOrder: async (body: SubmitRuneListingRequest[]): Promise<SubmitRuneListingResponse[]> => {
      const response = await this.client.post<SubmitRuneListingResponse[]>('/v1/listings/runes/submit-order', body);
      return response.data;
    },
    getListedUtxos: async (body: GetListedUtxosRequest): Promise<GetListedUtxosResponse> => {
      const response = await this.client.post<GetListedUtxosResponse>('/v1/listings/runes/listed-utxos', body);
      return response.data;
    },
    getRuneCancelOrder: async (
      body: CreateRuneListingCancellationRequest,
    ): Promise<CreateRuneListingCancellationResponse[]> => {
      const response = await this.client.post<CreateRuneListingCancellationResponse[]>(
        '/v1/listings/runes/create-cancellation',
        body,
      );
      return response.data;
    },
    submitRuneCancelOrder: async (
      body: SubmitRuneListingCancellationRequest,
    ): Promise<SubmitRuneListingCancellationResponse[]> => {
      const response = await this.client.post<SubmitRuneListingCancellationResponse[]>(
        '/v1/listings/runes/submit-cancellation',
        body,
      );
      return response.data;
    },
  };

  starknet = {
    getTransactionList: async (body: StarknetTransactionListRequest): Promise<StarknetTransactionListResponse> => {
      const response = await this.client.get<StarknetTransactionListResponse>(`/starknet/v1/listTransactions`, {
        params: body,
      });
      return response.data;
    },
    getTokenBalances: async (body: StarknetTokenBalancesRequest): Promise<StarknetTokenBalancesResponse> => {
      const response = await this.client.get<StarknetTokenBalancesResponse>('/starknet/v1/tokenBalances', {
        params: body,
      });
      return response.data;
    },
  };

  swaps = {
    /** Get the tokens that the user has which are supported by the swap services */
    getSourceTokens: async (body: GetSourceTokensRequest): Promise<TokenBasic[]> => {
      const response = await this.client.post<TokenBasic[]>('/v1/swaps/get-source-tokens', body);
      return response.data;
    },
    /** Get the tokens that the user can swap to, depending on the tokens they have in their wallet */
    getDestinationTokens: async (body: GetDestinationTokensRequest): Promise<GetDestinationTokensResponse> => {
      const response = await this.client.post<GetDestinationTokensResponse>('/v1/swaps/get-destination-tokens', body);
      return response.data;
    },
    /** Get quotes for a specific token swap */
    getQuotes: async (body: GetQuotesRequest): Promise<GetQuotesResponse> => {
      const response = await this.client.post<GetQuotesResponse>('/v1/swaps/get-quotes', body);
      return response.data;
    },
    /** Get utxos for a swap pair from a specific provider */
    getUtxos: async (body: GetUtxosRequest): Promise<GetUtxosResponse> => {
      const response = await this.client.post<GetUtxosResponse>('/v1/swaps/get-utxos', body);
      return response.data;
    },
    /** Place a swap order. This is for AMM providers. */
    placeOrder: async (body: PlaceOrderRequest): Promise<PlaceOrderResponse> => {
      const response = await this.client.post<PlaceOrderResponse>('/v1/swaps/place-order', body);
      return response.data;
    },
    /** Execute a swap order. This is for AMM providers. */
    executeOrder: async (body: ExecuteOrderRequest): Promise<ExecuteOrderResponse> => {
      const response = await this.client.post<ExecuteOrderResponse>('/v1/swaps/execute-order', body);
      return response.data;
    },
    /** Place a swap order. This is for STX providers. */
    placeStxOrder: async (body: PlaceStxOrderRequest): Promise<PlaceStxOrderResponse> => {
      const response = await this.client.post<PlaceStxOrderResponse>('/v1/swaps/place-stx-order', body);
      return response.data;
    },
    /** Execute a swap order. This is for STX providers. */
    executeStxOrder: async (body: ExecuteStxOrderRequest): Promise<ExecuteStxOrderResponse> => {
      const response = await this.client.post<ExecuteStxOrderResponse>('/v1/swaps/execute-stx-order', body);
      return response.data;
    },
    /** Place a swap order. This is for UTXO based providers. */
    placeUtxoOrder: async (body: PlaceUtxoOrderRequest): Promise<PlaceUtxoOrderResponse> => {
      const response = await this.client.post<PlaceUtxoOrderResponse>('/v1/swaps/place-utxo-order', body);
      return response.data;
    },
    /** Execute a swap order. This is for UTXO based providers. */
    executeUtxoOrder: async (body: ExecuteUtxoOrderRequest): Promise<ExecuteUtxoOrderResponse> => {
      const response = await this.client.post<ExecuteUtxoOrderResponse>('/v1/swaps/execute-utxo-order', body);
      return response.data;
    },
    /** Place a XC swap order. */
    placeXcOrder: async (body: PlaceXcOrderRequest): Promise<PlaceXcOrderResponse> => {
      const response = await this.client.post<PlaceXcOrderResponse>('/v1/swaps/place-xc-order', body);
      return response.data;
    },
    /** Gets order history. This is for XC providers. */
    getOrderHistory: async (body: GetOrderHistoryRequest): Promise<GetOrderHistoryResponse> => {
      const response = await this.client.post<GetOrderHistoryResponse>('/v1/swaps/get-order-history', body);
      return response.data;
    },
  };
}
