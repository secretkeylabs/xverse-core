import { AssetInfo, createAssetInfo, FungibleConditionCode, hexToCV, makeStandardFungiblePostCondition, makeStandardNonFungiblePostCondition, NonFungibleConditionCode, PostCondition } from '@stacks/transactions';
import {
  StxMempoolTransactionData,
  PostConditionsOptions,
} from 'types';

export function getNewNonce(
  pendingTransactions: StxMempoolTransactionData[],
  currentNonce: bigint
): bigint {
  if ((pendingTransactions ?? []).length === 0) {
    // handle case where account nonce is 0 and no pending transactions
    return currentNonce;
  }
  const maxPendingNonce = Math.max(
    ...(pendingTransactions ?? []).map((transaction) => transaction?.nonce)
  );
  if (maxPendingNonce >= currentNonce) {
    return BigInt(maxPendingNonce + 1);
  } else {
    return currentNonce;
  }
}

export function makeNonFungiblePostCondition(
  options: PostConditionsOptions,
): PostCondition {
  const {contractAddress, contractName, assetName, stxAddress, amount} =
    options;

  const assetInfo: AssetInfo = createAssetInfo(
    contractAddress,
    contractName,
    assetName,
  );
  return makeStandardNonFungiblePostCondition(
    stxAddress,
    NonFungibleConditionCode.DoesNotOwn,
    assetInfo,
    hexToCV(amount.toString()),
  );
}

export function makeFungiblePostCondition(
  options: PostConditionsOptions,
): PostCondition {
  const {contractAddress, contractName, assetName, stxAddress, amount} =
    options;

  const assetInfo = createAssetInfo(contractAddress, contractName, assetName);
  return makeStandardFungiblePostCondition(
    stxAddress,
    FungibleConditionCode.Equal,
    BigInt(amount),
    assetInfo,
  );
}
