import { StacksNetwork } from '@stacks/network';
import {
  addressToString,
  Authorization,
  deserializeCV,
  deserializePostConditionWire,
  hexToCV,
  PostCondition,
  PostConditionType,
  setNonce,
  Pc,
  PostConditionWire,
  FungiblePostConditionWire,
} from '@stacks/transactions';
import BigNumber from 'bignumber.js';
import { fetchStxPendingTxData, getContractInterface, getXverseApiClient } from '../../api';
import { btcToSats, getBtcFiatEquivalent, getStxFiatEquivalent, stxToMicrostacks } from '../../currency';
import { Coin, FungibleToken, PostConditionsOptions } from '../../types';
import { generateUnsignedContractCallTx, generateUnsignedTx } from './stx';
import { getNewNonce, getNonce } from '.';
import { ContractDeployPayload, ContractCallPayload, TransactionTypes } from '@stacks/connect';
import { hexToBytes } from '@noble/hashes/utils';

export function makeNonFungiblePostCondition(options: PostConditionsOptions): PostCondition {
  const { contractAddress, contractName, assetName, stxAddress, amount } = options;

  // const assetInfo: AssetWire = createAsset(contractAddress, contractName, assetName);

  return Pc.principal(stxAddress)
    .willSendAsset()
    .nft(`${contractAddress}.${contractName}::${assetName}`, hexToCV(amount.toString()));

  // return makeStandardNonFungiblePostCondition(
  //   stxAddress,
  //   NonFungibleConditionCode.Sends,
  //   assetInfo,
  //   hexToCV(amount.toString()),
  // );
}

export function makeFungiblePostCondition(options: PostConditionsOptions): PostCondition {
  const { contractAddress, contractName, assetName, stxAddress, amount } = options;

  // const assetInfo = createAsset(contractAddress, contractName, assetName);
  return Pc.principal(stxAddress).willSendEq(amount).ft(`${contractAddress}.${contractName}`, assetName);
}

export function getFiatEquivalent(
  value: number, // TODO - change to BigNumber
  currencyType: string, // TODO - should introduce typing here
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
      return getStxFiatEquivalent(stxToMicrostacks(new BigNumber(value)), stxBtcRate, btcFiatRate)
        .toFixed(2)
        .toString();
    case 'BTC':
      return getBtcFiatEquivalent(btcToSats(new BigNumber(value)), btcFiatRate)
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
  if (typeof hexString !== 'string') return hexString;
  return hexString.startsWith('0x') ? hexString.replace('0x', '') : hexString;
}

export function hexStringToBuffer(hex: string): Buffer {
  return Buffer.from(removeHexPrefix(hex), 'hex');
}

function isContractDeployPayload(
  payload: ContractCallPayload | ContractDeployPayload,
): payload is ContractDeployPayload {
  return (payload as ContractDeployPayload).codeBody !== undefined;
}

function isContractCallPayload(payload: ContractCallPayload | ContractDeployPayload): payload is ContractCallPayload {
  return (payload as ContractCallPayload).functionName !== undefined;
}

export const extractFromPayload = (payload: ContractCallPayload | ContractDeployPayload) => {
  if (isContractCallPayload(payload)) {
    const { functionArgs, postConditions } = payload;
    const funcArgs = functionArgs.map((arg: string) => deserializeCV(hexToBytes(arg)));

    return { funcArgs, postConditions: postConditions || [] };
  } else if (isContractDeployPayload(payload)) {
    return { funcArgs: [], postConditions: [] };
  } else {
    return { funcArgs: [], postConditions: [] };
  }
};

export const getFTInfoFromPostConditions = (postConds: PostConditionWire[]) =>
  (
    postConds?.filter(
      (postCond) => postCond.conditionType === PostConditionType.Fungible,
    ) as FungiblePostConditionWire[]
  )?.map(
    (postCond: FungiblePostConditionWire) =>
      `${addressToString(postCond.asset.address)}.${postCond.asset.contractName.content}`,
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

  const ftContactAddresses = getFTInfoFromPostConditions(payload.postConditions);

  // Stacks isn't setup for testnet, so we default to mainnet
  const coinsMetaDataPromise: Coin[] | null = await getXverseApiClient('Mainnet').getSip10Tokens(
    ftContactAddresses,
    'USD',
  );

  const tx = {
    publicKey: stxPublicKey,
    contractAddress: payload.contractAddress,
    contractName: payload.contractName,
    functionName: payload.functionName,
    functionArgs: payload.functionArgs,
    network,
    nonce: undefined,
    postConditions: payload.postConditions,
    sponsored,
    postConditionMode: payload.postConditionMode,
  };

  const unSignedContractCall = await generateUnsignedContractCallTx({
    payload: {
      txType: TransactionTypes.ContractCall,
      ...tx,
    },
    fee: 0n,
    nonce: 0n,
    publicKey: stxPublicKey,
  });

  const checkForPostConditionMessage = payload?.postConditionMode === 2 && payload?.postConditions?.length <= 0;
  const showPostConditionMessage = !!checkForPostConditionMessage;

  const newNonce = getNewNonce(pendingTransactions, getNonce(unSignedContractCall));
  setNonce(unSignedContractCall.auth, newNonce);

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
  auth?: Authorization,
) => {
  const { codeBody, contractName, postConditionMode } = payload;
  const sponsored = payload?.sponsored;

  const contractDeployTx = await generateUnsignedTx({
    payload: {
      txType: TransactionTypes.ContractDeploy,
      codeBody,
      contractName,
      postConditions: payload.postConditions,
      postConditionMode,
      publicKey: stxPublicKey,
      network,
      sponsored,
      fee: 0,
    },
    publicKey: stxPublicKey,
  });
  console.log(contractDeployTx);
  if (auth) {
    contractDeployTx.auth = auth;
  }

  return {
    contractDeployTx,
    codeBody,
    contractName,
    sponsored,
  };
};
