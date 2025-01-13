import { StacksNetwork } from '@stacks/network';
import {
  ClarityType,
  cvToHex,
  cvToString,
  hexToCV,
  PrincipalCV,
  SomeCV,
  standardPrincipalCV,
  TupleCV,
  tupleCV,
  uintCV,
  UIntCV,
} from '@stacks/transactions';
import axios from 'axios';
import BigNumber from 'bignumber.js';
import { API_TIMEOUT_MILLI } from '../constant';
import {
  Account,
  AccountAssetsListData,
  CoinMetaData,
  ContractInterfaceResponse,
  CoreInfo,
  DelegationInfo,
  EsploraTransaction,
  FungibleToken,
  NftData,
  NftEventsResponse,
  NftsListData,
  NonFungibleToken,
  NonFungibleTokenOld,
  StacksMainnet,
  StxAddressData,
  StxAddressDataResponse,
  StxMempoolResponse,
  StxMempoolTransactionData,
  StxMempoolTransactionListData,
  StxPendingTxData,
  StxTransactionData,
  StxTransactionListData,
  StxTransactionResponse,
  TokensResponse,
  TransactionData,
  TransferTransactionsData,
} from '../types';
import { getNftDetail } from './gamma';
import {
  getUniquePendingTx,
  mapTransferTransactionData,
  parseMempoolStxTransactionsData,
  parseStxTransactionData,
} from './helper';
import { MempoolFeePriorities } from '@stacks/stacks-blockchain-api-types';
import StacksApiProvider from './stacksApi';
import { safePromise } from '../utils';
import { getOwner, getPrimaryName } from 'bns-v2-sdk';

// TODO: these methods needs to be refactored
// reference https://github.com/secretkeylabs/xverse-core/pull/217/files#r1298242728
export async function getConfirmedTransactions({
  stxAddress,
  network,
  offset,
  limit,
}: {
  stxAddress: string;
  network: StacksNetwork;
  offset?: number;
  limit?: number;
}): Promise<StxTransactionListData> {
  // deprecated endpoint v1
  // reference: https://docs.hiro.so/nakamoto
  const apiUrl = `${network.client.baseUrl}/extended/v1/address/${stxAddress}/transactions`;

  const response = await axios.get<StxTransactionResponse>(apiUrl, {
    timeout: API_TIMEOUT_MILLI,
    params: {
      limit,
      offset,
    },
  });

  return {
    transactionsList: response.data.results.map((responseTx) => parseStxTransactionData({ responseTx, stxAddress })),
    totalCount: response.data.total,
  };
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
  const apiUrl = `${network.client.baseUrl}/extended/v1/tx/mempool?address=${stxAddress}`;

  const response = await axios.get<StxMempoolResponse>(apiUrl, {
    timeout: API_TIMEOUT_MILLI,
    params: {
      limit: limit,
      offset: offset,
    },
  });

  const count: number = response.data.total;
  const transactions: StxMempoolTransactionData[] = [];
  response.data.results.forEach((responseTx) => {
    transactions.push(parseMempoolStxTransactionsData({ responseTx, stxAddress }));
  });

  return {
    transactionsList: transactions,
    totalCount: count,
  };
}

export async function getTransferTransactions(
  stxAddress: string,
  network: StacksNetwork,
  offset?: number,
  limit?: number,
): Promise<StxTransactionData[]> {
  // deprecated endpoint v1
  // reference: https://docs.hiro.so/nakamoto
  const apiUrl = `${network.client.baseUrl}/extended/v1/address/${stxAddress}/transactions_with_transfers`;
  const response = await axios.get<TransferTransactionsData>(apiUrl, {
    timeout: API_TIMEOUT_MILLI,
    params: {
      limit,
      offset,
    },
  });

  const transactions: StxTransactionData[] = [];
  response.data.results.forEach((t) => {
    transactions.push(mapTransferTransactionData({ responseTx: t.tx, stxAddress }));
  });

  return transactions;
}

