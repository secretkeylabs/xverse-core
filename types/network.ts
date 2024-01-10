export { StacksNetwork, StacksMainnet, StacksTestnet } from '@stacks/network';

export type NetworkType = 'Mainnet' | 'Testnet';

export type SettingsNetwork = {
  type: NetworkType;
  address: string;
  btcApiUrl: string;
  fallbackBtcApiUrl: string;
};
