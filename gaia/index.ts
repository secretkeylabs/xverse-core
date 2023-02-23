import { getPublicKeyFromPrivate, publicKeyToAddress, randomBytes } from "@stacks/encryption";
import { createFetchFn } from "@stacks/network";
import { GaiaHubConfig } from "@stacks/storage";
import { Json, TokenSigner } from 'jsontokens';

interface HubInfo {
  challenge_text?: string;
  read_url_prefix: string;
}


export type FetchFn = (url: string, init?: RequestInit) => Promise<Response>;

export const getHubInfo = async (gaiaHubUrl: string, fetchFn: FetchFn = createFetchFn()) => {
  const response = await fetchFn(`${gaiaHubUrl}/hub_info`);
  const data: HubInfo = await response.json();
  return data;
};


interface GaiaAuthPayload {
  gaiaHubUrl: string;
  iss: string;
  salt: string;
  [key: string]: Json;
}

const makeGaiaAuthToken = ({
  hubInfo,
  privateKey,
  gaiaHubUrl,
}: {
  hubInfo: HubInfo;
  privateKey: string;
  gaiaHubUrl: string;
}) => {
  const challengeText = hubInfo.challenge_text;
  const iss = getPublicKeyFromPrivate(privateKey);

  const salt = randomBytes(16).toString('hex');
  const payload: GaiaAuthPayload = {
    gaiaHubUrl,
    iss,
    salt,
  };
  if (challengeText) {
    payload.gaiaChallenge = challengeText;
  }
  const token = new TokenSigner('ES256K', privateKey).sign(payload);
  return `v1:${token}`;
};


interface ConnectToGaiaOptions {
  hubInfo: HubInfo;
  privateKey: string;
  gaiaHubUrl: string;
}

export const connectToGaiaHubWithConfig = ({
  hubInfo,
  privateKey,
  gaiaHubUrl,
}: ConnectToGaiaOptions): GaiaHubConfig => {
  const readURL = hubInfo.read_url_prefix;
  const token = makeGaiaAuthToken({ hubInfo, privateKey, gaiaHubUrl });
  const address = publicKeyToAddress(getPublicKeyFromPrivate(privateKey));
  return {
    url_prefix: readURL,
    max_file_upload_size_megabytes: 100,
    address,
    token,
    server: gaiaHubUrl,
  };
};


export * from './walletConfig';
