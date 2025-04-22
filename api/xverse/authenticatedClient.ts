import Transport from '@ledgerhq/hw-transport';
import { Mutex } from 'async-mutex';
import axios, {
  Axios,
  AxiosError,
  AxiosInstance,
  AxiosRequestConfig,
  AxiosResponse,
  InternalAxiosRequestConfig,
} from 'axios';
import { AddressType } from 'bitcoin-address-validation';
import { signMessageBip322 } from '../../connect';
import { Account, NetworkType } from '../../types';
import { keyValueVaultKeys, MasterVault } from '../../vaults';
import { BaseAddressRegistrar } from './addressRegistrar/base';
import { LedgerAddressRegistrar } from './addressRegistrar/ledger';
import { SoftwareAddressRegistrar } from './addressRegistrar/software';

const tokenUrl = '/v1/auth/token';
const challengeUrl = '/v1/auth/challenge';

type Token = {
  value: string;
  expiresAt: number;
};

type AuthTokens = {
  accessToken: Token;
  refreshToken: Token;
};

type SignedChallenge = {
  xPubKey: string;
  challenge: string;
  signature: string;
};

type SignedExtension = {
  pathSuffix: string;
  xPubKey: string;
  signature: string;
  type: 'p2sh' | 'p2wpkh' | 'p2tr';
};

type UnsignedExtension = {
  address: string;
};

type ChallengeResponse = {
  challenge: string;
};

type TokenChallengeRequest = {
  grantType: 'challenge';
  challengeReply: SignedChallenge;
};

type TokenRefreshRequest = {
  grantType: 'refreshToken';
  refreshToken: string;
};

type TokenResponse = {
  accessToken: Token;
  refreshToken: Token;
};

type ExtendRequest = {
  scope: {
    addresses: SignedExtension[] | UnsignedExtension[];
  };
};

type HasScopeResponse = {
  success: boolean;
};

export class AuthenticatedClient extends Axios {
  private vault: MasterVault;

  private network: NetworkType;

  private accessToken?: Token;

  private refreshToken?: Token;

  private loginMutex = new Mutex();

  private refreshMutex = new Mutex();

  private unAuthedClient: AxiosInstance;

  private AUTH_STORAGE_KEY: `authToken::${NetworkType}`;

  constructor(reqConfig: AxiosRequestConfig, vault: MasterVault, network: NetworkType) {
    // we create the proxy client to apply the default config onto the reqConfig
    const proxyClient = axios.create(reqConfig);

    super(proxyClient.defaults as AxiosRequestConfig);

    this.vault = vault;
    this.network = network;

    this.interceptors.request.use(this.requestInterceptor);
    this.interceptors.response.use(this.responseInterceptor, this.responseErrorInterceptor);

    this.unAuthedClient = axios.create(reqConfig);

    this.AUTH_STORAGE_KEY = keyValueVaultKeys.apiAuthTokens(network);
  }

  private requestInterceptor = async (reqConfig: InternalAxiosRequestConfig): Promise<InternalAxiosRequestConfig> => {
    const accessToken = await this.getAccessToken();
    reqConfig.headers.Authorization = `bearer ${accessToken}`;

    return reqConfig;
  };

  private responseInterceptor = async (resp: AxiosResponse): Promise<AxiosResponse> => {
    if (resp.status === 401) {
      await this.storeTokens(undefined);
    }

    return resp;
  };

  private responseErrorInterceptor = async (resp: AxiosError): Promise<AxiosResponse> => {
    if (resp.status === 401) {
      await this.storeTokens(undefined);

      const { config } = resp;
      if (config && !(config as any).isRetry) {
        (config as any).isRetry = true;
        return this.request(config);
      }
    }

    throw resp;
  };

  hasScope = async (addresses: string[]): Promise<boolean> => {
    const res = await this.post<HasScopeResponse>('/v1/auth/hasScope', { scope: { addresses } });
    return res.data.success;
  };

  extend = async (registrationContext: BaseAddressRegistrar | string[]): Promise<void> => {
    if (Array.isArray(registrationContext)) {
      if (!registrationContext.length) {
        return;
      }
      await this.post('/v1/auth/extendScope', {
        scope: {
          addresses: registrationContext.map((address) => ({
            address,
          })),
        },
      } as ExtendRequest);
      return;
    }

    if (!registrationContext.IsFinalized) {
      throw new Error('Address registrar is not finalized');
    }

    const addresses = Object.values(registrationContext.RegistrationData).map((data) => ({
      pathSuffix: data.pathSuffix,
      xPubKey: data.xPubKey,
      signature: data.signature,
      type: data.type,
    }));

    await this.post('/v1/auth/extendScope', { scope: { addresses } } as ExtendRequest);
  };

