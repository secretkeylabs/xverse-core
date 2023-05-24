export const API_TIMEOUT_MILLI = 30000;

export const ENTROPY_BYTES = 16;

export const BTC_PATH = `m/49'/0'/0'/0/0`;

export const BTC_WRAPPED_SEGWIT_PATH_PURPOSE = `m/49'/`;

export const BTC_SEGWIT_PATH_PURPOSE = `m/84'/`;

export const BTC_TAPROOT_PATH_PURPOSE = `m/86'/`;

export const BTC_PATH_WITHOUT_INDEX = `m/49'/0'/0'/0/`;

export const BTC_TESTNET_PATH_WITHOUT_INDEX = `m/49'/1'/0'/0/`;

export const BTC_TAPROOT_PATH_WITHOUT_INDEX = `m/86'/0'/0'/0/`;

export const BTC_TAPROOT_TESTNET_PATH_WITHOUT_INDEX = `m/86'/1'/0'/0/`;

export const STX_PATH_WITHOUT_INDEX = `m/44'/5757'/0'/0/`;

export const WALLET_CONFIG_PATH = `m/44/5757'/0'/1`;

export const BTC_BASE_URI_MAINNET = 'https://mempool.space/api';

export const BTC_BASE_URI_TESTNET = 'https://mempool.space/testnet/api';

export const BLOCKCYPHER_BASE_URI_MAINNET = 'https://api.blockcypher.com/v1/btc/main';

export const BLOCKCYPHER_BASE_URI_TESTNET = 'https://api.blockcypher.com/v1/btc/test3';

export const NFT_BASE_URI = 'https://gamma.io/api/v1/collections';

export const XVERSE_API_BASE_URL = 'https://api.xverse.app';

export const XVERSE_SPONSOR_URL = 'https://sponsor.xverse.app';

export const GAIA_HUB_URL = 'https://hub.blockstack.org';

export const HIRO_MAINNET_DEFAULT = 'https://api.hiro.so';

export const HIRO_TESTNET_DEFAULT = 'https://api.testnet.hiro.so';

export const ORDINALS_URL = (inscriptionId: string) =>
  `https://api.hiro.so/ordinals/v1/inscriptions/${inscriptionId}/content`;

export const ORDINALS_FT_INDEXER_API_URL = 'https://unisat.io/brc20-api-v2/address';

export const INSCRIPTION_REQUESTS_SERVICE_URL = 'https://ordinalsbot-api2.herokuapp.com/order';
