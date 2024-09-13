import { StacksMainnet, StacksNetwork } from '@stacks/network';
import {
  AddressHashMode,
  AddressVersion,
  AnchorMode,
  ChainID,
  ClarityValue,
  LengthPrefixedString,
  PayloadType,
  PostCondition,
  PostConditionMode,
  SmartContractPayload,
  StacksMessageType,
  StacksTransaction,
  TransactionSigner,
  TransactionVersion,
  TxBroadcastResultOk,
  TxBroadcastResultRejected,
  UnsignedContractCallOptions,
  UnsignedTokenTransferOptions,
  addressToString,
  broadcastTransaction,
  bufferCVFromString,
  codeBodyString,
  createLPList,
  createLPString,
  createSingleSigSpendingCondition,
  createSponsoredAuth,
  createStacksPrivateKey,
  createStacksPublicKey,
  createStandardAuth,
  estimateContractDeploy,
  estimateContractFunctionCall,
  estimateTransaction,
  estimateTransactionByteLength,
  estimateTransfer,
  getNonce as fetchNewNonce,
  hexToCV,
  makeUnsignedContractCall,
  makeUnsignedSTXTokenTransfer,
  noneCV,
  publicKeyToAddress,
  publicKeyToString,
  someCV,
  standardPrincipalCV,
  uintCV,
} from '@stacks/transactions';
import BigNumber from 'bignumber.js';
import { PostConditionsOptions, SettingsNetwork, StxMempoolTransactionData } from '../types';
import {
  LatestNonceResponse,
  RawTransactionResponse,
  UnsignedContractCallTransaction,
  UnsignedContractDeployOptions,
  UnsignedStacksTransation,
} from '../types/api/stacks/transaction';
import { getStxAddressKeyChain } from '../wallet/index';
import { capStxFeeAtThreshold, getNewNonce, makeFungiblePostCondition, makeNonFungiblePostCondition } from './helper';
import axios from 'axios';
import { MempoolFeePriorities } from '@stacks/stacks-blockchain-api-types';

export interface StacksRecipient {
  address: string;
  amountMicrostacks: BigNumber;
}

export async function signTransaction(
  unsignedTx: StacksTransaction,
  seedPhrase: string,
  accountIndex: number,
  network: StacksNetwork,
): Promise<StacksTransaction> {
  const tx = unsignedTx;
  const { privateKey } = await getStxAddressKeyChain(
    seedPhrase,
    network === new StacksMainnet() ? ChainID.Mainnet : ChainID.Testnet,
    accountIndex,
  );
  const signer = new TransactionSigner(tx);
  const stacksPrivateKey = createStacksPrivateKey(privateKey);
  signer.signOrigin(stacksPrivateKey);

  return tx;
}

export async function broadcastSignedTransaction(
  signedTx: StacksTransaction,
  txNetwork: StacksNetwork,
  attachment: Buffer | undefined = undefined,
): Promise<string> {
  const result = await broadcastTransaction(signedTx, txNetwork, attachment);
  if (result.hasOwnProperty('error')) {
    const errorResult = result as TxBroadcastResultRejected;
    if (errorResult.reason.toString() === 'TooMuchChaining') {
      throw new Error(
        // eslint-disable-next-line max-len
        `Too many pending transactions, pending transaction limit reached. Please wait until your previous transactions have been confirmed`,
      );
    }

    throw new Error(errorResult.reason);
  } else {
    const res = result as TxBroadcastResultOk;
    if (signedTx.txid() !== res.txid) {
      throw new Error('post condition error');
    }
    return res.txid;
  }
}

export async function signMultiStxTransactions(
  unsignedTxs: Array<StacksTransaction>,
  accountIndex: number,
  network: StacksNetwork,
  seedPhrase: string,
): Promise<Array<StacksTransaction>> {
  try {
    const signedTxPromises: Array<Promise<StacksTransaction>> = [];
    const signingAccountIndex = accountIndex ?? 0;
    unsignedTxs.forEach((unsignedTx) => {
      signedTxPromises.push(signTransaction(unsignedTx, seedPhrase, signingAccountIndex, network));
    });

    return await Promise.all(signedTxPromises);
  } catch (error) {
    return Promise.reject(error.toString());
  }
}

/**
 * @deprecated use StacksTransaction.setNonce
 */
