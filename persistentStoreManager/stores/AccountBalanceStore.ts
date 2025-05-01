import type { PersistentStoreManager } from '..';
import { Account, NetworkType } from '../../types';
import { inferStoreDefinition } from '../types';

export type AccountBalancesStore = Record<string, string>;

const storeName = 'accountBalances' as const;

const utils = {
  getAccountStorageKey: (account: Account, networkType: NetworkType) => {
    if (!account) return '';
    return `${account.masterPubKey}-${account.accountType}-${account.id}-${networkType}`;
  },
};

export const accountBalanceStore = inferStoreDefinition({
  name: storeName,
  defaultValue: {} as AccountBalancesStore,
  activeVersion: 0,
  migrate: {},
  options: {
    resettable: true,
  },
  createMutators: (storeManager: PersistentStoreManager) => ({
    setAccountBalance: async (account: Account, networkType: NetworkType, balance: string | number | bigint) => {
      await storeManager.updateStoreValue(storeName, {
        [utils.getAccountStorageKey(account, networkType)]: balance.toString(),
      });
    },
    setKeyBalance: async (key: string, balance: string | number | bigint) => {
      await storeManager.updateStoreValue(storeName, {
        [key]: balance.toString(),
      });
    },
    reset: async () => {
      await storeManager.resetStoreValue(storeName);
    },
  }),
  utils,
});
