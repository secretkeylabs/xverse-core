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
  StacksTransaction,
  NetworkType,
  Transaction,
  AccountAssetsListData,
  NonFungibleToken,
  NftsListData,
  NftEventsResponse,
  PostConditionsOptions,
} from 'types';
import { API_TIMEOUT_MILLI } from '../constant';
import {
  deDuplicatePendingTx,
  getNewNonce,
  makeFungiblePostCondition,
  makeNonFungiblePostCondition,
  mapTransferTransactionData,
  parseMempoolStxTransactionsData,
  parseStxTransactionData,
} from './helper';
import {StacksMainnet, StacksTestnet} from '@stacks/network';
import { AnchorMode, BufferCV, bufferCVFromString, callReadOnlyFunction, ClarityType, ClarityValue, cvToString, estimateContractFunctionCall, estimateTransfer, hexToCV, makeUnsignedContractCall, makeUnsignedSTXTokenTransfer, noneCV, PostCondition, PrincipalCV, ResponseCV, someCV, standardPrincipalCV, TupleCV, uintCV, UnsignedContractCallOptions, UnsignedTokenTransferOptions, } from '@stacks/transactions';
import { getNonce, setFee, setNonce } from '../transactions';
import { AddressToBnsResponse } from '../types/api/stacks/assets';

export async function getTransaction(txid: string, network: SettingsNetwork): Promise<Transaction> {
  return fetch(`${network.address}/extended/v1/tx/${txid}`, {
    method: 'GET',
  })
    .then((response) => response.json())
    .then((response) => {
      return response;
    });
}

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
 * Constructs an unsigned token transfer transaction
 */
 export async function generateUnsignedSTXTokenTransfer(
  publicKey: string,
  recipientAddress: string,
  amount: string,
  network: NetworkType,
  memo?: string,
  sponsored?: boolean,
): Promise<StacksTransaction> {
  const amountBN = BigInt(amount);
  if(!sponsored)
      sponsored=false;
  const txNetwork =
    network=== 'Mainnet' ? new StacksMainnet() : new StacksTestnet();
  const txOptions: UnsignedTokenTransferOptions = {
    publicKey: publicKey,
    recipient: recipientAddress,
    amount: amountBN,
    memo: memo ?? '',
    network: txNetwork,
    fee: 0,
    sponsored: sponsored,
    anchorMode: AnchorMode.Any,
  };

  return makeUnsignedSTXTokenTransfer(txOptions);
}

/**
 * Estimates the fee for given transaction
 * @param transaction StacksTransaction object
 */
 export async function estimateFees(
  transaction: StacksTransaction,
  network: NetworkType,
): Promise<bigint> {
  const txNetwork =
    network === 'Mainnet' ? new StacksMainnet() : new StacksTestnet();
  return estimateTransfer(transaction, txNetwork).then((fee) => {
    return BigInt(fee.toString());
  });
}

