import { HDKey } from '@scure/bip32';
import {
  accountContractTemplateCreators,
  contractType,
  getAccountPrivateKey,
  getExpectedAccountContractAddress,
  getPublicKey,
} from '../starknet/utils';
import { AccountStrkAddresses, NetworkType } from '../types';
import { constants } from 'starknet';

type Args = {
  rootNode: HDKey;
  network: NetworkType;
  accountIndex: bigint;
};

export async function getAccountStrkAddresses({
  rootNode,
  network,
  accountIndex,
}: Args): Promise<AccountStrkAddresses> {
  const publicKey = getPublicKey(
    await getAccountPrivateKey({
      type: 'root-node',
      rootNode,
      accountIndex,

      // Given Starknet has its own set of testnet networks, use Sepolia whenever
      // a Bitcoin testnet is used.
      network: network === 'Mainnet' ? constants.NetworkName.SN_MAIN : constants.NetworkName.SN_SEPOLIA,
    }),
  );
  const strkAddresses: AccountStrkAddresses = {
    [contractType.AX040W0G]: {
      address: getExpectedAccountContractAddress({
        publicKey: publicKey,
        contractDescription: accountContractTemplateCreators[contractType.AX040W0G]({ publicKey }),
      }),
    },
  };

  return strkAddresses;
}
