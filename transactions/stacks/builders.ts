import { HDKey } from '@scure/bip32';
import {
  ContractCallPayload as ConnectContractCallPayload,
  ContractDeployPayload as ConnectContractDeployPayload,
  ConnectNetwork,
  STXTransferPayload as ConnectSTXTransferPayload,
  TransactionTypes,
} from '@stacks/connect';
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
  deserializePostConditionWire,
  hexToCV,
  makeUnsignedContractCall,
  makeUnsignedContractDeploy,
  makeUnsignedSTXTokenTransfer,
  noneCV,
  someCV,
  standardPrincipalCV,
  uintCV,
} from '@stacks/transactions';
import BigNumber from 'bignumber.js';
import { XverseApi } from '../../api';
import { getStxAddressKeyChain } from '../../account';
import { PostConditionsOptions, StacksMainnet, StacksNetwork, StacksTestnet } from '../../types';
import { DerivationType } from '../../vaults';
import { applyMultiplierAndCapFeeAtThreshold, estimateStacksTransactionWithFallback } from './fees';
import { makeFungiblePostCondition, makeNonFungiblePostCondition } from './helper';
import { nextBestNonce } from './nonceHelpers';

export interface StacksRecipient {
  address: string;
  amountMicrostacks: BigNumber;
}

export async function signTransaction(
  unsignedTx: StacksTransactionWire,
  rootNode: HDKey,
  derivationType: DerivationType,
  accountIndex: number,
  network: StacksNetwork,
): Promise<StacksTransactionWire> {
  const tx = unsignedTx;
  const { privateKey } = await getStxAddressKeyChain(network, rootNode, derivationType, BigInt(accountIndex));
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
  rootNode: HDKey,
  derivationType: DerivationType,
): Promise<Array<StacksTransactionWire>> {
  try {
    const signedTxPromises: Array<Promise<StacksTransactionWire>> = [];
    unsignedTxs.forEach((unsignedTx) => {
      signedTxPromises.push(signTransaction(unsignedTx, rootNode, derivationType, accountIndex, network));
    });

    return await Promise.all(signedTxPromises);
  } catch (error) {
    throw new Error(error.toString());
  }
}

type UnsignedStxTransferTxArgs = UnsignedTxArgs<ConnectSTXTransferPayload>;

/**
 *  generate unsigned stx transfer transaction
 */
const generateUnsignedSTXTransferTx = async (args: UnsignedStxTransferTxArgs) => {
  const { payload, publicKey, nonce, sponsored, fee } = args;
  const { recipient, memo, amount, network, anchorMode } = payload;
  const options = {
    recipient,
    memo,
    publicKey,
    anchorMode: anchorMode ?? AnchorMode.Any,
    amount: BigInt(amount),
    nonce,
    fee: fee ? BigInt(fee) : BigInt(0),
    sponsored,
    network: network as StacksNetwork,
  };

  return makeUnsignedSTXTokenTransfer(options);
};

type UnsignedContractCallTxArgs = UnsignedTxArgs<ConnectContractCallPayload>;

/**
 * Constructs an unsigned smart contract call transaction
 */
const generateUnsignedContractCallTx = async (args: UnsignedContractCallTxArgs): Promise<StacksTransactionWire> => {
  const { payload, publicKey, nonce, fee } = args;
  const {
    contractName,
    contractAddress,
    functionName,
    sponsored,
    postConditionMode,
    network,
    postConditions,
    functionArgs,
  } = payload;

  const deserializedFunctionArgs = functionArgs?.map((arg: string) => hexToCV(arg));

  /**
   * Process post conditions for contract calls, handling two possible input formats:
   * 1. Serialized strings: These are deserialized directly to PostConditionWire
   * 2. PostCondition objects: These are passed through as-is
   *
   * This approach aligns with makeUnsignedContractCall's internal processing:
   * ```
   * const postConditions: PostConditionWire[] = options.postConditions.map(pc => {
   *   if (typeof pc.type === 'string') return postConditionToWire(pc);
   *   return pc;
   * });
   * ```
   */
  const deserializedPostConditions =
    (postConditions?.map((pc) =>
      typeof pc === 'string' ? deserializePostConditionWire(pc) : pc,
    ) as PostCondition[]) ?? [];

  const txOptions: UnsignedContractCallOptions = {
    contractAddress,
    contractName,
    functionName,
    functionArgs: deserializedFunctionArgs,
    publicKey,
    fee: fee ? BigInt(fee) : BigInt(0),
    nonce,
    network: network as StacksNetwork,
    postConditions: deserializedPostConditions,
    postConditionMode: postConditionMode ?? PostConditionMode.Deny,
    sponsored,
  };

  return makeUnsignedContractCall(txOptions);
};

type UnsignedContractDeployTxArgs = UnsignedTxArgs<ConnectContractDeployPayload>;

const generateUnsignedContractDeployTx = async (args: UnsignedContractDeployTxArgs) => {
  const { payload, publicKey, nonce, fee } = args;
  const { contractName, codeBody, network, postConditionMode, anchorMode, postConditions } = payload;
  const deserializedPostConditions = postConditions
    ? (postConditions.map((pc) => (typeof pc === 'string' ? deserializePostConditionWire(pc) : pc)) as PostCondition[])
    : [];
  const options = {
    contractName,
    codeBody,
    nonce,
    fee: fee ? BigInt(fee) : BigInt(0),
    publicKey,
    anchorMode: anchorMode ?? AnchorMode.Any,
    postConditionMode: postConditionMode || PostConditionMode.Deny,
    postConditions: deserializedPostConditions,
    network: network === 'mainnet' ? StacksMainnet : StacksTestnet,
  };
  return makeUnsignedContractDeploy(options);
};

