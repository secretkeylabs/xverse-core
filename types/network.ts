export  { StacksNetwork, StacksMainnet, StacksTestnet } from '@stacks/network';

export type NetworkType = 'Mainnet' | 'Testnet' | 'BlockCypher';

export type SettingsNetwork = {
  type: NetworkType;
  address: string;
};
