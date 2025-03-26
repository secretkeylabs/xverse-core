import * as bip32 from '@scure/bip32';

const BITCOIN_VERSIONS: bip32.Versions = { private: 0x0488ade4, public: 0x0488b21e };
const BITCOIN_TESTNET_VERSIONS: bip32.Versions = { private: 0x04358394, public: 0x043587cf };
const BITCOIN_BIP49_VERSIONS: bip32.Versions = { private: 0x049d7878, public: 0x049d7cb2 };
const BITCOIN_BIP84_VERSIONS: bip32.Versions = { private: 0x04b2430c, public: 0x04b24746 };

const BITCOIN_VERSIONS_BY_PREFIX: Record<string, bip32.Versions> = {
  x: BITCOIN_VERSIONS,
  t: BITCOIN_TESTNET_VERSIONS,
  y: BITCOIN_BIP49_VERSIONS,
  z: BITCOIN_BIP84_VERSIONS,
};

const fromExtendedKey = (key: string) => {
  const prefix = key.charAt(0);
  const versions = BITCOIN_VERSIONS_BY_PREFIX[prefix] ?? BITCOIN_VERSIONS;

  return bip32.HDKey.fromExtendedKey(key, versions);
};

export const bip32Utils = {
  fromExtendedKey,
};
