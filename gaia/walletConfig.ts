import { connectToGaiaHub, GaiaHubConfig, uploadToGaiaHub } from '@stacks/storage';
import { decryptContent, encryptContent, getPublicKeyFromPrivate } from '@stacks/encryption';
import { createFetchFn, FetchFn } from '@stacks/network';
import { BIP32Interface } from 'bip32';
import { bytesToHex } from '@stacks/transactions';
import { WALLET_CONFIG_PATH } from '../constant';
import { Account } from 'types/account';

export interface ConfigApp {
  origin: string;
  scopes: string[];
  lastLoginAt: number;
  appIcon: string;
  name: string;
}

export interface ConfigAccount {
  username?: string;
  apps: {
    [origin: string]: ConfigApp;
  };
}

export interface WalletConfig {
  accounts: ConfigAccount[];
  meta?: {
    [key: string]: any;
  };
}

export const deriveConfigPrivateKey = (rootNode: BIP32Interface): Uint8Array => {
  const derivedConfigKey = rootNode.derivePath(WALLET_CONFIG_PATH).privateKey;
  if (!derivedConfigKey) throw new TypeError('Unable to derive config key for wallet identities');
  return derivedConfigKey;
};

export async function deriveWalletConfigKey(rootNode: BIP32Interface): Promise<string> {
  return bytesToHex(deriveConfigPrivateKey(rootNode));
}

export const createWalletGaiaConfig = async ({
  gaiaHubUrl,
  configPrivateKey,
}: {
  gaiaHubUrl: string;
  configPrivateKey: string;
}): Promise<GaiaHubConfig> => {
  return connectToGaiaHub(gaiaHubUrl, configPrivateKey);
};

export const getOrCreateWalletConfig = async ({
  configPrivateKey,
  walletAccounts,
  gaiaHubConfig,
  skipUpload,
  fetchFn = createFetchFn(),
}: {
  configPrivateKey: string;
  walletAccounts: Account[];
  gaiaHubConfig: GaiaHubConfig;
  skipUpload?: boolean;
  fetchFn?: FetchFn;
}): Promise<WalletConfig> => {
  const config = await fetchWalletConfig({ configPrivateKey, gaiaHubConfig, fetchFn });
  if (config) return config;
  const newConfig = makeWalletConfig(walletAccounts);
  if (!skipUpload) {
    await updateWalletConfig({configPrivateKey, walletAccounts, gaiaHubConfig });
  }
  return newConfig;
};

export const fetchWalletConfig = async ({
  configPrivateKey,
  gaiaHubConfig,
  fetchFn = createFetchFn(),
}: {
  configPrivateKey: string;
  gaiaHubConfig: GaiaHubConfig;
  fetchFn?: FetchFn;
}) => {
  try {
    const response = await fetchFn(
      `${gaiaHubConfig.url_prefix}${gaiaHubConfig.address}/wallet-config.json`
    );
    if (!response.ok) return null;
    const encrypted = await response.text();
    const configJSON = (await decryptContent(encrypted, {
      privateKey: configPrivateKey,
    })) as string;
    const config: WalletConfig = JSON.parse(configJSON);
    return config;
  } catch (error) {
    console.error(error);
    return null;
  }
};

export const updateWalletConfig = async ({
  walletAccounts,
  configPrivateKey,
  walletConfig: _walletConfig,
  gaiaHubConfig,
}: {
  walletAccounts: Account[];
  configPrivateKey: string;
  walletConfig?: WalletConfig;
  gaiaHubConfig: GaiaHubConfig;
}) => {
  const walletConfig = _walletConfig || makeWalletConfig(walletAccounts);
  const encrypted = await encryptWalletConfig({ configPrivateKey, walletConfig });
  await uploadToGaiaHub(
    'wallet-config.json',
    encrypted,
    gaiaHubConfig,
    undefined,
    undefined,
    undefined,
    true
  );
  return walletConfig;
};

export function makeWalletConfig(walletAccounts: Account[]): WalletConfig {
  return {
    accounts: walletAccounts.map((account: Account) => ({
      address: account.stxAddress,
      apps: {},
    })),
  };
}

export const encryptWalletConfig = async ({
  configPrivateKey,
  walletConfig,
}: {
  configPrivateKey: string;
  walletConfig: WalletConfig;
}) => {
  const publicKey = getPublicKeyFromPrivate(configPrivateKey);
  const encrypted = await encryptContent(JSON.stringify(walletConfig), { publicKey });
  return encrypted;
};
