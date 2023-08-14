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

export const NFT_BASE_URI = 'https://stacks.gamma.io/api/v1/collections';

export const XVERSE_API_BASE_URL = 'https://api.xverse.app';

export const XVERSE_INSCRIBE_URL = 'https://inscribe.xverse.app';

export const XVERSE_SPONSOR_URL = 'https://sponsor.xverse.app';

export const GAIA_HUB_URL = 'https://hub.blockstack.org';

export const XORD_MAINNET_URL = 'https://inscribe.xverse.app';

export const HIRO_MAINNET_DEFAULT = 'https://api.hiro.so';

export const HIRO_TESTNET_DEFAULT = 'https://api.testnet.hiro.so';

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
export const ORDINALS_URL = (inscriptionId: string) => `https://ord.xverse.app/content/${inscriptionId}`;

export const ORDINALS_FT_INDEXER_API_URL = 'https://unisat.io/brc20-api-v2/address';

export const INSCRIPTION_REQUESTS_SERVICE_URL = 'https://api2.ordinalsbot.com/order';
