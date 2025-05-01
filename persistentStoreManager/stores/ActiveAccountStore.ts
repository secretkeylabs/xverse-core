import { defaultMainnet } from '../../constant';
import { Account, AccountType, BtcPaymentType, SettingsNetwork } from '../../types';
import { WalletId } from '../../vaults';
import { inferStoreDefinition } from '../types';

export type ActiveAccountStore = {
  selectedAccountIndex: number;
  selectedAccountType: AccountType;
  selectedWalletId?: WalletId;
  btcPaymentAddressType: BtcPaymentType;
  network: SettingsNetwork;
};

const defaultValue: ActiveAccountStore = {
  selectedAccountIndex: 0,
  selectedAccountType: 'software',
  selectedWalletId: undefined,
  btcPaymentAddressType: 'native',
  network: defaultMainnet,
};

const storeName = 'activeAccount' as const;

export const activeAccountStore = inferStoreDefinition({
  name: storeName,
  defaultValue,
  activeVersion: 0,
  migrate: {},
  createMutators: (storeManager) => ({
    setSelectedAccount: async (account: Account) => {
      await storeManager.updateStoreValue(storeName, {
        selectedAccountIndex: account.id,
        selectedAccountType: account.accountType,
        selectedWalletId: account.walletId,
      });
    },
    setBtcPaymentAddressType: async (btcPaymentAddressType: BtcPaymentType) => {
      await storeManager.updateStoreValue(storeName, { btcPaymentAddressType });
    },
    setNetwork: async (network: SettingsNetwork) => {
      await storeManager.updateStoreValue(storeName, { network });
    },
  }),
  utils: {},
});