export async function fetchStxAddressData(
  stxAddress: string,
  network: StacksNetwork,
  offset: number,
  paginationLimit: number,
): Promise<StxAddressData> {
  const apiUrl = `${network.client.baseUrl}/v2/accounts/${stxAddress}?proof=0`;

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
      offset: offset,
      limit: paginationLimit,
    }),
    getMempoolTransactions({
      stxAddress,
      network,
      offset: offset,
      limit: paginationLimit,
    }),
  ]);

  const confirmedCount = confirmedTransactions.totalCount;
  const mempoolCount = getUniquePendingTx({
    confirmedTransactions: confirmedTransactions.transactionsList,
    pendingTransactions: mempoolTransactions.transactionsList,
  }).length;

  const transferTransactions: StxTransactionData[] = await getTransferTransactions(
    stxAddress,
    network,
    offset,
    paginationLimit,
  );
  const ftTransactions = transferTransactions.filter((tx) => tx.tokenType === 'fungible');
  const nftTransactions = transferTransactions.filter((tx) => tx.tokenType === 'non_fungible');

  const allConfirmedTransactions: Array<TransactionData> = [...confirmedTransactions.transactionsList];
  ftTransactions.forEach((tx) => {
    const index = allConfirmedTransactions.findIndex((trans) => {
      return trans.txid === tx.txid;
    });
    if (index === -1) {
      allConfirmedTransactions.push(tx);
    }
  });
  nftTransactions.forEach((tx) => {
    const index = allConfirmedTransactions.findIndex((trans) => {
      return trans.txid === tx.txid;
    });
    if (index === -1) {
      allConfirmedTransactions.push(tx);
    }
  });

  allConfirmedTransactions.sort((t1, t2) => t2.seenTime.getTime() - t1.seenTime.getTime());

  const transactions: Array<TransactionData> = [...mempoolTransactions.transactionsList, ...allConfirmedTransactions];

  return {
    balance: totalBalance,
    availableBalance,
    locked: lockedBalance,
    nonce: balanceInfo.data.nonce,
    transactions,
    totalTransactions: confirmedCount + mempoolCount,
  };
}

export async function getFtData(stxAddress: string, network: StacksNetwork): Promise<FungibleToken[]> {
  const apiUrl = `${network.client.baseUrl}/extended/v1/address/${stxAddress}/balances`;

  const response = await axios.get<TokensResponse>(apiUrl, {
    timeout: API_TIMEOUT_MILLI,
  });

  const tokens: FungibleToken[] = [];
  for (const key in response.data.fungible_tokens) {
    const fungibleToken: FungibleToken = response.data.fungible_tokens[key];
    const index = key.indexOf('::');
    fungibleToken.assetName = key.substring(index + 2);
    fungibleToken.principal = key.substring(0, index);
    fungibleToken.protocol = 'stacks';
    tokens.push(fungibleToken);
  }
  return tokens;
}

/**
 * get NFTs data from api
 * @param stxAddress
 * @param network
 * @param offset
 * @returns
 */
