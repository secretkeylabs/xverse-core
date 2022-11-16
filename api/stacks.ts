import axios from 'axios';
import BigNumber from 'bignumber.js';
import {
  SettingsNetwork,
  StxAddressData,
  StxAddressDataResponse,
  StxTransactionData,
  TransactionData,
  FungibleToken,
  TokensResponse,
  AccountAssetsListData,
  NonFungibleToken,
  NftsListData,
  NftEventsResponse,
} from 'types';
import { API_TIMEOUT_MILLI } from '../constant';
import { StacksMainnet, StacksTestnet } from '@stacks/network';
import {
  BufferCV,
  bufferCVFromString,
  callReadOnlyFunction,
  ClarityType,
  cvToString,
  PrincipalCV,
  ResponseCV,
  TupleCV,
} from '@stacks/transactions';
import {
  deDuplicatePendingTx,
  getConfirmedTransactions,
  getMempoolTransactions,
  getTransferTransactions,
} from '../transactions';
import { AddressToBnsResponse } from '../types/api/stacks/assets';


export async function fetchStxAddressData(
  stxAddress: string,
  network: SettingsNetwork,
  offset: number,
  paginationLimit: number
): Promise<StxAddressData> {
  const apiUrl = `${network.address}/v2/accounts/${stxAddress}?proof=0`;
  const balanceInfo = await axios.get<StxAddressDataResponse>(apiUrl, {
    timeout: API_TIMEOUT_MILLI,
  });

  const availableBalance = new BigNumber(balanceInfo.data.balance);
  const lockedBalance = new BigNumber(balanceInfo.data.locked);
  const totalBalance = availableBalance.plus(lockedBalance);

  const [confirmedTransactions, mempoolTransactions] = await Promise.all([
    getConfirmedTransactions({
      stxAddress,
      network,
    }),
    getMempoolTransactions({
      stxAddress,
      network,
      offset: offset,
      limit: paginationLimit,
    }),
  ]);

  const confirmedCount = confirmedTransactions.totalCount;
  const mempoolCount = deDuplicatePendingTx({
    confirmedTransactions: confirmedTransactions.transactionsList,
    pendingTransactions: mempoolTransactions.transactionsList,
  }).length;

  const transferTransactions: StxTransactionData[] = await getTransferTransactions(
    stxAddress,
    network
  );
  const ftTransactions = transferTransactions.filter((tx) => tx.tokenType === 'fungible');
  const nftTransactions = transferTransactions.filter((tx) => tx.tokenType === 'non_fungible');

  const allConfirmedTransactions: Array<TransactionData> = [
    ...confirmedTransactions.transactionsList,
    ...ftTransactions.filter((tx) =>
      confirmedTransactions.transactionsList.some((ctx) => tx.txid !== ctx.txid)
    ),
    ...nftTransactions.filter((tx) =>
      confirmedTransactions.transactionsList.some((ctx) => tx.txid !== ctx.txid)
    ),
  ];

  // sorting the transactions on the base of date
  allConfirmedTransactions.sort((t1, t2) => t2.seenTime.getTime() - t1.seenTime.getTime());

  const transactions: Array<TransactionData> = [
    ...mempoolTransactions.transactionsList,
    ...allConfirmedTransactions,
  ];

  return Promise.resolve({
    balance: totalBalance,
    availableBalance,
    locked: lockedBalance,
    nonce: balanceInfo.data.nonce,
    transactions,
    totalTransactions: confirmedCount + mempoolCount,
  });
}

export async function getFtData(
  stxAddress: string,
  network: SettingsNetwork
): Promise<FungibleToken[]> {
  let apiUrl = `${network.address}/extended/v1/address/${stxAddress}/balances`;

  return axios
    .get<TokensResponse>(apiUrl, {
      timeout: 30000,
    })
    .then((response) => {
      const tokens: FungibleToken[] = [];
      for (let key in response.data.fungible_tokens) {
        var fungibleToken: FungibleToken = response.data.fungible_tokens[key];
        const index = key.indexOf('::');
        fungibleToken.assetName = key.substring(index + 2);
        fungibleToken.principal = key.substring(0, index);
        tokens.push(fungibleToken);
      }

      return tokens;
    });
}

/**
 * get NFTs data from api
 * @param stxAddress
 * @param network
 * @param offset
 * @returns
 */
export async function getAccountAssets(
  stxAddress: string,
  network: SettingsNetwork,
  offset: number
): Promise<AccountAssetsListData> {
  let apiUrl = `${network.address}/extended/v1/address/${stxAddress}/balances`;

  return axios
    .get<TokensResponse>(apiUrl, {
      timeout: 30000,
    })
    .then((response) => {
      const assets: NonFungibleToken[] = [];
      for (let key in response.data.non_fungible_tokens) {
        var nft: NonFungibleToken = response.data.non_fungible_tokens[key];
        nft.name = key;
        assets.push(nft);
      }

      return {
        assetsList: assets,
        totalCount: assets.length,
      };
    });
}

export async function getNftsData(
  stxAddress: string,
  network: SettingsNetwork,
  offset: number
): Promise<NftsListData> {
  let apiUrl = `${network.address}/extended/v1/tokens/nft/holdings`;

  return axios
    .get<NftEventsResponse>(apiUrl, {
      timeout: 30000,
      params: {
        principal: stxAddress,
        limit: 20,
        offset: offset,
      },
    })
    .then((response) => {
      return {
        nftsList: response.data.results,
        total: response.data.total,
      };
    });
}

export async function getBnsName(stxAddress: string, network: SettingsNetwork) {
  const apiUrl = `${network.address}/v1/addresses/stacks/${stxAddress}`;
  return axios
    .get<AddressToBnsResponse>(apiUrl, {
      timeout: 30000,
    })
    .then((response) => {
      return response?.data?.names[0];
    })
    .catch((error) => {
      return undefined;
    });
}

export async function fetchAddressOfBnsName(
  bnsName: string,
  stxAddress: string,
  network: SettingsNetwork
): Promise<string> {
  try {
    if (bnsName.includes('.')) {
      const ns = bnsName.split('.');
      const name_ = ns[0];
      const namespace_ = ns[1] ?? '';

      const contractAddress = 'SP000000000000000000002Q6VF78';
      const contractName = 'bns';
      const functionName = 'name-resolve';
      const senderAddress = stxAddress;
      const namespace: BufferCV = bufferCVFromString(namespace_);
      const name: BufferCV = bufferCVFromString(name_);

      let stacksNetwork = null;
      if (network.type === 'Mainnet') {
        stacksNetwork = new StacksMainnet();
      } else {
        stacksNetwork = new StacksTestnet();
      }

      const options = {
        contractAddress,
        contractName,
        functionName,
        functionArgs: [namespace, name],
        network: stacksNetwork,
        senderAddress,
      };

      const responseCV = await callReadOnlyFunction(options);

      if (responseCV.type === ClarityType.ResponseErr) {
        return '';
      } else {
        const response = responseCV as ResponseCV;
        const tupleCV = response.value as TupleCV;
        const owner: PrincipalCV = tupleCV.data['owner'] as PrincipalCV;
        const address = cvToString(owner);
        return address;
      }
    } else return '';
  } catch (err) {
    return '';
  }
}



