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
  serializeCV,
  SingleSigHashMode,
  StacksTransactionWire,
  getFee,
  LengthPrefixedList,
  serializePostConditionWire,
  PostConditionWire,
  PostCondition,
  deserializePostConditionWire,
} from '@stacks/transactions';
import { BigNumber } from 'bignumber.js';
import { createContractCallPromises, generateUnsignedTx } from '../transactions';
import { AppInfo } from '../types';
import { STX_DECIMALS } from '../constant';
import { bytesToHex } from '@noble/hashes/utils';

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
 * stxFeeReducer - given initialFee, and appInfo (stacks fee multiplier and threshold config),
 * return the newFee
 * @param initialFee
 * @param appInfo
 * @returns newFee
 */
export const stxFeeReducer = ({ initialFee, appInfo }: { initialFee: bigint; appInfo: AppInfo | null }): bigint => {
  let newFee = initialFee;

  // apply multiplier
  if (appInfo?.stxSendTxMultiplier && Number.isInteger(appInfo?.stxSendTxMultiplier)) {
    newFee = newFee * BigInt(appInfo.stxSendTxMultiplier);
  }

  // cap the fee at thresholdHighStacksFee
  if (
    appInfo?.thresholdHighStacksFee &&
    Number.isInteger(appInfo?.thresholdHighStacksFee) &&
    newFee > BigInt(appInfo.thresholdHighStacksFee)
  ) {
    newFee = BigInt(appInfo.thresholdHighStacksFee);
  }

  return newFee;
};

/**
 * applyFeeMultiplier - modifies the param unsignedTx with stx fee multiplier
 * @param unsignedTx
 * @param appInfo
 */
export const applyFeeMultiplier = (unsignedTx: StacksTransactionWire, appInfo: AppInfo | null) => {
  if (!appInfo) {
    return;
  }

  const newFee = stxFeeReducer({ initialFee: getFee(unsignedTx.auth), appInfo });
  unsignedTx.setFee(newFee);
};

export async function getTokenTransferRequest(
  recipient: string,
  amount: string,
  memo: string,
  stxPublicKey: string,
  feeMultipliers: AppInfo | null,
  network: StacksNetwork,
  auth?: Authorization,
) {
  const unsignedSendStxTx: StacksTransactionWire = await generateUnsignedTx({
    payload: {
      txType: TransactionTypes.STXTransfer,
      recipient,
      memo,
      amount,
      network,
      publicKey: stxPublicKey,
    },
    publicKey: stxPublicKey,
    sponsored: auth?.authType === AuthType.Sponsored,
  });

  applyFeeMultiplier(unsignedSendStxTx, feeMultipliers);

  if (auth) {
    unsignedSendStxTx.auth = auth;
  }
  return unsignedSendStxTx;
}

export const isMultiSig = (tx: StacksTransactionWire): boolean => {
  const hashMode = tx.auth.spendingCondition.hashMode as MultiSigHashMode | SingleSigHashMode;
  return hashMode === AddressHashMode.P2SH || hashMode === AddressHashMode.P2WSH ? true : false;
};

const cleanMemoString = (memo: string): string => memo.replace('\u0000', '');

// todo: remove this function
// function encodePostConditions(postConditions: LengthPrefixedList): string[] {
//   return postConditions.values.map((pc) =>
//     serializePostConditionWire(deserializePostConditionWire(pc)),
//   );
// }

// function encodePostConditions1(postConditions: string[]) {
//   return postConditions.map(pc => bytesToHex(serializePostConditionWire(pc)));
// }

export const txPayloadToRequest = (
  stacksTransaction: StacksTransactionWire,
  stxAddress?: string,
  attachment?: string,
): Partial<TransactionPayload> => {
  const { payload, auth, postConditions, postConditionMode, anchorMode } = stacksTransaction;
  const transactionRequest: Partial<TransactionPayload> = {
    attachment,
    stxAddress,
    sponsored: auth.authType === AuthType.Sponsored,
    nonce: Number(auth.spendingCondition.nonce),
    fee: Number(auth.spendingCondition.fee),
    postConditions: stacksTransaction.postConditions.values as unknown as string[],
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