export function setNonce(transaction: StacksTransaction, nonce: bigint) {
  transaction.setNonce(nonce);
}

export function getNonce(transaction: StacksTransaction): bigint {
  return transaction.auth.spendingCondition?.nonce ?? BigInt(0);
}

/**
 * @deprecated use StacksTransaction.setFee
 */
export function setFee(transaction: StacksTransaction, fee: bigint) {
  transaction.setFee(fee);
}

/**
 * @deprecated use generateUnsignedStxTokenTransferTransaction
 * Constructs an unsigned token transfer transaction
 */
export async function generateUnsignedSTXTokenTransfer(
  publicKey: string,
  recipientAddress: string,
  amount: string,
  txNetwork: StacksNetwork,
  memo?: string,
  sponsored?: boolean,
  anchorMode?: AnchorMode,
): Promise<StacksTransaction> {
  const amountBN = BigInt(amount);
  if (!sponsored) sponsored = false;
  const txOptions: UnsignedTokenTransferOptions = {
    publicKey: publicKey,
    recipient: recipientAddress,
    amount: amountBN,
    memo: memo ?? '',
    network: txNetwork,
    sponsored,
    anchorMode: anchorMode ? anchorMode : AnchorMode.Any,
  };

  return makeUnsignedSTXTokenTransfer(txOptions);
}

/**
 * @deprecated use estimateTransaction
 * Estimates the fee for given transaction
 * @param transaction StacksTransaction object
 */
export async function estimateFees(transaction: StacksTransaction, txNetwork: StacksNetwork): Promise<bigint> {
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
  network: StacksNetwork,
  sponsored?: boolean,
  anchorMode?: AnchorMode,
  nonce?: bigint,
): Promise<StacksTransaction> {
  try {
    const unsignedTx = await generateUnsignedSTXTokenTransfer(
      publicKey,
      recipientAddress,
      amount,
      network,
      memo,
      sponsored,
      anchorMode,
    );
    const [slower, regular, faster] = await estimateTransaction(unsignedTx.payload, undefined, network);
    unsignedTx.setFee(regular.fee);
    const newNonce = getNewNonce(pendingTxs, getNonce(unsignedTx));
    if (nonce) {
      unsignedTx.setNonce(BigInt(nonce));
    } else {
      unsignedTx.setNonce(newNonce);
    }
    return await Promise.resolve(unsignedTx);
  } catch (err) {
    return Promise.reject(err.toString());
  }
}

/**
 * Constructs an unsigned smart contract call transaction
 */
export async function generateUnsignedContractCall(
  unsignedTx: UnsignedContractCallTransaction,
): Promise<StacksTransaction> {
  const {
    network,
    contractAddress,
    contractName,
    functionName,
    functionArgs,
    publicKey,
    postConditions = [],
    postConditionMode,
    sponsored,
    nonce,
    anchorMode,
  } = unsignedTx;
  const txOptions: UnsignedContractCallOptions = {
    contractAddress,
    contractName,
    functionName,
    functionArgs,
    publicKey,
    network,
    postConditions: postConditions,
    postConditionMode: postConditionMode ?? PostConditionMode.Deny,
    anchorMode: anchorMode ? anchorMode : AnchorMode.Any,
    sponsored: sponsored,
  };

  if (nonce) {
    txOptions.nonce = BigInt(nonce);
  }
  try {
    const unsigned = await makeUnsignedContractCall(txOptions);
    // we're getting really high estimated fees from the function, so need to cap at a max threshold
    await capStxFeeAtThreshold(unsigned, network);
    return unsigned;
  } catch (err) {
    const unsigned = await makeUnsignedContractCall({ ...txOptions, fee: BigInt(3000) });
    return unsigned;
  }
}

/**
 * Estimates the fee for given transaction
 * @param transaction StacksTransaction object
 */
export async function estimateContractCallFees(
  transaction: StacksTransaction,
  network: StacksNetwork,
): Promise<bigint> {
  return estimateContractFunctionCall(transaction, network).then((fee) => {
    return fee;
  });
}

export const getMempoolFeePriorities = async (network: StacksNetwork): Promise<MempoolFeePriorities> => {
  const apiUrl = `${network.coreApiUrl}/extended/v2/mempool/fees`;
  const response = await axios.get<MempoolFeePriorities>(apiUrl);
  return response.data;
};

