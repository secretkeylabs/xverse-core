/*

name-renewal

https://github.com/hirosystems/btc-us-website/blob/main/src/lib/nameservice.js

*/

import {
  BufferCV,
  bufferCV,
  bufferCVFromString,
  ClarityType,
  ClarityValue,
  contractPrincipalCV,
  noneCV,
  someCV,
  standardPrincipalCV,
  tupleCV,
  uintCV,
  hash160,
} from '@stacks/transactions';
import { StacksNetwork, StacksTransaction, StxMempoolTransactionData } from 'types';
import { getNewNonce } from './helper';
import {
  estimateContractCallFees,
  generateUnsignedContractCall,
  getNonce,
  setFee,
  setNonce,
} from './stx';
import { randomBytes } from "@stacks/encryption";
import { BNS_CONTRACT_ADDRESS, BNS_TESTNET_CONTRACT_ADDRESS, BNS_CONTRACT_NAME, BNS_NAME_COST } from '../constant';
import { parseZoneFile, makeZoneFile } from '@secretkeylabs/bns-zonefile';
import { ZoneFileObject } from '@secretkeylabs/bns-zonefile';

export function getZoneFileHash(zoneFileObj: ZoneFileObject): Buffer {
	return hash160(Buffer.from(makeZoneFile(zoneFileObj)));
}

export function getZoneFileStub(namespace: string, name: string, url: string | null = null): ZoneFileObject {
  const zoneFileObj: ZoneFileObject = {$origin: `${name}.${namespace}`, $ttl: 3600};
  if (url) zoneFileObj.uri = [{name: "_http._tcp", priority: 10, weight: 1, target: url}];
  return zoneFileObj;
}

export function generateSalt(): Buffer {
  return Buffer.from(randomBytes(20));
}

export function generatePreorderNameHash(namespace: string, name: string, salt: Buffer): Buffer {
	return hash160(Buffer.concat([Buffer.from(name + '.' + namespace), salt]));
}

export async function generateUnsignedBnsNamePreorderTransaction(
  namespace: string,
  name: string,
  salt: Buffer,
  pendingTxs: StxMempoolTransactionData[],
  publicKey: string,
  network: StacksNetwork
): Promise<StacksTransaction> {
  var unsignedTx;
  try {
    const contractAddress = network.isMainnet() ? BNS_CONTRACT_ADDRESS : BNS_TESTNET_CONTRACT_ADDRESS;
    const hash = generatePreorderNameHash(namespace, name, salt);

    unsignedTx = await generateUnsignedContractCall({
      publicKey,
      contractAddress: contractAddress,
      contractName: BNS_CONTRACT_NAME,
      functionName: 'name-preorder',
      functionArgs: [
        bufferCV(hash),
        uintCV(BNS_NAME_COST)
      ],
      network,
      postConditions: [],
    });
    const fee = await estimateContractCallFees(unsignedTx, network);
    setFee(unsignedTx, fee);

    const nonce = getNewNonce(pendingTxs, getNonce(unsignedTx));
    setNonce(unsignedTx, nonce);

    return Promise.resolve(unsignedTx);
  } catch (err: any) {
    return Promise.reject(err.toString());
  }
}


export async function generateUnsignedBnsNameRegisterTransaction(
  namespace: string,
  name: string,
  salt: Buffer,
  zoneFileObj: ZoneFileObject,
  pendingTxs: StxMempoolTransactionData[],
  publicKey: string,
  network: StacksNetwork
): Promise<StacksTransaction> {
  var unsignedTx;
  try {
    const zoneFileHash = getZoneFileHash(zoneFileObj);
    const contractAddress = network.isMainnet() ? BNS_CONTRACT_ADDRESS : BNS_TESTNET_CONTRACT_ADDRESS;
    unsignedTx = await generateUnsignedContractCall({
      publicKey,
      contractAddress: contractAddress,
      contractName: BNS_CONTRACT_NAME,
      functionName: 'name-register',
      functionArgs: [
        bufferCVFromString(namespace),
        bufferCVFromString(name),
        bufferCV(salt),
        bufferCV(zoneFileHash)
      ],
      network,
      postConditions: [],
    });
    const fee = await estimateContractCallFees(unsignedTx, network);
    setFee(unsignedTx, fee);

    const nonce = getNewNonce(pendingTxs, getNonce(unsignedTx));
    setNonce(unsignedTx, nonce);

    return Promise.resolve(unsignedTx);
  } catch (err: any) {
    return Promise.reject(err.toString());
  }
}

export async function generateUnsignedBnsNameUpdateTransaction(
  namespace: string,
  name: string,
  zoneFileObj: ZoneFileObject,
  pendingTxs: StxMempoolTransactionData[],
  publicKey: string,
  network: StacksNetwork
): Promise<StacksTransaction> {
  var unsignedTx;
  try {
    const zoneFileHash = getZoneFileHash(zoneFileObj);
    const contractAddress = network.isMainnet() ? BNS_CONTRACT_ADDRESS : BNS_TESTNET_CONTRACT_ADDRESS;
    unsignedTx = await generateUnsignedContractCall({
      publicKey,
      contractAddress: contractAddress,
      contractName: BNS_CONTRACT_NAME,
      functionName: 'name-update',
      functionArgs: [
        bufferCVFromString(namespace),
        bufferCVFromString(name),
        bufferCV(zoneFileHash)
      ],
      network,
      postConditions: [],
    });
    const fee = await estimateContractCallFees(unsignedTx, network);
    setFee(unsignedTx, fee);

    const nonce = getNewNonce(pendingTxs, getNonce(unsignedTx));
    setNonce(unsignedTx, nonce);

    return Promise.resolve(unsignedTx);
  } catch (err: any) {
    return Promise.reject(err.toString());
  }
}

export async function generateUnsignedBnsNameTransferTransaction(
  namespace: string,
  name: string,
  newOwnerAddress: string,
  pendingTxs: StxMempoolTransactionData[],
  publicKey: string,
  network: StacksNetwork
): Promise<StacksTransaction> {
  var unsignedTx;
  try {
    const contractAddress = network.isMainnet() ? BNS_CONTRACT_ADDRESS : BNS_TESTNET_CONTRACT_ADDRESS;
    unsignedTx = await generateUnsignedContractCall({
      publicKey,
      contractAddress: contractAddress,
      contractName: BNS_CONTRACT_NAME,
      functionName: 'name-transfer',
      functionArgs: [
        bufferCVFromString(namespace),
        bufferCVFromString(name),
        standardPrincipalCV(newOwnerAddress),
        noneCV()
      ],
      network,
      postConditions: [],
    });
    const fee = await estimateContractCallFees(unsignedTx, network);
    setFee(unsignedTx, fee);

    //const nonce = getNewNonce(pendingTxs, getNonce(unsignedTx));
    let nonce = 9n;
    
    setNonce(unsignedTx, nonce);

    return Promise.resolve(unsignedTx);
  } catch (err: any) {
    return Promise.reject(err.toString());
  }
}