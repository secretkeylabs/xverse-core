import {
  addressToString,
  deserializeCV,
  hexToCV,
  PostCondition,
  PostConditionType,
  Pc,
  PostConditionWire,
  FungiblePostConditionWire,
  BytesReader,
  StacksWireType,
  deserializeStacksWire,
  StacksTransactionWire,
  MultiSigHashMode,
  SingleSigHashMode,
  AddressHashMode,
} from '@stacks/transactions';
import BigNumber from 'bignumber.js';
import { btcToSats, getBtcFiatEquivalent, getStxFiatEquivalent, stxToMicrostacks } from '../../currency';
import { FungibleToken, PostConditionsOptions } from '../../types';

export function makeNonFungiblePostCondition(options: PostConditionsOptions): PostCondition {
  const { contractAddress, contractName, assetName, stxAddress, amount } = options;

  return Pc.principal(stxAddress)
    .willSendAsset()
    .nft(`${contractAddress}.${contractName}::${assetName}`, hexToCV(amount.toString()));
}

export function makeFungiblePostCondition(options: PostConditionsOptions): PostCondition {
  const { contractAddress, contractName, assetName, stxAddress, amount } = options;

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

export const extractFromPayload = (payload: any) => {
  const { functionArgs, postConditions } = payload;
  const funcArgs = functionArgs?.map((arg: string) => deserializeCV(hexStringToBuffer(arg)));

  const postConds = Array.isArray(postConditions)
    ? (postConditions?.map(
        (arg: string) =>
          deserializeStacksWire(
            new BytesReader(hexStringToBuffer(arg)),
            StacksWireType.PostCondition,
          ) as PostConditionWire,
      ) as PostConditionWire[])
    : [];

  return { funcArgs, postConds };
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

export const isMultiSig = (tx: StacksTransactionWire): boolean => {
  const hashMode = tx.auth.spendingCondition.hashMode as MultiSigHashMode | SingleSigHashMode;
  const multiSigHashModes = [
    AddressHashMode.P2SH,
    AddressHashMode.P2WSH,
    AddressHashMode.P2SHNonSequential,
    AddressHashMode.P2WSHNonSequential,
  ];

  return multiSigHashModes.includes(hashMode);
};