export async function getAccountAssets(stxAddress: string, network: StacksNetwork): Promise<AccountAssetsListData> {
  const apiUrl = `${network.client.baseUrl}/extended/v1/address/${stxAddress}/balances`;

  return axios
    .get<TokensResponse>(apiUrl, {
      timeout: API_TIMEOUT_MILLI,
    })
    .then((response) => {
      const assets: NonFungibleToken[] = [];
      for (const key in response.data.non_fungible_tokens) {
        const nft: NonFungibleToken = response.data.non_fungible_tokens[key];
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
  offset: number,
  limit?: number,
): Promise<NftEventsResponse> {
  const apiUrl = `${network.client.baseUrl}/extended/v1/tokens/nft/holdings`;

  const response = await axios.get<NftEventsResponse>(apiUrl, {
    timeout: 10000,
    params: {
      principal: stxAddress,
      offset,
      limit,
    },
  });

  return response.data;
}

export async function getNfts(stxAddress: string, network: StacksNetwork, offset: number): Promise<NftsListData> {
  const nfts = await getNftsData(stxAddress, network, offset);

  for (const nft of nfts.results as NonFungibleTokenOld[]) {
    const principal: string[] = nft.asset_identifier.split('::');
    const contractInfo: string[] = principal[0].split('.');

    if (contractInfo[1] !== 'bns') {
      const detail = await getNftDetail(nft.value.repr.replace('u', ''), contractInfo[0], contractInfo[1]);
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
  network: StacksNetwork,
): Promise<ContractInterfaceResponse | null> {
  try {
    const apiUrl = `${network.client.baseUrl}/v2/contracts/interface/${contractAddress}/${contractName}`;

    const response = await axios.get<ContractInterfaceResponse>(apiUrl, {
      timeout: API_TIMEOUT_MILLI,
    });

    return response.data;
  } catch (err) {
    return null;
  }
}

export async function getBnsName(stxAddress: string, network: StacksNetwork) {
  const [error, data] = await safePromise(
    getPrimaryName({
      address: stxAddress,
      network: network.chainId === StacksMainnet.chainId ? 'mainnet' : 'testnet',
    }),
  );

  if (error) return undefined;

  return data ? `${data.name}.${data.namespace}` : undefined;
}

export async function fetchAddressOfBnsName(bnsName: string, network: StacksNetwork): Promise<string> {
  const [error, data] = await safePromise(
    getOwner({
      fullyQualifiedName: bnsName,
      network: network.chainId === StacksMainnet.chainId ? 'mainnet' : 'testnet',
    }),
  );

  if (error) return '';

  return data ?? '';
}

export async function fetchStxPendingTxData(stxAddress: string, network: StacksNetwork): Promise<StxPendingTxData> {
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

  const pendingTransactions = getUniquePendingTx({
    confirmedTransactions: confirmedTransactions.transactionsList,
    pendingTransactions: mempoolTransactions.transactionsList,
  });

  return {
    pendingTransactions,
  };
}

export async function getTransaction(txid: string, network: StacksNetwork): Promise<EsploraTransaction> {
  const response = await fetch(`${network.client.baseUrl}/extended/v1/tx/${txid}`, {
    method: 'GET',
  });
  return response.json();
}

export async function getStacksInfo(network: string) {
  try {
    const url = `${network}/v2/info`;
    const response = await axios.get<CoreInfo>(url, {
      timeout: API_TIMEOUT_MILLI,
    });
    return response?.data;
  } catch (err) {
    return undefined;
  }
}

export const isNftOwnedByAccount = async (nft: NftData, account: Account, stackApi: StacksApiProvider) => {
  const assetIdentifier = `${nft.collection_contract_id}::${nft.asset_id}`;
  const value = cvToHex(uintCV(nft.token_id.toString()));
  const history = await stackApi.getNftHistory(assetIdentifier, value, 1);

  return history.results[0]?.recipient === account.stxAddress;
};

export async function fetchDelegationState(stxAddress: string, network: StacksNetwork): Promise<DelegationInfo> {
  const poxContractAddress = 'SP000000000000000000002Q6VF78';
  const poxContractName = 'pox-4';
  const mapName = 'delegation-state';
  const mapEntryPath = `/${poxContractAddress}/${poxContractName}/${mapName}`;
  const apiUrl = `${network.client.baseUrl}/v2/map_entry${mapEntryPath}?proof=0`;
  const key = cvToHex(tupleCV({ stacker: standardPrincipalCV(stxAddress) }));
  const headers = {
    'Content-Type': 'application/json',
  };

  const response = await axios.post(apiUrl, JSON.stringify(key), { headers });

  const responseCV = hexToCV(response.data.data);
  if (responseCV.type === ClarityType.OptionalNone) {
    return {
      delegated: false,
    };
  } else {
    const someCV = responseCV as SomeCV;
    const responseTupleCV = someCV.value as TupleCV;
    const amount: UIntCV = responseTupleCV.value['amount-ustx'] as UIntCV;
    const delegatedTo: PrincipalCV = responseTupleCV.value['delegated-to'] as PrincipalCV;
    const untilBurnHeightSomeCV: SomeCV = responseTupleCV.value['until-burn-ht'] as SomeCV;
    let untilBurnHeight = 9999999;
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
}

export async function fetchCoinMetaData(contract: string, network: StacksNetwork) {
  try {
    const response = await axios.get<CoinMetaData>(`${network.client.baseUrl}/metadata/ft/${contract}`, {
      timeout: API_TIMEOUT_MILLI,
    });
    return response?.data;
  } catch (err) {
    return undefined;
  }
}

export const getMempoolFeePriorities = async (network: StacksNetwork): Promise<MempoolFeePriorities> => {
  const apiUrl = `${network.client.baseUrl}/extended/v2/mempool/fees`;
  const response = await axios.get<MempoolFeePriorities>(apiUrl);
  return response.data;
};

export interface FeeEstimation {
  fee: number;
  fee_rate?: number;
}
