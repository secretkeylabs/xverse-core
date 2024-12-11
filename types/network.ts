export { StacksMainnet, StacksNetwork, StacksTestnet } from '@stacks/network';

export type NetworkType = 'Mainnet' | 'Testnet' | 'Signet' | 'Regtest';

export type SettingsNetwork = {
  type: NetworkType;
  address: string;
  btcApiUrl: string;
  fallbackBtcApiUrl: string;
};
