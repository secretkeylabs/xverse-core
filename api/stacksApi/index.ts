import { StacksNetworkName } from '@stacks/network';
import { NetworkType, StacksMainnet, StacksTestnet } from '../../types';
import { StacksApiProvider } from './provider';

const clients: Partial<Record<StacksNetworkName, StacksApiProvider>> = {};
const stacksNetworksMap: Record<NetworkType, StacksNetworkName> = {
  Mainnet: 'mainnet',
  Testnet: 'testnet',
  Signet: 'testnet',
};

export const getStacksApiClient = (networkType: NetworkType): StacksApiProvider => {
  const networkName = stacksNetworksMap[networkType];

  if (!clients[networkName]) {
    const network = networkType === 'Mainnet' ? StacksMainnet : StacksTestnet;
    clients[networkName] = new StacksApiProvider({ network });
  }

  return clients[networkName] as StacksApiProvider;
};

export default StacksApiProvider;
export * from './provider';
