import { ClarityValue, contractPrincipalCV, cvToHex, noneCV, standardPrincipalCV, uintCV } from '@stacks/transactions';
import BigNumber from 'bignumber.js';
import { StacksNetwork, StacksTransactionWire, StxMempoolTransactionData } from '../../types';
import { generateUnsignedTx } from './builders';
import { poxAddressToTuple } from '@stacks/stacking';
import { getNewNonce, getNonce } from './nonceHelpers';
import { estimateStacksTransactionWithFallback } from './fees';
import { TransactionTypes } from '@stacks/connect';

export async function generateUnsignedDelegateTransaction(
  amount: BigNumber,
  rewardAddress: string,
  poolAddress: string,
  poolContractAddress: string,
  poolContractName: string,
  pendingTxs: StxMempoolTransactionData[],
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
    publicKey,
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
  });
  const fee = await estimateStacksTransactionWithFallback(unsignedTx, network);
  unsignedTx.setFee(fee[1].fee);
  const nonce = getNewNonce(pendingTxs, getNonce(unsignedTx));
  unsignedTx.setNonce(nonce + 1n);
  return unsignedTx;
}

export async function generateUnsignedAllowContractCallerTransaction(
  poolAddress: string,
  poolContractName: string,
  pendingTxs: StxMempoolTransactionData[],
  publicKey: string,
  network: StacksNetwork,
  poxContractAddress: string,
  poxContractName: string,
): Promise<StacksTransactionWire> {
  const unsignedTx = await generateUnsignedTx({
    publicKey,
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
  });
  const fee = await estimateStacksTransactionWithFallback(unsignedTx, network);
  unsignedTx.setFee(fee[1].fee);

  const nonce = getNewNonce(pendingTxs, getNonce(unsignedTx));
  unsignedTx.setNonce(nonce);

  return unsignedTx;
}

export async function generateUnsignedRevokeTransaction(
  pendingTxs: StxMempoolTransactionData[],
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
  });
  const fee = await estimateStacksTransactionWithFallback(unsignedTx, network);
  unsignedTx.setFee(fee[1].fee);
  const nonce = getNewNonce(pendingTxs, getNonce(unsignedTx));
  unsignedTx.setNonce(nonce);

  return unsignedTx;
}
