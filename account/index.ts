import { StacksNetwork } from '@stacks/network';
import * as bip39 from 'bip39';
import { fetchBtcTransactionsData, getBnsName, getConfirmedTransactions } from '../api';
import EsploraApiProvider from '../api/esplora/esploraAPiProvider';
import {
  connectToGaiaHubWithConfig,
  createWalletGaiaConfig,
  deriveWalletConfigKey,
  getHubInfo,
  getOrCreateWalletConfig,
  updateWalletConfig,
} from '../gaia';
import { Account, BtcTransactionData, SettingsNetwork, StxTransactionListData } from '../types';
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
  esploraProvider: EsploraApiProvider,
) {
  const stxTxHistory: StxTransactionListData = await getConfirmedTransactions({
    stxAddress,
    network: selectedNetwork,
  });
  if (stxTxHistory.totalCount !== 0) return true;
  const btcTxHistory: BtcTransactionData[] = await fetchBtcTransactionsData(
    btcAddress,
    ordinalsAddress,
    esploraProvider,
    true,
  );
  return btcTxHistory.length !== 0;
}

export async function restoreWalletWithAccounts(
  mnemonic: string,
  selectedNetwork: SettingsNetwork,
  networkObject: StacksNetwork,
  currentAccounts: Account[],
): Promise<Account[]> {
  const seed = await bip39.mnemonicToSeed(mnemonic);
  const rootNode = bip32.fromSeed(Buffer.from(seed));

  const walletConfig = await getActiveAccountsFromRootNode({
    networkObject,
    currentAccounts,
    rootNode,
  });
  if (walletConfig && walletConfig.accounts.length > 0) {
    const newAccounts: Account[] = await Promise.all(
      walletConfig.accounts.map(async (_, index) => {
        let existingAccount: Account = currentAccounts[index];
        if (!existingAccount || !existingAccount.ordinalsAddress || !existingAccount.ordinalsPublicKey) {
          const master = bip32.fromSeed(seed);
          const masterPubKey = master.publicKey.toString('hex');

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
      }),
    );
    return [...newAccounts, ...currentAccounts.slice(newAccounts.length)];
  }
  return currentAccounts;
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
