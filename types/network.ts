export  { StacksNetwork, StacksMainnet, StacksTestnet } from '@stacks/network';

export type NetworkType = 'Mainnet' | 'Testnet' | 'Regtest';

export type SettingsNetwork = {
  type: NetworkType;
  address: string;
  btcApiUrl: string;
};
