import { NetworkType, SettingsNetwork } from './types';

export const API_TIMEOUT_MILLI = 30000;

export const ENTROPY_BYTES = 16;

// while taproot addresses have a dust value of 330, we use 546 as it is more compatible with all modern addresses
export const DEFAULT_DUST_VALUE = 546n;

export const BTC_PATH = `m/49'/0'/0'/0/0`;

export const BTC_WRAPPED_SEGWIT_PATH_PURPOSE = `m/49'/`;

export const BTC_SEGWIT_PATH_PURPOSE = `m/84'/`;

export const BTC_TAPROOT_PATH_PURPOSE = `m/86'/`;

export const BTC_PATH_WITHOUT_INDEX = `m/49'/0'/0'/0/`;

export const BTC_TESTNET_PATH_WITHOUT_INDEX = `m/49'/1'/0'/0/`;

export const BTC_TAPROOT_PATH_WITHOUT_INDEX = `m/86'/0'/0'/0/`;

export const BTC_TAPROOT_TESTNET_PATH_WITHOUT_INDEX = `m/86'/1'/0'/0/`;

export const STX_PATH_PURPOSE = `m/44'/5757'/`;

export const WALLET_CONFIG_PATH = `m/44/5757'/0'/1`;

/**
 * Network constants
 */
// BTC
export const XVERSE_BTC_BASE_URI_MAINNET = 'https://btc-1.xverse.app';
export const XVERSE_BTC_BASE_URI_TESTNET = 'https://btc-testnet.xverse.app';
export const XVERSE_BTC_BASE_URI_TESTNET4 = 'https://btc-testnet4.xverse.app';
export const XVERSE_BTC_BASE_URI_SIGNET = 'https://btc-signet.xverse.app';
export const XVERSE_BTC_BASE_URI_REGTEST = 'https://beta.sbtc-mempool.tech/api/proxy';
export const BTC_BASE_URI_MAINNET = 'https://mempool.space/api';
export const BTC_BASE_URI_TESTNET = 'https://mempool.space/testnet/api';
export const BTC_BASE_URI_TESTNET4 = 'https://mempool.space/testnet4/api';
export const BTC_BASE_URI_SIGNET = 'https://mempool.space/signet/api';
export const BTC_BASE_URI_REGTEST = 'https://beta.sbtc-mempool.tech/api/proxy';

// STX
export const HIRO_MAINNET_DEFAULT = 'https://api.hiro.so';
export const HIRO_TESTNET_DEFAULT = 'https://api.testnet.hiro.so';
// !NOTE: Signet is not supported by Hiro

export const defaultMainnet: SettingsNetwork = {
  type: 'Mainnet',
  address: HIRO_MAINNET_DEFAULT,
  btcApiUrl: XVERSE_BTC_BASE_URI_MAINNET,
  fallbackBtcApiUrl: BTC_BASE_URI_MAINNET,
};
export const defaultTestnet: SettingsNetwork = {
  type: 'Testnet',
  address: HIRO_TESTNET_DEFAULT,
  btcApiUrl: XVERSE_BTC_BASE_URI_TESTNET,
  fallbackBtcApiUrl: BTC_BASE_URI_TESTNET,
};

export const defaultTestnet4: SettingsNetwork = {
  type: 'Testnet4',
  address: HIRO_TESTNET_DEFAULT,
  btcApiUrl: XVERSE_BTC_BASE_URI_TESTNET4,
  fallbackBtcApiUrl: BTC_BASE_URI_TESTNET4,
};
export const defaultSignet: SettingsNetwork = {
  type: 'Signet',
  address: HIRO_TESTNET_DEFAULT,
  btcApiUrl: XVERSE_BTC_BASE_URI_SIGNET,
  fallbackBtcApiUrl: BTC_BASE_URI_SIGNET,
};
export const defaultRegtest: SettingsNetwork = {
  type: 'Regtest',
  address: HIRO_TESTNET_DEFAULT,
  btcApiUrl: XVERSE_BTC_BASE_URI_REGTEST,
  fallbackBtcApiUrl: BTC_BASE_URI_REGTEST,
};
export const initialNetworksList: SettingsNetwork[] = [
  { ...defaultMainnet },
  { ...defaultTestnet },
  { ...defaultTestnet4 },
  { ...defaultSignet },
  { ...defaultRegtest },
];

