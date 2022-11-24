import { fetchBtcTransactionsData, getBnsName, getConfirmedTransactions } from "../api";
import { Account, BtcAddressData, SettingsNetwork, StxTransactionListData } from "../types";
import { walletFromSeedPhrase } from "../wallet";

export async function checkAccountActivity(
    stxAddress: string,
    btcAddress: string,
    selectedNetwork: SettingsNetwork,
  ) {
    const stxTxHistory: StxTransactionListData = await getConfirmedTransactions(
      {
        stxAddress,
        network: selectedNetwork,
      },
    );
    if (stxTxHistory.totalCount !== 0) return true;
    const btcTxHistory: BtcAddressData = await fetchBtcTransactionsData(
      btcAddress,
      selectedNetwork?.type,
    );
    return btcTxHistory.transactions.length !== 0;
  }

export async function  getActiveAccountList  (
    mnemonic: string,
    selectedNetwork: SettingsNetwork,
    firstAccount: Account,
  ) {
    try {
      const limit = 19;
      const activeAccountsList: Account[] = [];
      activeAccountsList.push(firstAccount);
      for (let i = 1; i <= limit; i += 1) {
        const response = await walletFromSeedPhrase({ mnemonic, index: BigInt(i), network: selectedNetwork.type });
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
            selectedNetwork,
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
          selectedNetwork,
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
  };