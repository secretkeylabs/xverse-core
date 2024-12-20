import {
  TransactionPayload,
  TransactionTypes,
  ContractCallPayload,
  STXTransferPayload,
  ContractDeployPayload,
} from '@stacks/connect';
import { StacksNetwork } from '@stacks/network';
import {
  addressToString,
  Authorization,
  AuthType,
  cvToValue,
  PayloadType,
  serializeCV,
  StacksTransactionWire,
} from '@stacks/transactions';
import { BigNumber } from 'bignumber.js';
import {
  applyFeeMultiplier,
  extractFromPayload,
  generateUnsignedTx,
  getFTInfoFromPostConditions,
  nextBestNonce,
} from '..';
import { AppInfo, Coin, StacksMainnet } from '../../types';
import { STX_DECIMALS } from '../../constant';
import { getContractInterface, getXverseApiClient } from '../../api';

/**
 * processes data for contract call transaction
 * @param payload
 * @param stxAddress
 * @param network
 * @param stxPublicKey
 * @returns all promises for contract call tranastion
 */
export const createContractCallPromises = async (
  payload: ContractCallPayload,
  network: StacksNetwork,
  stxPublicKey: string,
  auth?: Authorization,
) => {
  const { postConds } = extractFromPayload(payload);
  const nonce = await nextBestNonce(payload.stxAddress!, network);
  const ftContactAddresses = getFTInfoFromPostConditions(postConds);

  const coinsMetaDataPromise: Coin[] | null = await getXverseApiClient(
    network.chainId === StacksMainnet.chainId ? 'Mainnet' : 'Testnet',
  ).getSip10Tokens(ftContactAddresses, 'USD');

  const unSignedContractCall = await generateUnsignedTx({
    payload: {
      ...payload,
    },
    fee: auth?.spendingCondition.fee.toString() || '0',
    nonce: auth?.spendingCondition.nonce || nonce,
    publicKey: stxPublicKey,
  });
  if (auth) {
    unSignedContractCall.auth = auth;
  }
  const checkForPostConditionMessage =
    payload?.postConditionMode === 2 && payload?.postConditions && payload.postConditions.length <= 0;
  const showPostConditionMessage = !!checkForPostConditionMessage;

  const contractInterfacePromise = getContractInterface(payload.contractAddress, payload.contractName, network);

  return Promise.all([unSignedContractCall, contractInterfacePromise, coinsMetaDataPromise, showPostConditionMessage]);
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
    fee: auth?.spendingCondition.fee.toString(),
    nonce: auth?.spendingCondition.nonce,
  });

  applyFeeMultiplier(unsignedSendStxTx, feeMultipliers);

  if (auth) {
    unsignedSendStxTx.auth = auth;
  }
  return unsignedSendStxTx;
}

const cleanMemoString = (memo: string): string => memo.replace('\u0000', '');

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
    postConditions: postConditions.values as unknown as string[],
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