export const NFT_BASE_URI = 'https://stacks.gamma.io/api/v1/collections';

const xverseApiNetworkSuffix = (network: NetworkType, mainnetOverride = '') => {
  switch (network) {
    case 'Mainnet':
      return `${mainnetOverride}`;
    case 'Testnet':
      return '-testnet';
    case 'Testnet4':
      return '-testnet4';
    case 'Signet':
      return '-signet';
    case 'Regtest':
      return '-signet'; // prefer signet xverse api as fees are too high on testnet
    default:
      throw new Error('Invalid network');
  }
};

export const XVERSE_API_BASE_URL = (network: NetworkType) =>
  `https://api${xverseApiNetworkSuffix(network, '-3')}.xverse.app`;

export const XVERSE_INSCRIBE_URL = (network: NetworkType) =>
  `https://inscribe${xverseApiNetworkSuffix(network)}.xverse.app`;

export const XORD_URL = (network: NetworkType) => `https://inscribe${xverseApiNetworkSuffix(network)}.xverse.app`;

export const ORDINALS_URL = (network: NetworkType, inscriptionId: string) =>
  `https://ord${xverseApiNetworkSuffix(network)}.xverse.app/content/${inscriptionId}`;

export const ORDINALS_SERVICE_BASE_URL = (network: NetworkType = 'Mainnet') =>
  `https://ordinals${xverseApiNetworkSuffix(network)}.xverse.app/v1`;

export const XVERSE_SPONSOR_URL = 'https://sponsor.xverse.app';

export const GAIA_HUB_URL = 'https://hub.hiro.so';

export const BNS_CONTRACT_ID = 'SP000000000000000000002Q6VF78.bns';

export const STX_DECIMALS = 6;

export const supportedCoins = [
  {
    contract: 'SP3K8BC0PPEVCV7NZ6QSRWPQ2JE9E5B6N3PA0KBR9.age000-governance-token',
    name: 'ALEX',
  },
  {
    contract: 'SP2C2YFP12AJZB4MABJBAJ55XECVS7E4PMMZ89YZR.arkadiko-token',
    name: 'Arkadiko Token',
  },
  {
    contract: 'SP3K8BC0PPEVCV7NZ6QSRWPQ2JE9E5B6N3PA0KBR9.auto-alex',
    name: 'Auto ALEX',
  },
  {
    contract: 'SP1H1733V5MZ3SZ9XRW9FKYGEZT0JDGEB8Y634C7R.miamicoin-token-v2',
    name: 'MiamiCoin',
  },
  {
    contract: 'SPSCWDV3RKV5ZRN1FQD84YE1NQFEDJ9R1F4DYQ11.newyorkcitycoin-token-v2',
    name: 'NewYorkCityCoin',
  },
  {
    contract: 'SP2C2YFP12AJZB4MABJBAJ55XECVS7E4PMMZ89YZR.usda-token',
    name: 'USDA',
  },
  {
    contract: 'SP27BB1Y2DGSXZHS7G9YHKTSH6KQ6BD3QG0AN3CR9.vibes-token',
    name: 'Vibes',
  },
  {
    contract: 'SP3DX3H4FEYZJZ586MFBS25ZW3HZDMEW92260R2PR.Wrapped-Bitcoin',
    name: 'Wrapped Bitcoin',
  },
  {
    contract: 'SP2TZK01NKDC89J6TA56SA47SDF7RTHYEQ79AAB9A.Wrapped-USD',
    name: 'Wrapped USD',
  },
  {
    contract: 'SP3K8BC0PPEVCV7NZ6QSRWPQ2JE9E5B6N3PA0KBR9.token-susdt',
    name: 'Wrapped USDT',
  },
  {
    contract: 'SP125J1ADVYWGWB9NQRCVGKYAG73R17ZNMV17XEJ7.slime-token',
    name: 'SLIME',
  },
];

export const ORDINALS_FT_INDEXER_API_URL = 'https://unisat.io/brc20-api-v2/address';

export const GAMMA_COLLECTION_API = 'https://api.gamma.io/nft-data-service/v1/collections';
