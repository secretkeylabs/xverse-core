import axios from 'axios';
import BigNumber from 'bignumber.js';
import {
  SettingsNetwork,
  StxAddressData,
  StxAddressDataResponse,
  StxMempoolTransactionData,
  StxMempoolTransactionListData,
  StxTransactionData,
  StxTransactionListData,
  StxTransactionResponse,
  TransactionData,
  StxMempoolResponse,
  TransferTransactionsData,
  StxPendingTxData,
  FungibleToken,
  TokensResponse,
} from 'types';
import { API_TIMEOUT_MILLI } from 'constant';
import {
  deDuplicatePendingTx,
  mapTransferTransactionData,
  parseMempoolStxTransactionsData,
  parseStxTransactionData,
} from './helper';

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

export async function fetchStxPendingTxData(
  stxAddress: string,
  network: SettingsNetwork
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

export async function getConfirmedTransactions({
  stxAddress,
  network,
}: {
  stxAddress: string;
  network: SettingsNetwork;
}): Promise<StxTransactionListData> {
  let apiUrl = `${network.address}/extended/v1/address/${stxAddress}/transactions`;

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

async function getMempoolTransactions({
  stxAddress,
  network,
  offset,
  limit,
}: {
  stxAddress: string;
  network: SettingsNetwork;
  offset: number;
  limit: number;
}): Promise<StxMempoolTransactionListData> {
  let apiUrl = `${network.address}/extended/v1/tx/mempool?address=${stxAddress}`;

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

async function getTransferTransactions(
  stxAddress: string,
  network: SettingsNetwork
): Promise<StxTransactionData[]> {
  let apiUrl = `${network.address}/extended/v1/address/${stxAddress}/transactions_with_transfers`;
  return axios
    .get<TransferTransactionsData>(apiUrl, {
      timeout: API_TIMEOUT_MILLI,
    })
    .then((response) => {
      const transactions: StxTransactionData[] = [];
      response.data.results.forEach((t) => {
        transactions.push(mapTransferTransactionData({ responseTx: t.tx, stxAddress }));
      });

      return transactions;
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
  let apiUrl = `${network.name}/extended/v1/address/${stxAddress}/balances`;

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
        limit: PAGINATION_LIMIT,
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
