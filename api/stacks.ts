import axios from 'axios';
import BigNumber from 'bignumber.js';
import {
  StxAddressData,
  StxAddressDataResponse,
  TransactionData,
  FungibleToken,
  TokensResponse,
  AccountAssetsListData,
  NonFungibleToken,
  NftsListData,
  NftEventsResponse,
} from 'types';
import { API_TIMEOUT_MILLI } from '../constant';
import { StacksNetwork } from '@stacks/network';
import {
  deDuplicatePendingTx,
  mapTransferTransactionData,
  parseMempoolStxTransactionsData,
  parseStxTransactionData,
} from './helper';
import {
  BufferCV,
  bufferCVFromString,
  callReadOnlyFunction,
  ClarityType,
  cvToHex,
  cvToString,
  hexToCV,
  PrincipalCV,
  ResponseCV,
  SomeCV,
  standardPrincipalCV,
  TupleCV,
  tupleCV,
  UIntCV,
} from '@stacks/transactions';
import { CoreInfo, DelegationInfo } from '../types/api/stacks/assets';
import { getNetworkURL } from './helper';

import {
  StxMempoolResponse,
  StxMempoolTransactionData,
  StxMempoolTransactionListData,
  StxPendingTxData,
  StxTransactionData,
  StxTransactionListData,
  StxTransactionResponse,
  Transaction,
  TransferTransactionsData,
} from 'types';
import { getNftDetail } from './gamma';
import { ContractInterfaceResponse } from '../types/api/stacks/transaction';
import { getBnsNamesForOwner, getOwnerForBnsName } from './bns';

export async function fetchStxAddressData(
  stxAddress: string,
  network: StacksNetwork,
  offset: number,
  paginationLimit: number
): Promise<StxAddressData> {
  const apiUrl = `${getNetworkURL(network)}/v2/accounts/${stxAddress}?proof=0`;
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
  ];
  ftTransactions.forEach((tx) => {
    let index = allConfirmedTransactions.findIndex((trans) => {
      return trans.txid === tx.txid;
    });
    if (index === -1) {
      allConfirmedTransactions.push(tx);
    }
  });
  nftTransactions.forEach((tx) => {
    let index = allConfirmedTransactions.findIndex((trans) => {
      return trans.txid === tx.txid;
    });
    if (index === -1) {
      allConfirmedTransactions.push(tx);
    }
  });

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
  network: StacksNetwork
): Promise<FungibleToken[]> {
  let apiUrl = `${getNetworkURL(network)}/extended/v1/address/${stxAddress}/balances`;

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
  network: StacksNetwork,
  offset: number
): Promise<AccountAssetsListData> {
  let apiUrl = `${getNetworkURL(network)}/extended/v1/address/${stxAddress}/balances`;

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
  network: StacksNetwork,
  offset: number
): Promise<NftEventsResponse> {
  let apiUrl = `${getNetworkURL(network)}/extended/v1/tokens/nft/holdings`;

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
      return response.data;
    });
}

export async function getNfts(
  stxAddress: string,
  network: StacksNetwork,
  offset: number
): Promise<NftsListData> {
  const nfts = await getNftsData(stxAddress, network, offset);
  for (const nft of nfts.results) {
    const principal: string[] = nft.asset_identifier.split('::');
    const contractInfo: string[] = principal[0].split('.');
    if (contractInfo[1] !== 'bns') {
      const detail = await getNftDetail(
        nft.value.repr.replace('u', ''),
        contractInfo[0],
        contractInfo[1]
      );
      if (detail) {
        nft.data = detail.data;
      }
    }
  }
  return {
    nftsList: nfts.results,
    total: nfts.total,
  };
}

export async function getContractInterface(
  contractAddress: string,
  contractName: string,
  network: StacksNetwork
): Promise<ContractInterfaceResponse | null> {
  const apiUrl = `${getNetworkURL(
    network
  )}/v2/contracts/interface/${contractAddress}/${contractName}`;

  return axios
    .get<ContractInterfaceResponse>(apiUrl, {
      timeout: 30000,
    })
    .then((response) => {
      return response.data;
    })
    .catch((error) => {
      return null;
    });
}

export async function getBnsName(stxAddress: string, network: StacksNetwork) {
  const names = await getBnsNamesForOwner(stxAddress, network);
  return names[0];
}

export async function fetchAddressOfBnsName(
  bnsName: string,
  stxAddress: string,
  network: StacksNetwork
): Promise<string> {
    return await getOwnerForBnsName(bnsName, stxAddress, network);
}

export async function getConfirmedTransactions({
  stxAddress,
  network,
}: {
  stxAddress: string;
  network: StacksNetwork;
}): Promise<StxTransactionListData> {
  let apiUrl = `${getNetworkURL(network)}/extended/v1/address/${stxAddress}/transactions`;

  return axios
    .get<StxTransactionResponse>(apiUrl, {
      timeout: API_TIMEOUT_MILLI,
    })
    .then((response) => {
      return {
        transactionsList: response.data.results.map((responseTx) =>
          parseStxTransactionData({ responseTx, stxAddress })
        ),
        totalCount: response.data.total,
      };
    });
}