interface UnsignedTxArgs<TxPayload> {
  payload: TxPayload;
  publicKey: string;
  fee?: number | string;
  nonce?: number | bigint;
  sponsored?: boolean;
  xverseApiClient: XverseApi;
}

export type GenerateUnsignedTransactionOptions = UnsignedTxArgs<
  ConnectContractCallPayload | ConnectSTXTransferPayload | ConnectContractDeployPayload
>;

export function isStacksNetwork(network: ConnectNetwork): network is StacksNetwork {
  return (network as StacksNetwork).chainId !== undefined;
}

export const generateUnsignedTx = async (
  options: GenerateUnsignedTransactionOptions,
): Promise<StacksTransactionWire> => {
  const { payload, publicKey, nonce, fee, xverseApiClient } = options;
  const { network } = payload;
  let tx: StacksTransactionWire;
  switch (payload.txType) {
    case TransactionTypes.STXTransfer:
      tx = await generateUnsignedSTXTransferTx({
        payload: payload as ConnectSTXTransferPayload,
        publicKey,
        nonce,
        fee,
        xverseApiClient,
      });
      break;
    case TransactionTypes.ContractCall:
      tx = await generateUnsignedContractCallTx({
        payload: payload as ConnectContractCallPayload,
        publicKey,
        nonce,
        fee,
        xverseApiClient,
      });
      break;
    case TransactionTypes.ContractDeploy:
      tx = await generateUnsignedContractDeployTx({
        payload: payload as ConnectContractDeployPayload,
        publicKey,
        nonce,
        fee,
        xverseApiClient,
      });
      break;
    default:
      throw new Error(`Invalid Transaction Type`);
  }

  if (!network) {
    throw new Error('Network is undefined');
  }

  if (!fee || fee === '0') {
    const txFee = await estimateStacksTransactionWithFallback(tx, isStacksNetwork(network) ? network : StacksMainnet);
    tx.setFee(txFee[1].fee);
  }
  await applyMultiplierAndCapFeeAtThreshold(tx, xverseApiClient);

  if (!nonce || nonce === 0) {
    const senderAddress = Address.fromPublicKey(publicKey, isStacksNetwork(network) ? network : StacksMainnet);
    const txNonce = await nextBestNonce(senderAddress, isStacksNetwork(network) ? network : StacksMainnet);
    tx.setNonce(txNonce);
  }

  return tx;
};

/**
 * generate a sip10 token transfer transaction
 */
export async function generateUnsignedSip10TransferTransaction(options: {
  publicKey: string;
  network: StacksNetwork;
  contractAddress: string;
  contractName: string;
  assetName: string;
  amount: string;
  senderAddress: string;
  recipientAddress: string;
  memo: string;
  xverseApiClient: XverseApi;
  sponsored?: boolean;
}): Promise<StacksTransactionWire> {
  const {
    contractAddress,
    contractName,
    assetName,
    senderAddress,
    amount,
    recipientAddress,
    memo,
    publicKey,
    network,
    xverseApiClient,
    sponsored = false,
  } = options;

  const functionName = 'transfer';

  const functionArgs: ClarityValue[] = [
    uintCV(Number(amount)),
    standardPrincipalCV(senderAddress),
    standardPrincipalCV(recipientAddress),
  ];

  const postConditionOptions: PostConditionsOptions = {
    contractAddress,
    contractName,
    assetName,
    stxAddress: senderAddress,
    amount,
  };
  const postConditions: PostCondition[] = [makeFungiblePostCondition(postConditionOptions)];

  if (memo) {
    functionArgs.push(memo !== '' ? someCV(bufferCVFromString(memo)) : noneCV());
  } else {
    functionArgs.push(noneCV());
  }

  const params: UnsignedContractCallTxArgs = {
    publicKey,
    sponsored,
    nonce: 0,
    fee: 0,
    xverseApiClient,
    payload: {
      txType: TransactionTypes.ContractCall,
      contractAddress,
      contractName,
      functionName,
      publicKey,
      functionArgs: functionArgs.map((arg) => cvToHex(arg)),
      network,
      postConditions: postConditions,
      sponsored,
    },
  };
  return generateUnsignedTx(params);
}

/**
 * generates a unsigned NFT transfer transaction
 */
export async function generateUnsignedNftTransferTransaction(options: {
  contractAddress: string;
  contractName: string;
  assetName: string;
  amount: string;
  senderAddress: string;
  recipientAddress: string;
  publicKey: string;
  network: StacksNetwork;
  xverseApiClient: XverseApi;
  sponsored?: boolean;
}): Promise<StacksTransactionWire> {
  const {
    contractAddress,
    contractName,
    assetName,
    senderAddress,
    amount,
    recipientAddress,
    publicKey,
    network,
    xverseApiClient,
    sponsored = false,
  } = options;

  const functionName = 'transfer';

  const functionArgs: ClarityValue[] = [
    hexToCV(amount),
    standardPrincipalCV(senderAddress),
    standardPrincipalCV(recipientAddress),
  ];

  const postConditionOptions: PostConditionsOptions = {
    contractAddress,
    contractName,
    assetName,
    stxAddress: senderAddress,
    amount,
  };

  const postConditions: PostCondition[] = [makeNonFungiblePostCondition(postConditionOptions)];

  const params: UnsignedContractCallTxArgs = {
    publicKey,
    sponsored,
    nonce: 0,
    fee: 0,
    xverseApiClient,
    payload: {
      txType: TransactionTypes.ContractCall,
      contractAddress,
      contractName,
      functionName,
      publicKey,
      functionArgs: functionArgs.map((arg) => cvToHex(arg)),
      network,
      postConditions: postConditions,
      sponsored,
    },
  };
  return generateUnsignedTx(params);
}
