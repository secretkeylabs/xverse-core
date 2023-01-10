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

/**
 * @deprecated Use restoreWalletWithAccounts instead
 * @param mnemonic
 * @param selectedNetwork
 * @param firstAccount
 * @returns
 */
export async function getActiveAccountList(
  mnemonic: string,
  selectedNetwork: SettingsNetwork,
  firstAccount: Account
): Promise<Account[]> {
  try {
    const limit = 19;
    const activeAccountsList: Account[] = [];
    activeAccountsList.push(firstAccount);
    for (let i = 1; i <= limit; i += 1) {
      const response = await walletFromSeedPhrase({
        mnemonic,
        index: BigInt(i),
        network: selectedNetwork.type,
      });
      const account: Account = {
        id: i,
        stxAddress: response.stxAddress,
        btcAddress: response.btcAddress,
        masterPubKey: response.masterPubKey,
        stxPublicKey: response.stxPublicKey,
        btcPublicKey: response.btcPublicKey,
      };
      activeAccountsList.push(account);

      // check in increments of 5 if account is active
      if (i % 5 === 0) {
        const activityExists = checkAccountActivity(
          activeAccountsList[i - 1].stxAddress,
          activeAccountsList[i - 1].btcAddress,
          selectedNetwork
        );
        if (!activityExists) {
          break;
        }
      }
    }
    // loop backwards in decrements of 1 to eliminate inactive accounts
    for (let j = activeAccountsList.length - 1; j >= 1; j -= 1) {
      const activityExists = await checkAccountActivity(
        activeAccountsList[j].stxAddress,
        activeAccountsList[j].btcAddress,
        selectedNetwork
      );
      if (activityExists) {
        break;
      } else {
        activeAccountsList.length = j;
      }
    }
    // fetch bns name for active acounts
    for (let i = 0; i < activeAccountsList.length - 1; i += 1) {
      const response = await getBnsName(activeAccountsList[i].stxAddress, selectedNetwork);
      if (response) activeAccountsList[i].bnsName = response;
    }
    return await Promise.all(activeAccountsList);
  } catch (error) {
    return [firstAccount];
  }
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