export async function getMempoolTransactions({
  stxAddress,
  network,
  offset,
  limit,
}: {
  stxAddress: string;
  network: StacksNetwork;
  offset: number;
  limit: number;
}): Promise<StxMempoolTransactionListData> {
  let apiUrl = `${getNetworkURL(network)}/extended/v1/tx/mempool?address=${stxAddress}`;

  return axios
    .get<StxMempoolResponse>(apiUrl, {
      timeout: API_TIMEOUT_MILLI,
      params: {
        limit: limit,
        offset: offset,
      },
    })
    .then((response) => {
      const count: number = response.data.total;
      const transactions: StxMempoolTransactionData[] = [];
      response.data.results.forEach((responseTx) => {
        transactions.push(parseMempoolStxTransactionsData({ responseTx, stxAddress }));
      });
      return {
        transactionsList: transactions,
        totalCount: count,
      };
    });
}

export async function fetchStxPendingTxData(
  stxAddress: string,
  network: StacksNetwork
): Promise<StxPendingTxData> {
  const [confirmedTransactions, mempoolTransactions] = await Promise.all([
    getConfirmedTransactions({
      stxAddress,
      network,
    }),
    getMempoolTransactions({
      stxAddress,
      network,
      offset: 0,
      limit: 25,
    }),
  ]);

  const pendingTransactions = deDuplicatePendingTx({
    confirmedTransactions: confirmedTransactions.transactionsList,
    pendingTransactions: mempoolTransactions.transactionsList,
  }).filter((tx) => tx.incoming === false);

  return Promise.resolve({
    pendingTransactions,
  });
}

export async function getTransaction(txid: string, network: StacksNetwork): Promise<Transaction> {
  return fetch(`${getNetworkURL(network)}/extended/v1/tx/${txid}`, {
    method: 'GET',
  })
    .then((response) => response.json())
    .then((response) => {
      return response;
    });
}

export async function getTransferTransactions(
  stxAddress: string,
  network: StacksNetwork
): Promise<StxTransactionData[]> {
  let apiUrl = `${getNetworkURL(
    network
  )}/extended/v1/address/${stxAddress}/transactions_with_transfers`;
  return axios
    .get<TransferTransactionsData>(apiUrl, {
      timeout: API_TIMEOUT_MILLI,
    })
    .then((response: { data: { results: any[] } }) => {
      const transactions: StxTransactionData[] = [];
      response.data.results.forEach((t) => {
        transactions.push(mapTransferTransactionData({ responseTx: t.tx, stxAddress }));
      });

      return transactions;
    });
}

export async function getStacksInfo(network: string) {
  const url = `${network}/v2/info`;
  return axios
    .get<CoreInfo>(url, {
      timeout: 30000,
    })
    .then((response) => {
      return response?.data;
    })
    .catch((error) => {
      return undefined;
    });
}

export async function fetchDelegationState(
  stxAddress: string,
  network: StacksNetwork
): Promise<DelegationInfo> {
  const poxContractAddress = 'SP000000000000000000002Q6VF78';
  const poxContractName = 'pox-2';
  const mapName = 'delegation-state';
  const mapEntryPath = `/${poxContractAddress}/${poxContractName}/${mapName}`;
  const apiUrl = `${getNetworkURL(network)}/v2/map_entry${mapEntryPath}?proof=0`;
  const key = cvToHex(tupleCV({ stacker: standardPrincipalCV(stxAddress) }));
  const headers = {
    'Content-Type': 'application/json',
  };
  return axios.post(apiUrl, JSON.stringify(key), { headers: headers }).then((response) => {
    const responseCV = hexToCV(response.data.data);
    if (responseCV.type === ClarityType.OptionalNone) {
      return {
        delegated: false,
      };
    } else {
      const someCV = responseCV as SomeCV;
      const tupleCV = someCV.value as TupleCV;
      const amount: UIntCV = tupleCV.data['amount-ustx'] as UIntCV;
      const delegatedTo: PrincipalCV = tupleCV.data['delegated-to'] as PrincipalCV;
      const untilBurnHeightSomeCV: SomeCV = tupleCV.data['until-burn-ht'] as SomeCV;
      var untilBurnHeight = 9999999;
      if (untilBurnHeightSomeCV.type === ClarityType.OptionalSome) {
        const untilBurnHeightUIntCV: UIntCV = untilBurnHeightSomeCV.value as UIntCV;
        untilBurnHeight = Number(untilBurnHeightUIntCV.value);
      }
      const delegatedAmount = new BigNumber(amount.value.toString());

      const delegationInfo = {
        delegated: true,
        amount: delegatedAmount.toString(),
        delegatedTo: cvToString(delegatedTo),
        untilBurnHeight: untilBurnHeight,
      };

      return delegationInfo;
    }
  });
}
