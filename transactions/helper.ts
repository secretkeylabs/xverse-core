import { StacksNetwork } from '@stacks/network';
import {
  addressToString,
  AssetInfo,
  BytesReader,
  createAssetInfo,
  deserializeCV,
  deserializeStacksMessage,
  FungibleConditionCode,
  FungiblePostCondition,
  hexToCV,
  makeStandardFungiblePostCondition,
  makeStandardNonFungiblePostCondition,
  NonFungibleConditionCode,
  PostCondition,
  PostConditionType,
  StacksMessageType,
} from '@stacks/transactions';
import BigNumber from 'bignumber.js';
import { fetchStxPendingTxData, getCoinsInfo, getContractInterface } from '../api';
import { btcToSats, getBtcFiatEquivalent, getStxFiatEquivalent, stxToMicrostacks } from '../currency';
import { Coin, FeesMultipliers, FungibleToken, PostConditionsOptions, StxMempoolTransactionData } from '../types';
import { generateContractDeployTransaction, generateUnsignedContractCall, getNonce, setNonce } from './stx';

export function getNewNonce(pendingTransactions: StxMempoolTransactionData[], currentNonce: bigint): bigint {
  if ((pendingTransactions ?? []).length === 0) {
    // handle case where account nonce is 0 and no pending transactions
    return currentNonce;
  }
  const maxPendingNonce = Math.max(...(pendingTransactions ?? []).map((transaction) => transaction?.nonce));
  if (maxPendingNonce >= currentNonce) {
    return BigInt(maxPendingNonce + 1);
  } else {
    return currentNonce;
  }
}

export function makeNonFungiblePostCondition(options: PostConditionsOptions): PostCondition {
  const { contractAddress, contractName, assetName, stxAddress, amount } = options;

  const assetInfo: AssetInfo = createAssetInfo(contractAddress, contractName, assetName);
  return makeStandardNonFungiblePostCondition(
    stxAddress,
    NonFungibleConditionCode.Sends,
    assetInfo,
    hexToCV(amount.toString()),
  );
}

export function makeFungiblePostCondition(options: PostConditionsOptions): PostCondition {
  const { contractAddress, contractName, assetName, stxAddress, amount } = options;

  const assetInfo = createAssetInfo(contractAddress, contractName, assetName);
  return makeStandardFungiblePostCondition(stxAddress, FungibleConditionCode.Equal, BigInt(amount), assetInfo);
}

export function getFiatEquivalent(
  value: number,
  currencyType: string,
  stxBtcRate: BigNumber,
  btcFiatRate: BigNumber,
  fungibleToken?: FungibleToken,
) {
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
        return new BigNumber(value).multipliedBy(fungibleToken.tokenFiatRate).toFixed(2).toString();
      }
      break;
    default:
      return '';
  }
}

function removeHexPrefix(hexString: string): string {
  if (hexString !== 'string') return hexString;
  return hexString.startsWith('0x') ? hexString.replace('0x', '') : hexString;
}

export function hexStringToBuffer(hex: string): Buffer {
  return Buffer.from(removeHexPrefix(hex), 'hex');
}

/**
 * extract function arguments and post conditions from browser transaction payload
 * @param payload
 * @returns
 */
export const extractFromPayload = (payload: any) => {
  const { functionArgs, postConditions } = payload;
  const funcArgs = functionArgs?.map((arg: string) => deserializeCV(hexStringToBuffer(arg)));

  const postConds = Array.isArray(postConditions)
    ? (postConditions?.map(
        (arg: string) =>
          deserializeStacksMessage(
            new BytesReader(hexStringToBuffer(arg)),
            StacksMessageType.PostCondition,
          ) as PostCondition,
      ) as PostCondition[])
    : [];

  return { funcArgs, postConds };
};

export const getFTInfoFromPostConditions = (postConds: PostCondition[]) =>
  (
    postConds?.filter((postCond) => postCond.conditionType === PostConditionType.Fungible) as FungiblePostCondition[]
  )?.map(
    (postCond: FungiblePostCondition) =>
      `${addressToString(postCond.assetInfo.address)}.${postCond.assetInfo.contractName.content}`,
  );

/**
 * processes data for contract call transaction
 * @param payload
 * @param stxAddress
 * @param network
 * @param stxPublicKey
 * @returns all promises for contract call tranastion
 */
export const createContractCallPromises = async (
  payload: any,
  stxAddress: string,
  network: StacksNetwork,
  stxPublicKey: string,
) => {
  const sponsored = payload?.sponsored;
  const { pendingTransactions } = await fetchStxPendingTxData(stxAddress, network);
  const { funcArgs, postConds } = extractFromPayload(payload);

  const ftContactAddresses = getFTInfoFromPostConditions(postConds);

  // Stacks isn't setup for testnet, so we default to mainnet
  const coinsMetaDataPromise: Coin[] | null = await getCoinsInfo('Mainnet', ftContactAddresses, 'USD');

  const tx = {
    publicKey: stxPublicKey,
    contractAddress: payload.contractAddress,
    contractName: payload.contractName,
    functionName: payload.functionName,
    functionArgs: funcArgs,
    network,
    nonce: undefined,
    postConditions: postConds,
    sponsored,
    postConditionMode: payload.postConditionMode,
  };

  const unSignedContractCall = await generateUnsignedContractCall(tx);
  const { fee } = unSignedContractCall.auth.spendingCondition;

  const checkForPostConditionMessage = payload?.postConditionMode === 2 && payload?.postConditions?.values.length <= 0;
  const showPostConditionMessage = !!checkForPostConditionMessage;

  const newNonce = getNewNonce(pendingTransactions, getNonce(unSignedContractCall));
  setNonce(unSignedContractCall, newNonce);

  const contractInterfacePromise = getContractInterface(payload.contractAddress, payload.contractName, network);

  return Promise.all([unSignedContractCall, contractInterfacePromise, coinsMetaDataPromise, showPostConditionMessage]);
};

/**
 * processes contract deploy transaction data
 * @param payload
 * @param network
 * @param stxPublicKey
 * @param feeMultipliers
 * @param walletAddress
 * @returns
 */
export const createDeployContractRequest = async (
  payload: any,
  network: StacksNetwork,
  stxPublicKey: string,
  feeMultipliers: FeesMultipliers,
  walletAddress: string,
) => {
  const { codeBody, contractName, postConditionMode } = payload;
  const { postConds } = extractFromPayload(payload);
  const postConditions = postConds;
  const sponsored = payload?.sponsored;
  const { pendingTransactions } = await fetchStxPendingTxData(walletAddress, network);
  const contractDeployTx = await generateContractDeployTransaction({
    codeBody,
    contractName,
    postConditions,
    postConditionMode,
    pendingTxs: pendingTransactions,
    publicKey: stxPublicKey,
    network,
    sponsored,
  });
  const { fee } = contractDeployTx.auth.spendingCondition;
  if (feeMultipliers) {
    contractDeployTx.setFee(fee * BigInt(feeMultipliers.otherTxMultiplier));
  }

  return {
    contractDeployTx,
    codeBody,
    contractName,
    sponsored,
  };
};
