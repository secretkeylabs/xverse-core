import { AssetInfo, createAssetInfo, FungibleConditionCode, hexToCV, makeStandardFungiblePostCondition, makeStandardNonFungiblePostCondition, NonFungibleConditionCode, PostCondition } from '@stacks/transactions';
import BigNumber from 'bignumber.js';
import { btcToSats, getBtcFiatEquivalent, getStxFiatEquivalent, stxToMicrostacks } from '../currency';
import {
  StxMempoolTransactionData,
  PostConditionsOptions,
  FungibleToken,
} from '../types';

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

export function getFiatEquivalent(value: number, currencyType:string, stxBtcRate: BigNumber, btcFiatRate: BigNumber, fungibleToken?: FungibleToken) {
  if ((currencyType === 'FT' && !fungibleToken?.tokenFiatRate) || currencyType === 'NFT') {
    return '';
  }
  if (!value) return '0';
  switch (currencyType) {
    case 'STX':
      return getStxFiatEquivalent(
        stxToMicrostacks(new BigNumber(value)),
        new BigNumber(stxBtcRate),
        new BigNumber(btcFiatRate),
      )
        .toFixed(2)
        .toString();
    case 'BTC':
      return getBtcFiatEquivalent(btcToSats(new BigNumber(value)), new BigNumber(btcFiatRate))
        .toFixed(2)
        .toString();
    case 'FT':
      if (fungibleToken?.tokenFiatRate) {
        return new BigNumber(value)
          .multipliedBy(fungibleToken.tokenFiatRate)
          .toFixed(2)
          .toString();
      }
      break;
    default:
      return '';
  }
}