interface FeeEstimation {
  fee: number;
  fee_rate?: number;
}

const getFallbackFees = (
  transaction: StacksTransaction,
  mempoolFees: MempoolFeePriorities,
): [FeeEstimation, FeeEstimation, FeeEstimation] => {
  const { payloadType } = transaction.payload;

  if (payloadType === PayloadType.ContractCall && mempoolFees.contract_call) {
    return [
      { fee: mempoolFees.contract_call.low_priority },
      { fee: mempoolFees.contract_call.medium_priority },
      { fee: mempoolFees.contract_call.high_priority },
    ];
  } else if (payloadType === PayloadType.TokenTransfer && mempoolFees.token_transfer) {
    return [
      { fee: mempoolFees.token_transfer.low_priority },
      { fee: mempoolFees.token_transfer.medium_priority },
      { fee: mempoolFees.token_transfer.high_priority },
    ];
  }
  return [
    { fee: mempoolFees.all.low_priority },
    { fee: mempoolFees.all.medium_priority },
    { fee: mempoolFees.all.high_priority },
  ];
};

/**
 * Estimates the fee using {@link getMempoolFeePriorities} as a fallback if
 * {@link estimateTransaction} does not get an estimation due to the
 * {@link NoEstimateAvailableError} error.
 */
export const estimateStacksTransactionWithFallback = async (
  transaction: StacksTransaction,
  network: StacksNetwork,
): Promise<[FeeEstimation, FeeEstimation, FeeEstimation]> => {
  try {
    const estimatedLen = estimateTransactionByteLength(transaction);
    const [slower, regular, faster] = await estimateTransaction(transaction.payload, estimatedLen, network);
    return [slower, regular, faster];
  } catch (error) {
    const err = error.toString();
    if (!err.includes('NoEstimateAvailable')) {
      throw error;
    }
    const mempoolFees = await getMempoolFeePriorities(network);
    return getFallbackFees(transaction, mempoolFees);
  }
};

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
export async function generateUnsignedTransaction(unsginedTx: UnsignedStacksTransation): Promise<StacksTransaction> {
  let unsignedTx;
  const functionName = 'transfer';
  let functionArgs: ClarityValue[];

  const {
    contractAddress,
    contractName,
    assetName,
    senderAddress,
    amount,
    isNFT = false,
    recipientAddress,
    memo,
    publicKey,
    network,
    pendingTxs,
    sponsored,
  } = unsginedTx;

  const postConditionOptions: PostConditionsOptions = {
    contractAddress,
    contractName,
    assetName,
    stxAddress: senderAddress,
    amount,
  };

  let postConditions: PostCondition[];
  if (isNFT) {
    postConditions = [makeNonFungiblePostCondition(postConditionOptions)];
    functionArgs = [hexToCV(amount), standardPrincipalCV(senderAddress), standardPrincipalCV(recipientAddress)];
  } else {
    functionArgs = [uintCV(Number(amount)), standardPrincipalCV(senderAddress), standardPrincipalCV(recipientAddress)];
    if (memo) {
      functionArgs.push(memo !== '' ? someCV(bufferCVFromString(memo)) : noneCV());
    } else {
      functionArgs.push(noneCV());
    }
    postConditions = [makeFungiblePostCondition(postConditionOptions)];
  }

  try {
    const unsignedContractCallParam: UnsignedContractCallTransaction = {
      publicKey: publicKey,
      contractAddress,
      contractName,
      functionName,
      functionArgs,
      network,
      nonce: undefined,
      postConditions: postConditions,
      sponsored,
    };
    unsignedTx = await generateUnsignedContractCall(unsignedContractCallParam);

    const [slower, regular, faster] = await estimateStacksTransactionWithFallback(unsignedTx, network);
    unsignedTx.setFee(regular.fee);

    // bump nonce by number of pending transactions
    const nonce = getNewNonce(pendingTxs, getNonce(unsignedTx));
    unsignedTx.setNonce(nonce);
    return await Promise.resolve(unsignedTx);
  } catch (err) {
    return Promise.reject(err.toString());
  }
}

