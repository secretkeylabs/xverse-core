import axios, { AxiosResponse } from 'axios';
import BigNumber from 'bignumber.js';
import { API_TIMEOUT_MILLI, XVERSE_API_BASE_URL, XVERSE_SPONSOR_URL } from '../constant';
import {
  BtcFeeResponse,
  TokenFiatRateResponse,
  SupportedCurrency,
  CoinsResponse,
  StackingPoolInfo,
  StackerInfo,
  SignedUrlResponse,
  OrdinalInfo,
  AppInfo,
  SponsorInfoResponse,
  SponsorTransactionResponse,
} from 'types';
import { StacksTransaction } from '@stacks/transactions';
import { fetchBtcOrdinalsData } from './ordinals';

export async function fetchBtcFeeRate(): Promise<BtcFeeResponse> {
  return axios
    .get(`${XVERSE_API_BASE_URL}/v1/fees/btc`, {
      method: 'GET',
    })
    .then((response) => {
      return response.data;
    });
}

export async function fetchStxToBtcRate(): Promise<BigNumber> {
  return axios.get(`${XVERSE_API_BASE_URL}/v1/prices/stx/btc`, { timeout: API_TIMEOUT_MILLI }).then((response) => {
    return new BigNumber(response.data.stxBtcRate.toString());
  });
}

export async function fetchBtcToCurrencyRate({
  fiatCurrency,
}: {
  fiatCurrency: SupportedCurrency;
}): Promise<BigNumber> {
  return axios
    .get(`${XVERSE_API_BASE_URL}/v1/prices/btc/${fiatCurrency}`, { timeout: API_TIMEOUT_MILLI })
    .then((response) => {
      return new BigNumber(response.data.btcFiatRate.toString());
    });
}

export async function fetchTokenFiateRate(ft: string, fiatCurrency: string): Promise<BigNumber> {
  const url = `${XVERSE_API_BASE_URL}/v1/prices/${ft}/${fiatCurrency}`;

  return axios
    .get<TokenFiatRateResponse>(url, { timeout: API_TIMEOUT_MILLI })
    .then((response) => {
      return new BigNumber(response.data.tokenFiatRate);
    })
    .catch(() => {
      return new BigNumber(0);
    });
}

export async function getCoinsInfo(contractids: string[], fiatCurrency: string): Promise<CoinsResponse | null> {
  const url = `${XVERSE_API_BASE_URL}/v1/coins`;

  const requestBody = {
    currency: fiatCurrency,
    coins: JSON.stringify(contractids),
  };

  return axios
    .post<CoinsResponse>(url, requestBody)
    .then((response) => {
      return response.data;
    })
    .catch(() => {
      return null;
    });
}

export async function fetchAppInfo(): Promise<AppInfo | null> {
  const url = `${XVERSE_API_BASE_URL}/v1/info`;

  return axios
    .get<AppInfo>(url)
    .then((response) => {
      return response.data;
    })
    .catch(() => {
      return null;
    });
}

export async function fetchStackingPoolInfo(): Promise<StackingPoolInfo> {
  return fetch(`${XVERSE_API_BASE_URL}/v1/pool/info?pool_version=3`, {
    method: 'GET',
  })
    .then((response) => response.json())
    .then((response) => {
      return response;
    });
}

export async function fetchPoolStackerInfo(stxAddress: string): Promise<StackerInfo> {
  return fetch(`${XVERSE_API_BASE_URL}/v1/pool/${stxAddress}/status`, {
    method: 'GET',
  })
    .then((response) => response.json())
    .then((response) => {
      return response;
    });
}

export async function getMoonPaySignedUrl(unsignedUrl: string): Promise<SignedUrlResponse | null> {
  const url = `${XVERSE_API_BASE_URL}/v1/sign-url`;

  const requestBody = {
    url: unsignedUrl,
  };

  return axios
    .post<SignedUrlResponse>(url, requestBody)
    .then((response) => {
      return response.data;
    })
    .catch(() => {
      return null;
    });
}

export async function getBinaceSignature(srcData: string): Promise<SignedUrlResponse | null> {
  const url = `${XVERSE_API_BASE_URL}/v1/binance/sign`;

  const requestBody = {
    url: srcData,
  };

  return axios
    .post<SignedUrlResponse>(url, requestBody)
    .then((response) => {
      return response.data;
    })
    .catch(() => {
      return null;
    });
}

export async function sponsorTransaction(signedTx: StacksTransaction): Promise<string | null> {
  const sponsorUrl = `${XVERSE_SPONSOR_URL}/v1/sponsor`;

  const data = {
    tx: signedTx.serialize().toString('hex'),
  };

  return axios
    .post(sponsorUrl, data, { timeout: 45000 })
    .then((response: AxiosResponse<SponsorTransactionResponse>) => {
      return response.data.txid;
    })
    .catch(() => {
      return null;
    });
}

export async function getSponsorInfo(): Promise<boolean | null> {
  const url = `${XVERSE_SPONSOR_URL}/v1/info`;

  return axios
    .get(url)
    .then((response: AxiosResponse<SponsorInfoResponse>) => {
      return response.data.active;
    })
    .catch(() => {
      return null;
    });
}

export async function getOrdinalsByAddress(ordinalsAddress: string) {
  return fetchBtcOrdinalsData(ordinalsAddress, 'Mainnet');
}

export async function getOrdinalInfo(ordinalId: string): Promise<OrdinalInfo> {
  const ordinalInfoUrl = `${XVERSE_API_BASE_URL}/v1/ordinals/${ordinalId}`;
  const ordinalInfo = await axios.get(ordinalInfoUrl);
  return ordinalInfo.data;
}

export async function getErc721Metadata(tokenContract: string, tokenId: string): Promise<string> {
  const requestUrl = `${XVERSE_API_BASE_URL}/v1/eth/${tokenContract}/${tokenId}`;
  const erc721Metadata = await axios.get(requestUrl);
  return erc721Metadata.data;
}

export async function getAppConfig() {
  const appConfigUrl = `${XVERSE_API_BASE_URL}/v1/app-config`;
  const appConfig = await axios.get(appConfigUrl);
  return appConfig;
}
