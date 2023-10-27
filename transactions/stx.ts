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
import { PostConditionsOptions, StxMempoolTransactionData } from '../types';
import {
  UnsignedContractCallTransaction,
  UnsignedContractDeployOptions,
  UnsignedStacksTransation,
} from '../types/api/stacks/transaction';
import { getStxAddressKeyChain } from '../wallet/index';
import { getNewNonce, makeFungiblePostCondition, makeNonFungiblePostCondition } from './helper';

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
    const signingAccountIndex = accountIndex ?? BigInt(0);
    unsignedTxs.forEach((unsignedTx) => {
      signedTxPromises.push(signTransaction(unsignedTx, seedPhrase, signingAccountIndex, network));
    });

    return await Promise.all(signedTxPromises);
  } catch (error) {
    return Promise.reject(error.toString());
  }
}

export function setNonce(transaction: StacksTransaction, nonce: bigint) {
  transaction.setNonce(nonce);
}

export function getNonce(transaction: StacksTransaction): bigint {
  return transaction.auth.spendingCondition?.nonce ?? BigInt(0);
}

export function setFee(transaction: StacksTransaction, fee: bigint) {
  transaction.setFee(fee);
}

/**
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
  postConditions?: PostCondition[],
  postConditionMode?: PostConditionMode,
): Promise<StacksTransaction> {
  const amountBN = BigInt(amount);
  if (!sponsored) sponsored = false;
  const txOptions: UnsignedTokenTransferOptions = {
    publicKey: publicKey,
    recipient: recipientAddress,
    amount: amountBN,
    memo: memo ?? '',
    network: txNetwork,
    fee: 0,
    sponsored,
    anchorMode: anchorMode ? anchorMode : AnchorMode.Any,
    postConditionMode,
    postConditions,
  };

  return makeUnsignedSTXTokenTransfer(txOptions);
}

/**
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
  postConditions?: PostCondition[],
  postConditionMode?: PostConditionMode,
  nonce?: bigint,
): Promise<StacksTransaction> {
  try {
    let unsignedTx: StacksTransaction | null = null;
    let fee = BigInt(0);
    let total = BigInt(0);
    const amountBigint = BigInt(amount);
    unsignedTx = await generateUnsignedSTXTokenTransfer(
      publicKey,
      recipientAddress,
      amount,
      network,
      memo,
      sponsored,
      anchorMode,
      postConditions,
      postConditionMode,
    );
    fee = await estimateFees(unsignedTx, network);
    total = amountBigint + fee;
    unsignedTx.setFee(fee);
    const newNonce = getNewNonce(pendingTxs, getNonce(unsignedTx));
    if (nonce) {
      setNonce(unsignedTx, BigInt(nonce));
    } else {
      setNonce(unsignedTx, newNonce);
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
    postConditionMode: postConditionMode ?? 1,
    anchorMode: anchorMode ? anchorMode : AnchorMode.Any,
    sponsored: sponsored,
  };

  if (nonce) {
    txOptions.nonce = BigInt(nonce);
  }
  try {
    const unsigned = await makeUnsignedContractCall(txOptions);
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

    const fee = await estimateContractCallFees(unsignedTx, network);
    setFee(unsignedTx, fee);

    // bump nonce by number of pending transactions
    const nonce = getNewNonce(pendingTxs, getNonce(unsignedTx));
    setNonce(unsignedTx, nonce);
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
      setNonce(unsignedTx, newNonce);
      return await Promise.resolve(unsignedTx);
    }
  } catch (err) {
    return Promise.reject(err.toString());
  }
}

export { addressToString };
