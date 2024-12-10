import {
  Address,
  AnchorMode,
  ClarityValue,
  PostCondition,
  PostConditionMode,
  StacksTransactionWire,
  TransactionSigner,
  TxBroadcastResultOk,
  TxBroadcastResultRejected,
  UnsignedContractCallOptions,
  broadcastTransaction,
  bufferCVFromString,
  cvToHex,
  deserializeCV,
  fetchNonce,
  hexToCV,
  makeUnsignedContractCall,
  makeUnsignedContractDeploy,
  makeUnsignedSTXTokenTransfer,
  noneCV,
  someCV,
  standardPrincipalCV,
  uintCV,
} from '@stacks/transactions';
import {
  ContractCallPayload as ConnectContractCallPayload,
  ContractDeployPayload as ConnectContractDeployPayload,
  STXTransferPayload as ConnectSTXTransferPayload,
  TransactionTypes,
} from '@stacks/connect';
import BigNumber from 'bignumber.js';
import { PostConditionsOptions, StacksMainnet, StacksNetwork, StacksTestnet } from '../../types';
import { UnsignedStacksTransation } from '../../types/api/stacks/transaction';
import { getStxAddressKeyChain } from '../../wallet/index';
import { extractFromPayload, makeFungiblePostCondition, makeNonFungiblePostCondition } from './helper';
import { capStxFeeAtThreshold, estimateStacksTransactionWithFallback } from './fees';
import { hexToBytes } from '@noble/hashes/utils';

export interface StacksRecipient {
  address: string;
  amountMicrostacks: BigNumber;
}

export async function signTransaction(
  unsignedTx: StacksTransactionWire,
  seedPhrase: string,
  accountIndex: number,
  network: StacksNetwork,
): Promise<StacksTransactionWire> {
  const tx = unsignedTx;
  const { privateKey } = await getStxAddressKeyChain(seedPhrase, network, accountIndex);
  const signer = new TransactionSigner(tx);
  signer.signOrigin(privateKey);

  return tx;
}

export async function broadcastSignedTransaction(
  signedTx: StacksTransactionWire,
  txNetwork: StacksNetwork,
  attachment: Buffer | undefined = undefined,
): Promise<string> {
  const result = await broadcastTransaction({ transaction: signedTx, network: txNetwork, attachment });
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
  unsignedTxs: Array<StacksTransactionWire>,
  accountIndex: number,
  network: StacksNetwork,
  seedPhrase: string,
): Promise<Array<StacksTransactionWire>> {
  try {
    const signedTxPromises: Array<Promise<StacksTransactionWire>> = [];
    const signingAccountIndex = accountIndex ?? 0;
    unsignedTxs.forEach((unsignedTx) => {
      signedTxPromises.push(signTransaction(unsignedTx, seedPhrase, signingAccountIndex, network));
    });

    return await Promise.all(signedTxPromises);
  } catch (error) {
    throw new Error(error.toString());
  }
}

/**
 *  generate unsigned stx transfer transaction
 */
type UnsignedStxTransferTxArgs = UnsignedTxArgs<ConnectSTXTransferPayload>;

export function generateUnsignedSTXTransferTx(args: UnsignedStxTransferTxArgs) {
  const { payload, publicKey, nonce, sponsored, fee } = args;
  const { recipient, memo, amount, network, anchorMode } = payload;
  const options = {
    recipient,
    memo,
    publicKey,
    anchorMode: anchorMode ?? AnchorMode.Any,
    amount: BigInt(amount),
    nonce,
    fee,
    sponsored,
    network: network === 'mainnet' ? StacksMainnet : StacksTestnet,
  };

  return makeUnsignedSTXTokenTransfer(options);
}

type UnsignedContractCallTxArgs = UnsignedTxArgs<ConnectContractCallPayload>;

/**
 * Constructs an unsigned smart contract call transaction
 */
