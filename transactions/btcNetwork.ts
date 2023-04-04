import { NetworkType } from "types/network";

export interface BitcoinNetwork {
  bech32: string;
  pubKeyHash: number;
  scriptHash: number;
  wif: number;
}

const bitcoinMainnet: BitcoinNetwork = {
  bech32: 'bc',
  pubKeyHash: 0x00,
  scriptHash: 0x05,
  wif: 0x80,
};

const bitcoinTestnet: BitcoinNetwork = {
  bech32: 'tb',
  pubKeyHash: 0x6f,
  scriptHash: 0xc4,
  wif: 0xef,
};

export const bitcoinNetworks: Record<NetworkType, BitcoinNetwork> = {
  Mainnet: bitcoinMainnet,
  Testnet: bitcoinTestnet,
};

export const getBtcNetwork = (networkType: NetworkType) => {
  return bitcoinNetworks[networkType];
};

