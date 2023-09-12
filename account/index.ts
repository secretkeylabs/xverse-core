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
import { Account, BtcTransactionData, NetworkType, SettingsNetwork, StxTransactionListData } from '../types';
import { BIP32Interface, bip32 } from '../utils/bip32';
import { getWalletFromRootNode, walletFromSeedPhrase } from '../wallet';
import { GAIA_HUB_URL } from './../constant';

const getActiveAccountsFromRootNode = async ({
  networkObject,
  currentAccounts,
  rootNode,
}: {
  networkObject: StacksNetwork;
  currentAccounts: Account[];
  rootNode: BIP32Interface;
}) => {
  const networkFetch = networkObject.fetchFn;
  const hubInfo = await getHubInfo(GAIA_HUB_URL, networkFetch);
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

export const fetchActiveAccounts = async (
  mnemonic: string,
  networkObject: StacksNetwork,
  currentAccounts: Account[],
) => {
  const seed = await bip39.mnemonicToSeed(mnemonic);
  const rootNode = bip32.fromSeed(Buffer.from(seed));
  const accounts = await getActiveAccountsFromRootNode({
    networkObject,
    currentAccounts,
    rootNode,
  });
  return accounts;
};

export async function checkAccountActivity(
  stxAddress: string,
  btcAddress: string,
  ordinalsAddress: string,
  selectedNetwork: StacksNetwork,
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
    true,
  );
  return btcTxHistory.length !== 0;
}

const getAccountFromWalletConfig = async ({
  existingAccount,
  master,
  masterPubKey,
  rootNode,
  selectedNetwork,
  networkObject,
  index,
}: {
  existingAccount?: Account;
  master: BIP32Interface;
  masterPubKey: string;
  rootNode: BIP32Interface;
  selectedNetwork: SettingsNetwork;
  networkObject: StacksNetwork;
  index: number;
}) => {
  if (!existingAccount || !existingAccount.ordinalsAddress || !existingAccount.ordinalsPublicKey) {
    const response = await getWalletFromRootNode({
      index: BigInt(index),
      network: selectedNetwork.type,
      rootNode,
      master,
    });
    const username = await getBnsName(response.stxAddress, networkObject);
    existingAccount = {
      id: index,
      stxAddress: response.stxAddress,
      btcAddress: response.btcAddress,
      ordinalsAddress: response.ordinalsAddress,
      masterPubKey,
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
};

export async function restoreWalletWithAccounts(
  mnemonic: string,
  selectedNetwork: SettingsNetwork,
  networkObject: StacksNetwork,
  currentAccounts: Account[],
  isMobile?: boolean,
): Promise<Account[]> {
  const seed = await bip39.mnemonicToSeed(mnemonic);
  const rootNode = bip32.fromSeed(Buffer.from(seed));

  const walletConfig = await getActiveAccountsFromRootNode({
    networkObject,
    currentAccounts,
    rootNode,
  });

  // If no accounts are found in the wallet config, return the current accounts
  if (!walletConfig?.accounts.length) {
    return currentAccounts;
  }

  const master = bip32.fromSeed(seed);
  const masterPubKey = master.publicKey.toString('hex');

  // for mobile, we need a for loop to get the accounts
  // because it allows the js thread to breathe between each account
  if (isMobile) {
    const newAccounts: Account[] = [];
    for (let index = 0; index < walletConfig.accounts.length; index++) {
      const account = await getAccountFromWalletConfig({
        existingAccount: currentAccounts[index],
        master,
        masterPubKey,
        rootNode,
        selectedNetwork,
        networkObject,
        index,
      });
      newAccounts.push(account);
    }
    return newAccounts;
  }

  const newAccounts: Account[] = await Promise.all(
    walletConfig.accounts.map((_, index) =>
      getAccountFromWalletConfig({
        existingAccount: currentAccounts[index],
        master,
        masterPubKey,
        rootNode,
        selectedNetwork,
        networkObject,
        index,
      }),
    ),
  );
  return newAccounts;
}

export async function createWalletAccount(
  seedPhrase: string,
  selectedNetwork: SettingsNetwork,
  networkObject: StacksNetwork,
  walletAccounts: Account[],
): Promise<Account[]> {
  const accountIndex = walletAccounts.length;
  const { stxAddress, btcAddress, ordinalsAddress, masterPubKey, stxPublicKey, btcPublicKey, ordinalsPublicKey } =
    await walletFromSeedPhrase({
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