export async function generateUnsignedContractCallTx(args: UnsignedContractCallTxArgs): Promise<StacksTransactionWire> {
  const { payload, publicKey, nonce, fee } = args;
  const {
    contractName,
    contractAddress,
    functionName,
    sponsored,
    postConditionMode,
    network,
    functionArgs,
    postConditions,
  } = payload;

  const txOptions: UnsignedContractCallOptions = {
    contractAddress,
    contractName,
    functionName,
    functionArgs: functionArgs.map((arg: string) => deserializeCV(hexToBytes(arg))),
    publicKey,
    fee,
    nonce,
    network: network === 'mainnet' ? StacksMainnet : StacksTestnet,
    postConditions: postConditions ? postConditions.filter((pc): pc is PostCondition => typeof pc !== 'string') : [],
    postConditionMode: postConditionMode ?? PostConditionMode.Deny,
    sponsored,
  };
  return makeUnsignedContractCall(txOptions);
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
export async function generateUnsignedTokenTransferTransaction(
  unsignedTx: UnsignedStacksTransation,
): Promise<StacksTransactionWire> {
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
    sponsored,
  } = unsignedTx;

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

  const params: UnsignedContractCallTxArgs = {
    publicKey,
    sponsored,
    payload: {
      txType: TransactionTypes.ContractCall,
      contractAddress,
      contractName,
      functionName,
      publicKey,
      functionArgs: functionArgs.map((arg) => cvToHex(arg)),
      network,
      nonce: undefined,
      postConditions: postConditions,
      sponsored,
    },
  };
  return generateUnsignedContractCallTx(params);
}

type UnsignedContractDeployTxArgs = UnsignedTxArgs<ConnectContractDeployPayload>;

export function generateUnsignedContractDeployTx(args: UnsignedContractDeployTxArgs) {
  const { payload, publicKey, nonce, fee } = args;
  const { contractName, codeBody, network, postConditionMode, anchorMode, postConditions } = payload;
  const options = {
    contractName,
    codeBody,
    nonce,
    fee,
    publicKey,
    anchorMode: anchorMode ?? AnchorMode.Any,
    postConditionMode: postConditionMode || PostConditionMode.Deny,
    postConditions: postConditions ? postConditions.filter((pc): pc is PostCondition => typeof pc !== 'string') : [],
    network: network === 'mainnet' ? StacksMainnet : StacksTestnet,
  };
  return makeUnsignedContractDeploy(options);
}

interface UnsignedTxArgs<TxPayload> {
  payload: TxPayload;
  publicKey: string;
  fee?: bigint;
  nonce?: bigint;
  sponsored?: boolean;
}

export type GenerateUnsignedTransactionOptions = UnsignedTxArgs<
  ConnectContractCallPayload | ConnectSTXTransferPayload | ConnectContractDeployPayload
>;

export async function generateUnsignedTx(options: GenerateUnsignedTransactionOptions): Promise<StacksTransactionWire> {
  const { payload, publicKey, nonce, fee } = options;
  const { network } = payload;

  let tx: StacksTransactionWire;
  switch (payload.txType) {
    case TransactionTypes.STXTransfer:
      tx = await generateUnsignedSTXTransferTx({
        payload: payload as ConnectSTXTransferPayload,
        publicKey,
        nonce,
        fee,
      });
      break;
    case TransactionTypes.ContractCall:
      tx = await generateUnsignedContractCallTx({
        payload: payload as ConnectContractCallPayload,
        publicKey,
        nonce,
        fee,
      });
      break;
    case TransactionTypes.ContractDeploy:
      tx = await generateUnsignedContractDeployTx({
        payload: payload as ConnectContractDeployPayload,
        publicKey,
        nonce,
        fee,
      });
      break;
    default:
      throw new Error(`Invalid Transaction Type`);
  }

  const txFee = await estimateStacksTransactionWithFallback(tx, network === 'mainnet' ? StacksMainnet : StacksTestnet);
  tx.setFee(txFee[1].fee);
  await capStxFeeAtThreshold(tx, network === 'mainnet' ? StacksMainnet : StacksTestnet);
  const senderAddress = Address.fromPublicKey(publicKey, network === 'mainnet' ? StacksMainnet : StacksTestnet);
  const txNonce = await fetchNonce({ address: senderAddress, network: network === 'mainnet' ? 'mainnet' : 'testnet' });
  tx.setNonce(txNonce);

  return tx;
}
