import {
  TransactionPayload,
  TransactionTypes,
  ContractCallPayload,
  STXTransferPayload,
  ContractDeployPayload,
} from '@stacks/connect';
import { StacksNetwork } from '@stacks/network';
import {
  AddressHashMode,
  addressToString,
  Authorization,
  AuthType,
  cvToValue,
  MultiSigHashMode,
  PayloadType,
  PostCondition,
  serializeCV,
  serializePostCondition,
  SingleSigHashMode,
  StacksTransaction,
  getFee,
} from '@stacks/transactions';
import { BigNumber } from 'bignumber.js';
import { createContractCallPromises, generateUnsignedStxTokenTransferTransaction } from '../transactions';
import { AppInfo, StxPendingTxData } from '../types';
import { buf2hex } from '../utils/arrayBuffers';
import { STX_DECIMALS } from '../constant';

export async function getContractCallPromises(
  payload: TransactionPayload,
  stxAddress: string,
  network: StacksNetwork,
  stxPublicKey: string,
  auth?: Authorization,
) {
  const [unSignedContractCall, contractInterface, coinsMetaData, showPostConditionMessage] =
    await createContractCallPromises(payload, stxAddress, network, stxPublicKey);
  if (auth) {
    unSignedContractCall.auth = auth;
  }
  return {
    unSignedContractCall,
    contractInterface,
    coinsMetaData,
    showPostConditionMessage,
  };
}

/**
 * applyFeeMultiplier - modifies the param unsignedTx with stx fee multiplier
 */
export const applyFeeMultiplier = (unsignedTx: StacksTransaction, appInfo: AppInfo | null) => {
  if (appInfo === null || !appInfo?.stxSendTxMultiplier) {
    return;
  }

  let newFee = getFee(unsignedTx.auth) * BigInt(appInfo.stxSendTxMultiplier);

  // cap the fee at thresholdHighStacksFee
  if (newFee > BigInt(appInfo.thresholdHighStacksFee)) {
    newFee = BigInt(appInfo.thresholdHighStacksFee);
  }

  unsignedTx.setFee(newFee);
};

export async function getTokenTransferRequest(
  recipient: string,
  amount: string,
  memo: string,
  stxPublicKey: string,
  feeMultipliers: AppInfo | null,
  network: StacksNetwork,
  stxPendingTransactions?: StxPendingTxData,
  auth?: Authorization,
) {
  const unsignedSendStxTx: StacksTransaction = await generateUnsignedStxTokenTransferTransaction(
    recipient,
    amount,
    memo,
    stxPendingTransactions?.pendingTransactions ?? [],
    stxPublicKey,
    network,
  );

  applyFeeMultiplier(unsignedSendStxTx, feeMultipliers);

  if (auth) {
    unsignedSendStxTx.auth = auth;
  }
  return unsignedSendStxTx;
}

export const isMultiSig = (tx: StacksTransaction): boolean => {
  const hashMode = tx.auth.spendingCondition.hashMode as MultiSigHashMode | SingleSigHashMode;
  return hashMode === AddressHashMode.SerializeP2SH || hashMode === AddressHashMode.SerializeP2WSH ? true : false;
};

const cleanMemoString = (memo: string): string => memo.replace('\u0000', '');

function encodePostConditions(postConditions: PostCondition[]) {
  return postConditions.map((pc) => buf2hex(serializePostCondition(pc)));
}

export const txPayloadToRequest = (
  stacksTransaction: StacksTransaction,
  stxAddress?: string,
  attachment?: string,
): Partial<TransactionPayload> => {
  const { payload, auth, postConditions, postConditionMode, anchorMode } = stacksTransaction;
  const encodedPostConditions = encodePostConditions(postConditions.values as PostCondition[]);
  const transactionRequest: Partial<TransactionPayload> = {
    attachment,
    stxAddress,
    sponsored: auth.authType === AuthType.Sponsored,
    nonce: Number(auth.spendingCondition.nonce),
    fee: Number(auth.spendingCondition.fee),
    postConditions: encodedPostConditions,
    postConditionMode: postConditionMode,
    anchorMode: anchorMode,
  };
  switch (payload.payloadType) {
    case PayloadType.TokenTransfer:
      const stxTransferPayload: Partial<STXTransferPayload> = {
        ...transactionRequest,
        txType: TransactionTypes.STXTransfer,
        recipient: cvToValue(payload.recipient, true),
        amount: new BigNumber(Number(payload.amount))
          .shiftedBy(-STX_DECIMALS)
          .toNumber()
          .toLocaleString('en-US', { maximumFractionDigits: STX_DECIMALS }),
        memo: cleanMemoString(payload.memo.content),
      };
      return stxTransferPayload;
    case PayloadType.ContractCall:
      const contractCallPayload: Partial<ContractCallPayload> = {
        ...transactionRequest,
        txType: TransactionTypes.ContractCall,
        contractName: payload.contractName.content,
        contractAddress: addressToString(payload.contractAddress),
        functionArgs: payload.functionArgs.map((arg) => Buffer.from(serializeCV(arg)).toString('hex')),
        functionName: payload.functionName.content,
      };
      return contractCallPayload;
    case PayloadType.SmartContract:
    case PayloadType.VersionedSmartContract:
      const contractDeployPayload: Partial<ContractDeployPayload> = {
        ...transactionRequest,
        txType: TransactionTypes.ContractDeploy,
        contractName: payload.contractName.content,
        codeBody: payload.codeBody.content,
      };
      return contractDeployPayload;
    default:
      throw new Error('Unsupported tx type');
  }
};
