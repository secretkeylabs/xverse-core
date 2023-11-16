import { TransactionPayload, TransactionTypes } from '@stacks/connect';
import { StacksNetwork } from '@stacks/network';
import {
  AddressHashMode,
  addressToString,
  AuthType,
  cvToValue,
  MultiSigHashMode,
  PayloadType,
  PostCondition,
  serializeCV,
  serializePostCondition,
  SingleSigHashMode,
  StacksTransaction,
  VersionedSmartContractPayload,
} from '@stacks/transactions';
import { BigNumber } from 'bignumber.js';
import { createContractCallPromises, generateUnsignedStxTokenTransferTransaction } from '../transactions';
import { FeesMultipliers, StxPendingTxData } from '../types';
import { buf2hex } from '../utils/arrayBuffers';

const STX_DECIMALS = 6;

export async function getContractCallPromises(
  payload: TransactionPayload,
  stxAddress: string,
  network: StacksNetwork,
  stxPublicKey: string,
) {
  const [unSignedContractCall, contractInterface, coinsMetaData, showPostConditionMessage] =
    await createContractCallPromises(payload, stxAddress, network, stxPublicKey);
  return {
    unSignedContractCall,
    contractInterface,
    coinsMetaData,
    showPostConditionMessage,
  };
}

export async function getTokenTransferRequest(
  recipient: string,
  amount: string,
  memo: string,
  stxPublicKey: string,
  feeMultipliers: FeesMultipliers,
  network: StacksNetwork,
  stxPendingTransactions: StxPendingTxData,
) {
  const unsignedSendStxTx: StacksTransaction = await generateUnsignedStxTokenTransferTransaction(
    recipient,
    amount,
    memo!,
    stxPendingTransactions?.pendingTransactions ?? [],
    stxPublicKey,
    network,
  );
  // increasing the fees with multiplication factor
  const fee: bigint = BigInt(unsignedSendStxTx.auth.spendingCondition.fee.toString()) ?? BigInt(0);
  if (feeMultipliers?.stxSendTxMultiplier) {
    unsignedSendStxTx.setFee(fee * BigInt(feeMultipliers.stxSendTxMultiplier));
  }
  return unsignedSendStxTx;
}

export const isMultiSig = (tx: StacksTransaction) => {
  const hashMode = tx.auth.spendingCondition.hashMode as MultiSigHashMode | SingleSigHashMode;
  return hashMode === AddressHashMode.SerializeP2SH || AddressHashMode.SerializeP2WSH;
};

const cleanMemoString = (memo: string): string => memo.replace('\u0000', '');

function encodePostConditions(postConditions: PostCondition[]) {
  return postConditions.map((pc) => buf2hex(serializePostCondition(pc)));
}

export const txPayloadToRequest = (
  stacksTransaction: StacksTransaction,
  stxAddress?: string,
  attachment?: string,
): TransactionPayload => {
  const transactionRequest = {
    attachment,
    stxAddress,
    sponsored: stacksTransaction.auth.authType === AuthType.Sponsored,
    nonce: Number(stacksTransaction.auth.spendingCondition.nonce),
    fee: Number(stacksTransaction.auth.spendingCondition.fee),
    postConditions: encodePostConditions(stacksTransaction.postConditions.values as any[]),
    postConditionMode: stacksTransaction.postConditionMode,
    anchorMode: stacksTransaction.anchorMode,
  } as any;

  switch (stacksTransaction.payload.payloadType) {
    case PayloadType.TokenTransfer:
      transactionRequest.txType = TransactionTypes.STXTransfer;
      transactionRequest.recipient = cvToValue(stacksTransaction.payload.recipient, true);
      transactionRequest.amount = new BigNumber(Number(stacksTransaction.payload.amount))
        .shiftedBy(-STX_DECIMALS)
        .toNumber()
        .toLocaleString('en-US', { maximumFractionDigits: STX_DECIMALS });
      transactionRequest.memo = cleanMemoString(stacksTransaction.payload.memo.content);
      break;
    case PayloadType.ContractCall:
      transactionRequest.txType = TransactionTypes.ContractCall;
      transactionRequest.contractName = stacksTransaction.payload.contractName.content;
      transactionRequest.contractAddress = addressToString(stacksTransaction.payload.contractAddress);
      transactionRequest.functionArgs = stacksTransaction.payload.functionArgs.map((arg) =>
        Buffer.from(serializeCV(arg)).toString('hex'),
      );
      transactionRequest.functionName = stacksTransaction.payload.functionName.content;
      break;
    case PayloadType.SmartContract:
    case PayloadType.VersionedSmartContract:
      transactionRequest.txType = TransactionTypes.ContractDeploy;
      transactionRequest.contractName = stacksTransaction.payload.contractName.content;
      transactionRequest.codeBody = stacksTransaction.payload.codeBody.content;
      transactionRequest.clarityVersion = (stacksTransaction.payload as VersionedSmartContractPayload).clarityVersion;
      break;
    default:
      throw new Error('Unsupported tx type');
  }

  return transactionRequest;
};
