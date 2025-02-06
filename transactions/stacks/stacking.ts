import {
  ClarityValue,
  contractPrincipalCV,
  cvToHex,
  getAddressFromPublicKey,
  noneCV,
  standardPrincipalCV,
  uintCV,
} from '@stacks/transactions';
import BigNumber from 'bignumber.js';
import { StacksNetwork, StacksTransactionWire } from '../../types';
import { generateUnsignedTx } from './builders';
import { poxAddressToTuple } from '@stacks/stacking';
import { nextBestNonce } from './nonceHelpers';
import { TransactionTypes } from '@stacks/connect';

export async function generateUnsignedDelegateTransaction(
  amount: BigNumber,
  rewardAddress: string,
  poolAddress: string,
  poolContractAddress: string,
  poolContractName: string,
  publicKey: string,
  network: StacksNetwork,
  poolPoxAddress: string,
): Promise<StacksTransactionWire> {
  const poolRewardAddressTuple = poxAddressToTuple(poolPoxAddress);
  const userRewardAddressTuple = poxAddressToTuple(rewardAddress);
  const funcArgs = [
    uintCV(amount.toString()),
    standardPrincipalCV(poolAddress),
    noneCV(),
    poolRewardAddressTuple,
    userRewardAddressTuple,
    noneCV(),
  ];
  const unsignedTx = await generateUnsignedTx({
    payload: {
      txType: TransactionTypes.ContractCall,
      publicKey,
      contractAddress: poolContractAddress,
      contractName: poolContractName,
      functionName: 'delegate-stx',
      functionArgs: funcArgs.map((arg) => cvToHex(arg as ClarityValue)),
      network,
      postConditions: [],
    },
    publicKey,
    fee: 0,
  });
  const nonce = await nextBestNonce(getAddressFromPublicKey(publicKey), network);
  unsignedTx.setNonce(nonce + 1n);
  return unsignedTx;
}

export async function generateUnsignedAllowContractCallerTransaction(
  poolAddress: string,
  poolContractName: string,
  publicKey: string,
  network: StacksNetwork,
  poxContractAddress: string,
  poxContractName: string,
): Promise<StacksTransactionWire> {
  const unsignedTx = await generateUnsignedTx({
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
  });

  return unsignedTx;
}

export async function generateUnsignedRevokeTransaction(
  publicKey: string,
  network: StacksNetwork,
  poxContractAddress: string,
  poxContractName: string,
): Promise<StacksTransactionWire> {
  const unsignedTx = await generateUnsignedTx({
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
    publicKey,
    fee: 0,
  });

  return unsignedTx;
}
