/*

1. get bns names(address, network) returns Array
2. get zone file json for bns name() returns JSON
3. can name be registered
4. get name price
5. can receive name
6. is name in grace period
7. is name lease expired

*/

import axios from 'axios';
import { BNS_CONTRACT_ADDRESS, BNS_CONTRACT_NAME } from '../constant';
import { StacksNetwork } from '@stacks/network';
import { BufferCV, bufferCVFromString, callReadOnlyFunction, ClarityType, cvToHex, cvToString, estimateTransfer, hexToCV, makeUnsignedSTXTokenTransfer, PrincipalCV, ResponseCV, SomeCV, standardPrincipalCV, TupleCV, tupleCV, UIntCV, BooleanCV, cvToValue } from '@stacks/transactions';
import { BnsNameDataResponse, BnsNamesResponse } from '../types/api/stacks/assets';
import { parseZoneFile } from '@secretkeylabs/bns-zonefile';
import { ZoneFileObject } from '@secretkeylabs/bns-zonefile';

// TODO: moved from stacks.ts - breaks xverse repo as well
export async function getBnsNamesForOwner(
  stxAddress: string,
  network: StacksNetwork
  ): Promise<BnsNamesResponse> {
  const apiUrl = `${network.coreApiUrl}/v1/addresses/stacks/${stxAddress}`;
  return axios
    .get<BnsNamesResponse>(apiUrl, {
      timeout: 30000,
    })
    .then((response: any) => {
      return response?.data?.names;
    })
    .catch((error: any) => {
      return undefined;
    });
}

export async function getZoneFileForBnsName(
  bnsName: string,
  network: StacksNetwork
  ): Promise<ZoneFileObject | undefined> {
  const apiUrl = `${network.coreApiUrl}/v1/names/${bnsName}/zonefile`;
  // do we need a response type here?
  return axios
    .get<ZoneFileObject>(apiUrl, {
      timeout: 30000,
    })
    .then((response: any) => {
      return parseZoneFile(response?.data?.zonefile);
    })
    .catch((error: any) => {
      return undefined;
    });
}

export async function getBnsNameData(
  bnsName: string,
  network: StacksNetwork
  ): Promise<BnsNameDataResponse> {
  const apiUrl = `${network.coreApiUrl}/v1/names/${bnsName}`;
  return axios
    .get<BnsNameDataResponse>(apiUrl, {
      timeout: 30000,
    })
    .then((response: any) => {
      return response?.data;
    })
    .catch((error: any) => {
      return undefined;
    });
}

export async function getOwnerForBnsName(
  bnsName: string,
  stxAddress: string,
  network: StacksNetwork
  ): Promise<string | null> {
  try {
    if (bnsName.includes('.')) {
      const ns = bnsName.split('.');
      const name_ = ns[0];
      const namespace_ = ns[1] ?? '';

      const contractAddress = BNS_CONTRACT_ADDRESS;
      const contractName = BNS_CONTRACT_NAME;
      const functionName = 'name-resolve';
      const senderAddress = stxAddress;
      const namespace: BufferCV = bufferCVFromString(namespace_);
      const name: BufferCV = bufferCVFromString(name_);

      const options = {
        contractAddress,
        contractName,
        functionName,
        functionArgs: [namespace, name],
        network,
        senderAddress,
      };

      const responseCV = await callReadOnlyFunction(options);

      if (responseCV.type === ClarityType.ResponseErr) {
        return null;
      } else {
        const response = responseCV as ResponseCV;
        const tupleCV = response.value as TupleCV;
        const owner: PrincipalCV = tupleCV.data['owner'] as PrincipalCV;
        return cvToString(owner);
      }
    } else return null;
  } catch (err) {
    return null;
  }
}

// TODO: is returning null the correct way to handle errors?
export async function getCanBnsNameBeRegistered(
  bnsName: string,
  stxAddress: string,
  network: StacksNetwork
  ): Promise<boolean | null> {
  try {
    if (bnsName.includes('.')) {
      const ns = bnsName.split('.');
      const name_ = ns[0];
      const namespace_ = ns[1] ?? '';

      const contractAddress = BNS_CONTRACT_ADDRESS;
      const contractName = BNS_CONTRACT_NAME;
      const functionName = 'can-name-be-registered';
      const senderAddress = stxAddress;
      const namespace: BufferCV = bufferCVFromString(namespace_);
      const name: BufferCV = bufferCVFromString(name_);

      const options = {
        contractAddress,
        contractName,
        functionName,
        functionArgs: [namespace, name],
        network,
        senderAddress,
      };

      const responseCV = await callReadOnlyFunction(options);

      if (responseCV.type === ClarityType.ResponseErr) {
        return false;
      } else {
        const response = responseCV as ResponseCV;
        const boolCV = response.value as BooleanCV;
        return cvToValue(boolCV);
      }
    } else return null;
  } catch (err) {
    return null;
  }
}

export async function getCanReceiveBnsName(
  stxAddress: string,
  network: StacksNetwork
  ): Promise<boolean | null> {
  try {
    const contractAddress = BNS_CONTRACT_ADDRESS;
    const contractName = BNS_CONTRACT_NAME;
    const functionName = 'can-receive-name';
    const senderAddress = stxAddress;
    const address: PrincipalCV = standardPrincipalCV(stxAddress);

    const options = {
      contractAddress,
      contractName,
      functionName,
      functionArgs: [address],
      network,
      senderAddress,
    };

    const responseCV = await callReadOnlyFunction(options);

    if (responseCV.type === ClarityType.ResponseErr) {
      return false;
    } else {
      const response = responseCV as ResponseCV;
      const boolCV = response.value as BooleanCV;
      return cvToValue(boolCV);
    }
  } catch (err) {
    return null;
  }
}