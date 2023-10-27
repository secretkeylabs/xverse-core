import {
  AddressHashMode,
  BufferCV,
  bufferCV,
  ClarityType,
  ClarityValue,
  contractPrincipalCV,
  noneCV,
  someCV,
  standardPrincipalCV,
  tupleCV,
  uintCV,
} from '@stacks/transactions';
import BigNumber from 'bignumber.js';
import { address } from 'bitcoinjs-lib';
import BN from 'bn.js';
import { StacksNetwork, StacksTransaction, StxMempoolTransactionData } from '../types';
import { getNewNonce } from './helper';
import { estimateContractCallFees, generateUnsignedContractCall, getNonce, setFee, setNonce } from './stx';

function getAddressHashMode(btcAddress: string) {
  if (btcAddress.startsWith('bc1') || btcAddress.startsWith('tb1')) {
    const { data } = address.fromBech32(btcAddress);
    if (data.length === 32) {
      return AddressHashMode.SerializeP2WSH;
    } else {
      return AddressHashMode.SerializeP2WPKH;
    }
  } else {
    const { version } = address.fromBase58Check(btcAddress);
    switch (version) {
      case 0:
        return AddressHashMode.SerializeP2PKH;
      case 111:
        return AddressHashMode.SerializeP2PKH;
      case 5:
        return AddressHashMode.SerializeP2SH;
      case 196:
        return AddressHashMode.SerializeP2SH;
      default:
        throw new Error('Invalid pox address version');
    }
  }
}

export function decodeBtcAddress(btcAddress: string) {
  const hashMode = getAddressHashMode(btcAddress);
  if (btcAddress.startsWith('bc1') || btcAddress.startsWith('tb1')) {
    const { data } = address.fromBech32(btcAddress);
    return {
      hashMode,
      data,
    };
  } else {
    const { hash } = address.fromBase58Check(btcAddress);
    return {
      hashMode,
      data: hash,
    };
  }
}

declare type TupleData<T extends ClarityValue = ClarityValue> = {
  [key: string]: T;
};
interface TupleCV<T extends TupleData = TupleData> {
  type: ClarityType.Tuple;
  data: T;
}

export function addressToVersionHashbyteTupleCV(btcAddress: string): TupleCV<TupleData<BufferCV>> {
  const { hashMode, data } = decodeBtcAddress(btcAddress);
  const hashModeBuffer = bufferCV(new BN(hashMode, 10).toBuffer());
  const hashbytes: BufferCV = bufferCV(data);
  const addressTupleCV: TupleCV<TupleData<BufferCV>> = tupleCV({
    hashbytes,
    version: hashModeBuffer,
  });
  return addressTupleCV;
}

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
): Promise<StacksTransaction> {
  let unsignedTx;
  const poolRewardAddressTuple = addressToVersionHashbyteTupleCV(poolPoxAddress);
  const userRewardAddressTuple = addressToVersionHashbyteTupleCV(rewardAddress);

  try {
    unsignedTx = await generateUnsignedContractCall({
      publicKey,
      contractAddress: poolContractAddress,
      contractName: poolContractName,
      functionName: 'delegate-stx',
      functionArgs: [
        uintCV(amount.toString()),
        standardPrincipalCV(poolAddress),
        noneCV(),
        someCV(poolRewardAddressTuple),
        userRewardAddressTuple,
        noneCV(),
      ],
      network,
      postConditions: [],
    });

    const fee = await estimateContractCallFees(unsignedTx, network);
    setFee(unsignedTx, fee);

    const nonce = getNewNonce(pendingTxs, getNonce(unsignedTx));
    setNonce(unsignedTx, nonce + 1n);
    return await Promise.resolve(unsignedTx);
  } catch (err: any) {
    return Promise.reject(err.toString());
  }
}

export async function generateUnsignedAllowContractCallerTransaction(
  poolAddress: string,
  poolContractName: string,
  pendingTxs: StxMempoolTransactionData[],
  publicKey: string,
  network: StacksNetwork,
  poxContractAddress: string,
  poxContractName: string,
): Promise<StacksTransaction> {
  let unsignedTx;
  try {
    unsignedTx = await generateUnsignedContractCall({
      publicKey,
      contractAddress: poxContractAddress,
      contractName: poxContractName,
      functionName: 'allow-contract-caller',
      functionArgs: [contractPrincipalCV(poolAddress, poolContractName), noneCV()],
      network,
      postConditions: [],
    });
    const fee = await estimateContractCallFees(unsignedTx, network);
    setFee(unsignedTx, fee);

    const nonce = getNewNonce(pendingTxs, getNonce(unsignedTx));
    setNonce(unsignedTx, nonce);

    return await Promise.resolve(unsignedTx);
  } catch (err: any) {
    return Promise.reject(err.toString());
  }
}

export async function generateUnsignedRevokeTransaction(
  pendingTxs: StxMempoolTransactionData[],
  publicKey: string,
  network: StacksNetwork,
  poxContractAddress: string,
  poxContractName: string,
): Promise<StacksTransaction> {
  let unsignedTx;
  try {
    unsignedTx = await generateUnsignedContractCall({
      publicKey,
      contractAddress: poxContractAddress,
      contractName: poxContractName,
      functionName: 'revoke-delegate-stx',
      functionArgs: [],
      network,
      postConditions: [],
    });
    const fee = await estimateContractCallFees(unsignedTx, network);
    setFee(unsignedTx, fee);

    const nonce = getNewNonce(pendingTxs, getNonce(unsignedTx));
    setNonce(unsignedTx, nonce);

    return await Promise.resolve(unsignedTx);
  } catch (err: any) {
    return Promise.reject(err.toString());
  }
}
