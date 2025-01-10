import { StacksNetwork, StacksNetworkName } from '@stacks/network';
import { NetworkType } from '../../types';
import { StacksApiProvider } from './provider';

const clients: Partial<Record<StacksNetworkName, StacksApiProvider>> = {};
const stacksNetworksMap: Record<NetworkType, StacksNetworkName> = {
  Mainnet: 'mainnet',
  Testnet: 'testnet',
  Testnet4: 'testnet',
  Signet: 'testnet',
  Regtest: 'testnet', // stacks testnet uses regtest btc network
};

export const getStacksApiClient = (networkType: NetworkType): StacksApiProvider => {
  const networkName = stacksNetworksMap[networkType];

  if (!clients[networkName]) {
    const network = StacksNetwork.fromNameOrNetwork(networkName);
    clients[networkName] = new StacksApiProvider({ network });
  }

  return clients[networkName] as StacksApiProvider;
};

export default StacksApiProvider;
export * from './provider';
