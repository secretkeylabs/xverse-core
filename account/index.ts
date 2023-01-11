import { StacksMainnet, StacksTestnet } from '@stacks/network';
import { deriveRootKeychainFromMnemonic } from '@stacks/keychain';
import {
  connectToGaiaHubWithConfig,
  getHubInfo,
  getOrCreateWalletConfig,
  deriveWalletConfigKey,
  updateWalletConfig,
  createWalletGaiaConfig,
} from '../gaia';
import { fetchBtcTransactionsData, getBnsName, getConfirmedTransactions } from '../api';
import { Account, BtcAddressData, SettingsNetwork, StxTransactionListData } from '../types';
import { walletFromSeedPhrase } from '../wallet';
import { GAIA_HUB_URL } from './../constant';

export async function checkAccountActivity(
  stxAddress: string,
  btcAddress: string,
  selectedNetwork: SettingsNetwork
) {
  const stxTxHistory: StxTransactionListData = await getConfirmedTransactions({
    stxAddress,
    network: selectedNetwork,
  });
  if (stxTxHistory.totalCount !== 0) return true;
  const btcTxHistory: BtcAddressData = await fetchBtcTransactionsData(
    btcAddress,
    selectedNetwork?.type
  );
  return btcTxHistory.transactions.length !== 0;
}

export async function restoreWalletWithAccounts(
  mnemonic: string,
  selectedNetwork: SettingsNetwork,
  currentAccounts: Account[]
): Promise<Account[]> {
  const networkFetch =
    selectedNetwork.type === 'Mainnet' ? new StacksMainnet().fetchFn : new StacksTestnet().fetchFn;
  const hubInfo = await getHubInfo(GAIA_HUB_URL, networkFetch);
  const rootNode = await deriveRootKeychainFromMnemonic(mnemonic);
  const walletConfigKey = await deriveWalletConfigKey(rootNode);
  const currentGaiaConfig = connectToGaiaHubWithConfig({
    hubInfo,
    privateKey: walletConfigKey,
    gaiaHubUrl: GAIA_HUB_URL,
  });
  const walletConfig = await getOrCreateWalletConfig({
    walletAccounts: currentAccounts,
    configPrivateKey: walletConfigKey,
    gaiaHubConfig: currentGaiaConfig,
    fetchFn: networkFetch,
  });
  if (walletConfig && walletConfig.accounts.length > 0) {
    const newAccounts: Account[] = await Promise.all(
      walletConfig.accounts.map(async (_, index) => {
        let existingAccount: Account = currentAccounts[index];
        if (!existingAccount) {
          const response = await walletFromSeedPhrase({
            mnemonic,
            index: BigInt(index),
            network: selectedNetwork.type,
          });
          const username = await getBnsName(response.stxAddress, selectedNetwork);
          existingAccount = {
            id: index,
            stxAddress: response.stxAddress,
            btcAddress: response.btcAddress,
            masterPubKey: response.masterPubKey,
            stxPublicKey: response.stxPublicKey,
            btcPublicKey: response.btcPublicKey,
            bnsName: username,
          };
          return existingAccount;
        } else {
          const userName = await getBnsName(existingAccount.stxAddress, selectedNetwork);
          return {
            ...existingAccount,
            bnsName: userName,
          };
        }
      })
    );
    return newAccounts;
  }
  return currentAccounts;
}

export async function createWalletAccount(
  seedPhrase: string,
  selectedNetwork: SettingsNetwork,
  walletAccounts: Account[],
): Promise<Account[]> {
  const accountIndex = walletAccounts.length;
  const { stxAddress, btcAddress, masterPubKey, stxPublicKey, btcPublicKey } =
    await walletFromSeedPhrase({
      mnemonic: seedPhrase,
      index: BigInt(accountIndex),
      network: selectedNetwork.type,
    });
  const bnsName = await getBnsName(stxAddress, selectedNetwork);
  const updateAccountsList = [
    ...walletAccounts,
    {
      id: accountIndex,
      stxAddress,
      btcAddress,
      masterPubKey,
      stxPublicKey,
      btcPublicKey,
      bnsName,
    },
  ];
  const rootNode = await deriveRootKeychainFromMnemonic(seedPhrase);
  const walletConfigKey = await deriveWalletConfigKey(rootNode);
  const gaiaHubConfig = await createWalletGaiaConfig({
    gaiaHubUrl: GAIA_HUB_URL,
    configPrivateKey: walletConfigKey,
  });
  await updateWalletConfig({
    walletAccounts: updateAccountsList,
    gaiaHubConfig,
    configPrivateKey: walletConfigKey,
  });
  return updateAccountsList;
}