export function createSmartContractPayload(
  contractName: string | LengthPrefixedString,
  codeBody: string | LengthPrefixedString,
): SmartContractPayload {
  if (typeof contractName === 'string') {
    contractName = createLPString(contractName);
  }
  if (typeof codeBody === 'string') {
    codeBody = codeBodyString(codeBody);
  }

  return {
    type: StacksMessageType.Payload,
    payloadType: PayloadType.SmartContract,
    contractName,
    codeBody,
  };
}

export async function makeUnsignedContractDeploy(txOptions: UnsignedContractDeployOptions): Promise<StacksTransaction> {
  const defaultOptions = {
    fee: BigInt(0),
    nonce: BigInt(0),
    network: new StacksMainnet(),
    anchorMode: AnchorMode.Any,
    postConditionMode: PostConditionMode.Deny,
    sponsored: false,
  };

  const options = Object.assign(defaultOptions, txOptions);

  const payload = createSmartContractPayload(options.contractName, options.codeBody);

  const addressHashMode = AddressHashMode.SerializeP2PKH;
  const pubKey = createStacksPublicKey(options.publicKey);

  let authorization = null;

  const spendingCondition = createSingleSigSpendingCondition(
    addressHashMode,
    publicKeyToString(pubKey),
    options.nonce,
    options.fee,
  );

  if (options.sponsored) {
    authorization = createSponsoredAuth(spendingCondition);
  } else {
    authorization = createStandardAuth(spendingCondition);
  }

  const postConditions: PostCondition[] = options.postConditions ?? [];

  const lpPostConditions = createLPList(postConditions);
  const transaction = new StacksTransaction(
    options.network.version,
    authorization,
    payload,
    lpPostConditions,
    options.postConditionMode,
    options.anchorMode,
    options.network.chainId,
  );

  if (!txOptions.fee) {
    const txFee = await estimateContractDeploy(transaction, options.network);
    transaction.setFee(txFee);
  }

  if (!txOptions.nonce) {
    const addressVersion =
      options.network.version === TransactionVersion.Mainnet
        ? AddressVersion.MainnetSingleSig
        : AddressVersion.TestnetSingleSig;
    const senderAddress = publicKeyToAddress(addressVersion, pubKey);
    const txNonce = await fetchNewNonce(senderAddress, options.network);
    transaction.setNonce(txNonce);
  }

  return transaction;
}

export async function generateContractDeployTransaction(options: {
  codeBody: string;
  contractName: string;
  postConditions?: PostCondition[];
  postConditionMode?: PostConditionMode;
  pendingTxs: StxMempoolTransactionData[];
  publicKey: string;
  network: StacksNetwork;
  sponsored?: boolean;
  anchorMode?: AnchorMode;
  nonce?: bigint;
}): Promise<StacksTransaction> {
  try {
    const { nonce } = options;
    const unsignedTx = await makeUnsignedContractDeploy(options);
    if (nonce) {
      return await Promise.resolve(unsignedTx);
    } else {
      const newNonce = getNewNonce(options.pendingTxs, getNonce(unsignedTx));
      unsignedTx.setNonce(newNonce);
      return await Promise.resolve(unsignedTx);
    }
  } catch (err) {
    return Promise.reject(err.toString());
  }
}

export async function getLatestNonce(stxAddress: string, network: SettingsNetwork): Promise<LatestNonceResponse> {
  const baseUrl = network.address;
  const apiUrl = `${baseUrl}/extended/v1/address/${stxAddress}/nonces`;
  return axios.get<LatestNonceResponse>(apiUrl).then((response) => {
    return response.data;
  });
}

/**
 * Suggests the next best nonce, taking into account any missing nonces.
 */
export async function nextBestNonce(stxAddress: string, network: SettingsNetwork): Promise<bigint> {
  const nonceData = await getLatestNonce(stxAddress, network);

  if (nonceData.detected_missing_nonces.length > 0) {
    return BigInt(nonceData.detected_missing_nonces.at(-1) as number);
  }

  return BigInt(nonceData.possible_next_nonce);
}

export async function getRawTransaction(txId: string, network: SettingsNetwork): Promise<string> {
  const baseUrl = network.address;
  const apiUrl = `${baseUrl}/extended/v1/tx/${txId}/raw`;

  return axios.get<RawTransactionResponse>(apiUrl).then((response) => {
    return response.data.raw_tx;
  });
}

export { addressToString };
