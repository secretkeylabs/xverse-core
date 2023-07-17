import { StacksMainnet, StacksNetwork } from '@stacks/network';
import * as bip39 from 'bip39';
import { fetchBtcTransactionsData, getBnsName, getConfirmedTransactions } from '../api';
import {
  connectToGaiaHubWithConfig,
  createWalletGaiaConfig,
  deriveWalletConfigKey,
  getHubInfo,
  getOrCreateWalletConfig,
  updateWalletConfig,
} from '../gaia';
import {
  Account,
  BtcTransactionData,
  NetworkType,
  SettingsNetwork,
  StxTransactionListData,
} from '../types';
import { bip32 } from '../utils/bip32';
import { walletFromSeedPhrase } from '../wallet';
import { GAIA_HUB_URL } from './../constant';

export const fetchActiveAccounts = async (
  mnemonic: string,
  networkObject: StacksNetwork,
  currentAccounts: Account[]
) => {
  const networkFetch = networkObject.fetchFn;
  const hubInfo = await getHubInfo(GAIA_HUB_URL, networkFetch);
  const seed = await bip39.mnemonicToSeed(mnemonic);
  const rootNode = bip32.fromSeed(Buffer.from(seed));
  const walletConfigKey = await deriveWalletConfigKey(rootNode);
  const currentGaiaConfig = connectToGaiaHubWithConfig({
    hubInfo,
    privateKey: walletConfigKey,
    gaiaHubUrl: GAIA_HUB_URL,
  });
  return getOrCreateWalletConfig({
    walletAccounts: currentAccounts,
    configPrivateKey: walletConfigKey,
    gaiaHubConfig: currentGaiaConfig,
    fetchFn: networkFetch,
  });
};

export async function checkAccountActivity(
  stxAddress: string,
  btcAddress: string,
  ordinalsAddress: string,
  selectedNetwork: StacksNetwork
) {
  const stxTxHistory: StxTransactionListData = await getConfirmedTransactions({
    stxAddress,
    network: selectedNetwork,
  });
  if (stxTxHistory.totalCount !== 0) return true;
  const networkType: NetworkType = selectedNetwork === new StacksMainnet() ? 'Mainnet' : 'Testnet';
  const btcTxHistory: BtcTransactionData[] = await fetchBtcTransactionsData(
    btcAddress,
    ordinalsAddress,
    networkType,
    true
  );
  return btcTxHistory.length !== 0;
}

export async function restoreWalletWithAccounts(
  mnemonic: string,
  selectedNetwork: SettingsNetwork,
  networkObject: StacksNetwork,
  currentAccounts: Account[]
): Promise<Account[]> {
  const walletConfig = await fetchActiveAccounts(mnemonic, networkObject, currentAccounts);
  if (walletConfig && walletConfig.accounts.length > 0) {
    const newAccounts: Account[] = await Promise.all(
      walletConfig.accounts.map(async (_, index) => {
        let existingAccount: Account = currentAccounts[index];
        if (
          !existingAccount ||
          !existingAccount.ordinalsAddress ||
          !existingAccount.ordinalsPublicKey
        ) {
          const response = await walletFromSeedPhrase({
            mnemonic,
            index: BigInt(index),
            network: selectedNetwork.type,
          });
          const username = await getBnsName(response.stxAddress, networkObject);
          existingAccount = {
            id: index,
            stxAddress: response.stxAddress,
            btcAddress: response.btcAddress,
            ordinalsAddress: response.ordinalsAddress,
            masterPubKey: response.masterPubKey,
            stxPublicKey: response.stxPublicKey,
            btcPublicKey: response.btcPublicKey,
            ordinalsPublicKey: response.ordinalsPublicKey,
            bnsName: username,
            accountType: 'software',
          };
          return existingAccount;
        } else {
          const userName = await getBnsName(existingAccount.stxAddress, networkObject);
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
  networkObject: StacksNetwork,
  walletAccounts: Account[]
): Promise<Account[]> {
  const accountIndex = walletAccounts.length;
  const {
    stxAddress,
    btcAddress,
    ordinalsAddress,
    masterPubKey,
    stxPublicKey,
    btcPublicKey,
    ordinalsPublicKey,
  } = await walletFromSeedPhrase({
    mnemonic: seedPhrase,
    index: BigInt(accountIndex),
    network: selectedNetwork.type,
  });
  const bnsName = await getBnsName(stxAddress, networkObject);
  const newAccount: Account = {
    id: accountIndex,
    stxAddress,
    btcAddress,
    ordinalsAddress,
    masterPubKey,
    stxPublicKey,
    btcPublicKey,
    ordinalsPublicKey,
    bnsName,
    accountType: 'software',
  };
  const updateAccountsList = [...walletAccounts, newAccount];
  try {
    const seed = await bip39.mnemonicToSeed(seedPhrase);
    const rootNode = bip32.fromSeed(Buffer.from(seed));
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
  } catch (err) {
    return updateAccountsList;
  }
}
