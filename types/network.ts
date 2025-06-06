export { STACKS_MAINNET as StacksMainnet, type StacksNetwork, STACKS_TESTNET as StacksTestnet } from '@stacks/network';

export type NetworkType = 'Mainnet' | 'Testnet' | 'Testnet4' | 'Signet' | 'Regtest';

export type SettingsNetwork = {
  type: NetworkType;
  address: string;
  btcApiUrl: string;
  fallbackBtcApiUrl: string;
};