export async function generateUnsignedStxTokenTransferTransaction(
  recipientAddress: string,
  amount: string,
  memo: string,
  pendingTxs: StxMempoolTransactionData[],
  publicKey: string,
  network: NetworkType,
  sponsored?: boolean,
): Promise<StacksTransaction> {
  try {
    var unsignedTx: StacksTransaction | null = null;
    var fee: bigint = BigInt(0);
    var total: bigint = BigInt(0);
    const amountBigint = BigInt(amount);
    unsignedTx = await generateUnsignedSTXTokenTransfer(
      publicKey,
      recipientAddress,
      amount,
      network,
      memo,
      sponsored,
    );
    fee = await estimateFees(unsignedTx, network);

    total = amountBigint + fee;
    unsignedTx.setFee(fee);

    const nonce = getNewNonce(pendingTxs, getNonce(unsignedTx));
    setNonce(unsignedTx, nonce);
    return Promise.resolve(unsignedTx);
  } catch (err: any) {
    return Promise.reject(err.toString());
  }
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

export async function getBnsName(stxAddress: string, network: SettingsNetwork,) {
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


/**
 * Constructs an unsigned smart contract call transaction
 */
 export async function generateUnsignedContractCall(
  publicKey: string,
  contractAddress: string,
  contractName: string,
  functionName: string,
  functionArgs: ClarityValue[],
  network: SettingsNetwork,
  nonce?: bigint,
  postConditions: PostCondition[] = [],
  sponsored?: boolean,
  postConditionMode?: number,
): Promise<StacksTransaction> {
  const txNetwork =
  network.type === 'Mainnet' ? new StacksMainnet() : new StacksTestnet();
  var txOptions: UnsignedContractCallOptions = {
    contractAddress,
    contractName,
    functionName,
    functionArgs,
    publicKey,
    network: txNetwork,
    postConditions: postConditions,
    postConditionMode: postConditionMode ?? 1,
    anchorMode: AnchorMode.Any,
    sponsored: sponsored,
  };

  if (nonce) {
    txOptions['nonce'] = BigInt(nonce);
  }

  return makeUnsignedContractCall(txOptions);
}

/**
 * Estimates the fee for given transaction
 * @param transaction StacksTransaction object
 */
 export async function estimateContractCallFees(
  transaction: StacksTransaction,
  network: SettingsNetwork,
): Promise<bigint> {
  const txNetwork =
    network.type === 'Mainnet' ? new StacksMainnet() : new StacksTestnet();
  return estimateContractFunctionCall(transaction, txNetwork).then((fee) => {
    return fee;
  });
}

/**
 * generate fungible token transfer or nft transfer transaction
 * @param amount
 * @param senderAddress
 * @param recipientAddress
 * @param contractAddress
 * @param contractName
 * @param publicKey
 * @param network
 * @returns
 */
 export async function generateUnsignedTransaction(
  amount: string,
  senderAddress: string,
  recipientAddress: string,
  contractAddress: string,
  contractName: string,
  assetName: string,
  publicKey: string,
  network: SettingsNetwork,
  pendingTxs: StxMempoolTransactionData[],
  memo?: string,
  isNFT: boolean = false,
): Promise<StacksTransaction> {
  var unsignedTx;
  const functionName = 'transfer';
  var functionArgs: ClarityValue[];

  const postConditionOptions: PostConditionsOptions = {
    contractAddress,
    contractName,
    assetName,
    stxAddress: senderAddress,
    amount,
  };

  var postConditions: PostCondition[];
  if (isNFT) {
    postConditions = [makeNonFungiblePostCondition(postConditionOptions)];
    functionArgs = [
      hexToCV(amount),
      standardPrincipalCV(senderAddress),
      standardPrincipalCV(recipientAddress),
    ];
  } else {
    functionArgs = [
      uintCV(Number(amount)),
      standardPrincipalCV(senderAddress),
      standardPrincipalCV(recipientAddress),
    ];
    if (memo) {
      functionArgs.push(
        memo !== '' ? someCV(bufferCVFromString(memo)) : noneCV(),
      );
    } else {
      functionArgs.push(noneCV());
    }
    postConditions = [makeFungiblePostCondition(postConditionOptions)];
  }

  try {
    unsignedTx = await generateUnsignedContractCall(
      publicKey,
      contractAddress,
      contractName,
      functionName,
      functionArgs,
      network,
      undefined,
      postConditions,
    );

    const fee = await estimateContractCallFees(unsignedTx, network);
    setFee(unsignedTx, fee);

    // bump nonce by number of pending transactions
    const nonce = getNewNonce(pendingTxs, getNonce(unsignedTx));
    setNonce(unsignedTx, nonce);
    console.log("inside ")
    console.log(unsignedTx)
    return Promise.resolve(unsignedTx);
  } catch (err: any) {
    console.log("error")
    console.log(err)
    return Promise.reject(err.toString());
  }
}

export async function fetchAddressOfBnsName(
  bnsName: string,
  stxAddress: string,
  network: SettingsNetwork,
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

      var stacksNetwork = null;
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

