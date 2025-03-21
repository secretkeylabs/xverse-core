import { TransactionTypes } from '@stacks/connect';
import { poxAddressToTuple } from '@stacks/stacking';
import {
  contractPrincipalCV,
  cvToHex,
  getAddressFromPublicKey,
  noneCV,
  someCV,
  standardPrincipalCV,
  uintCV,
} from '@stacks/transactions';
import BigNumber from 'bignumber.js';
import { XverseApi } from '../../api';
import { StacksNetwork, StacksTransactionWire } from '../../types';
import { generateUnsignedTx } from './builders';
import { nextBestNonce } from './nonceHelpers';

export async function generateUnsignedDelegateTransaction(
  amount: BigNumber,
  rewardAddress: string,
  poolAddress: string,
  poolContractAddress: string,
  poolContractName: string,
  publicKey: string,
  network: StacksNetwork,
  poolPoxAddress: string,
  xverseApiClient: XverseApi,
): Promise<StacksTransactionWire> {
  const poolRewardAddressTuple = poxAddressToTuple(poolPoxAddress);
  const userRewardAddressTuple = poxAddressToTuple(rewardAddress);
  const funcArgs = [
    uintCV(amount.toString()),
    standardPrincipalCV(poolAddress),
    noneCV(),
    someCV(poolRewardAddressTuple),
    userRewardAddressTuple,
    noneCV(),
  ];
  const nonce = await nextBestNonce(getAddressFromPublicKey(publicKey), network);
  const unsignedTx = await generateUnsignedTx({
    xverseApiClient,
    payload: {
      txType: TransactionTypes.ContractCall,
      publicKey,
      contractAddress: poolContractAddress,
      contractName: poolContractName,
      functionName: 'delegate-stx',
      functionArgs: funcArgs.map((arg) => cvToHex(arg)),
      network,
      postConditions: [],
    },
    publicKey,
    fee: 0,
    nonce: nonce + 1n,
  });
  return unsignedTx;
}

export async function generateUnsignedAllowContractCallerTransaction(
  poolAddress: string,
  poolContractName: string,
  publicKey: string,
  network: StacksNetwork,
  poxContractAddress: string,
  poxContractName: string,
  xverseApiClient: XverseApi,
): Promise<StacksTransactionWire> {
  const nonce = await nextBestNonce(getAddressFromPublicKey(publicKey), network);
  const unsignedTx = await generateUnsignedTx({
    xverseApiClient,
    payload: {
      txType: TransactionTypes.ContractCall,
      publicKey,
      contractAddress: poxContractAddress,
      contractName: poxContractName,
      functionName: 'allow-contract-caller',
      functionArgs: [contractPrincipalCV(poolAddress, poolContractName), noneCV()].map((arg) => cvToHex(arg)),
      network,
      postConditions: [],
    },
    publicKey,
    fee: 0,
    nonce,
  });

  return unsignedTx;
}

export async function generateUnsignedRevokeTransaction(
  publicKey: string,
  network: StacksNetwork,
  poxContractAddress: string,
  poxContractName: string,
  xverseApiClient: XverseApi,
): Promise<StacksTransactionWire> {
  const unsignedTx = await generateUnsignedTx({
    publicKey,
    xverseApiClient,
    payload: {
      txType: TransactionTypes.ContractCall,
      publicKey,
      contractAddress: poxContractAddress,
      contractName: poxContractName,
      functionName: 'revoke-delegate-stx',
      functionArgs: [],
      network,
      postConditions: [],
    },
    fee: 0,
    nonce: 0,
  });

  return unsignedTx;
}
