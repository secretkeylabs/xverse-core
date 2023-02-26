import { StacksMainnet, StacksNetwork, StacksTestnet } from '@stacks/network';
import {
  connectToGaiaHubWithConfig,
  getHubInfo,
  getOrCreateWalletConfig,
  deriveWalletConfigKey,
  updateWalletConfig,
  createWalletGaiaConfig,
} from '../gaia';
import { fetchBtcTransactionsData, getBnsName, getConfirmedTransactions } from '../api';
import { Account, BtcAddressData, NetworkType, SettingsNetwork, StxTransactionListData } from '../types';
import { walletFromSeedPhrase } from '../wallet';
import { GAIA_HUB_URL } from './../constant';
import * as bip39 from 'bip39';
import { bip32 } from 'bitcoinjs-lib';

export async function checkAccountActivity(
  stxAddress: string,
  btcAddress: string,
  selectedNetwork: StacksNetwork
) {
  const stxTxHistory: StxTransactionListData = await getConfirmedTransactions({
    stxAddress,
    network: selectedNetwork,
  });
  if (stxTxHistory.totalCount !== 0) return true;
  const networkType : NetworkType = selectedNetwork === new StacksMainnet() ? 'Mainnet' : 'Testnet';
  const btcTxHistory: BtcAddressData = await fetchBtcTransactionsData(
    btcAddress,
    networkType
  );
  return btcTxHistory.transactions.length !== 0;
}

export async function restoreWalletWithAccounts(
  mnemonic: string,
  selectedNetwork: SettingsNetwork,
  networkObject:  StacksNetwork,
  currentAccounts: Account[]
): Promise<Account[]> {
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
        if (existingAccount && index === 0) {
          const username = await getBnsName(existingAccount.stxAddress, networkObject);
          existingAccount = { ...existingAccount, bnsName: username };
        }
        if (!existingAccount || !existingAccount.ordinalsAddress) {
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
            bnsName: username,
          };
          return existingAccount;
        } 
        return existingAccount;
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
  walletAccounts: Account[],
): Promise<Account[]> {
  const accountIndex = walletAccounts.length;
   const { stxAddress, btcAddress, ordinalsAddress, masterPubKey, stxPublicKey, btcPublicKey } =
    await walletFromSeedPhrase({
      mnemonic: seedPhrase,
      index: BigInt(accountIndex),
      network: selectedNetwork.type,
    });
  const bnsName = await getBnsName(stxAddress, networkObject);
  const updateAccountsList = [
    ...walletAccounts,
    {
      id: accountIndex,
      stxAddress,
      btcAddress,
      ordinalsAddress,
      masterPubKey,
      stxPublicKey,
      btcPublicKey,
      bnsName,
    },
  ];
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
}