  extendSoftwareAccountScope = async (account: Account): Promise<void> => {
    // we refresh tokens here to ensure access token has long expiry time as it will act as our challenge
    await this.refreshTokens({ force: true });
    const accessToken = await this.getAccessToken();
    const registrar = new SoftwareAddressRegistrar(accessToken, this.network, this.vault);
    await registrar.hydrate(account);
    await this.extend(registrar);
  };

  createLedgerRegistrar = async (transport: Transport, account: number, index: number) => {
    // we refresh tokens here to ensure access token has long expiry time as it will act as our challenge
    await this.refreshTokens({ force: true });
    const accessToken = await this.getAccessToken();
    const registrar = new LedgerAddressRegistrar(accessToken, this.network, transport, account, index);
    return registrar;
  };

  private getAccessToken = async (): Promise<string> => {
    if (!this.refreshToken) {
      await this.loadTokens();
    }

    await this.refreshTokens();

    if (!this.accessToken) {
      await this.login();
    }

    const accessToken = this.accessToken?.value;

    if (!accessToken) {
      throw new Error('Something went wrong. No access token available.');
    }

    return accessToken;
  };

  private loadTokens = async (): Promise<void> => {
    const storedTokens = await this.vault.KeyValueVault.get<AuthTokens>(this.AUTH_STORAGE_KEY);

    this.accessToken = storedTokens?.accessToken;
    this.refreshToken = storedTokens?.refreshToken;
  };

  private storeTokens = async (tokens: AuthTokens | undefined): Promise<void> => {
    if (!tokens) {
      this.accessToken = undefined;
      this.refreshToken = undefined;
      await this.vault.KeyValueVault.remove(this.AUTH_STORAGE_KEY);
      return;
    }

    this.accessToken = tokens.accessToken;
    this.refreshToken = tokens.refreshToken;

    await this.vault.KeyValueVault.set<AuthTokens>(this.AUTH_STORAGE_KEY, tokens);
    return;
  };

  private refreshTokens = async ({ staleBufferSecs = 2, force = false } = {}): Promise<void> => {
    if (this.refreshMutex.isLocked()) {
      await this.refreshMutex.waitForUnlock();
      return;
    }

    const mutexRelease = await this.refreshMutex.acquire();

    try {
      if (!this.refreshToken || !this.accessToken) {
        // Need both to refresh. If one is missing, then need to login again.
        return;
      }

      if (!force) {
        const accessTokenExpired = !!(
          this.accessToken && this.accessToken.expiresAt * 1000 - Date.now() < staleBufferSecs * 1000
        );
        if (!accessTokenExpired) {
          return;
        }
      }

      const refreshTokenExpired = !!(
        this.refreshToken && this.refreshToken.expiresAt * 1000 - Date.now() < staleBufferSecs * 1000
      );
      if (refreshTokenExpired) {
        this.storeTokens(undefined);
        return;
      }

      // access token is stale, refresh it
      const refreshPayload: TokenRefreshRequest = {
        grantType: 'refreshToken',
        refreshToken: this.refreshToken.value,
      };
      const res = await this.unAuthedClient.post<TokenResponse>(tokenUrl, refreshPayload, {
        headers: { Authorization: `bearer ${this.accessToken.value}` },
      });
      this.storeTokens(res.data);
    } catch (e) {
      console.log('Failed to refresh tokens', e);
      this.storeTokens(undefined);
    } finally {
      mutexRelease();
    }
  };

  private login = async (): Promise<void> => {
    if (this.loginMutex.isLocked()) {
      await this.loginMutex.waitForUnlock();
      return;
    }

    const mutexRelease = await this.loginMutex.acquire();

    try {
      const challengeResp = await this.unAuthedClient.get<ChallengeResponse>(challengeUrl);
      const { challenge } = challengeResp.data;

      const loginData = await this.getLoginData(challenge);
      const challengePayload: TokenChallengeRequest = {
        grantType: 'challenge',
        challengeReply: loginData,
      };

      const loginResp = await this.unAuthedClient.post<TokenResponse>(tokenUrl, challengePayload);

      this.storeTokens(loginResp.data);
    } catch (e) {
      console.log('Failed to log in', e);
      this.storeTokens(undefined);
    } finally {
      mutexRelease();
    }
  };

  private getLoginData = async (challenge: string): Promise<SignedChallenge> => {
    const primaryWalletId = await this.vault.SeedVault.getPrimaryWalletId();

    if (!primaryWalletId) {
      throw new Error('Primary wallet not found');
    }

    const { rootNode } = await this.vault.SeedVault.getWalletRootNode(primaryWalletId);

    const baseKey = rootNode.derive("m/0'/0'/0'");
    const xPubKey = baseKey.publicExtendedKey;

    const challengeKey = baseKey.deriveChild(0).deriveChild(0);

    const { signature } = await signMessageBip322({
      addressType: AddressType.p2wpkh,
      message: challenge,
      network: this.network,
      privateKey: challengeKey.privateKey!,
    });

    return {
      signature,
      xPubKey,
      challenge,
    };
  };
}
