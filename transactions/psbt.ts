import { NetworkType, Account } from '../types';
import {
  getBitcoinDerivationPath,
  getTaprootDerivationPath,
  getSegwitDerivationPath,
} from '../wallet/utils/btc';
import * as btc from '@scure/btc-signer';
import { hex, base64 } from '@scure/base';
import { getAddressInfo } from 'bitcoin-address-validation';
import * as bip39 from 'bip39';
import { bip32 } from 'bitcoinjs-lib';
import * as secp256k1 from '@noble/secp256k1';

import { getBtcNetwork } from './btcNetwork';

export interface InputToSign {
  address: string;
  signingIndexes: Array<number>;
  sigHash?: number;
}

export interface PrivateKeyMap {
  [address: string]: string;
}

export function getSigningDerivationPath(
  accounts: Array<Account>,
  address: string,
  network: NetworkType
): string {
  const { type } = getAddressInfo(address);

  if (accounts.length <= 0) {
    throw new Error('Invalid accounts list');
  }

  var path = '';

  accounts.forEach((account, index) => {
    if (type === 'p2sh') {
      if (account.btcAddress === address) {
        path = getBitcoinDerivationPath({ index: BigInt(index), network });
      }
    } else if (type === 'p2wpkh') {
      if (account.btcAddress === address) {
        path = getSegwitDerivationPath({ index: BigInt(index), network });
      }
    } else if (type === 'p2tr') {
      if (account.ordinalsAddress === address) {
        path = getTaprootDerivationPath({ index: BigInt(index), network });
      }
    } else {
      throw new Error('Unsupported address type');
    }
  });

  if (path.length <= 0) {
    throw new Error('Address not found');
  }

  return path;
}

export async function signPsbt(
  seedPhrase: string,
  accounts: Array<Account>,
  inputsToSign: Array<InputToSign>,
  psbtBase64: string,
  finalize: boolean = false,
  network?: NetworkType
): Promise<string> {
  if (psbtBase64.length <= 0) {
    throw new Error('Invalid transaction');
  }

  // decode raw tx
  var psbt: btc.Transaction;
  try {
    psbt = btc.Transaction.fromPSBT(base64.decode(psbtBase64));
  } catch (error) {
    throw new Error('Error decoding transaction');
  }

  const seed = await bip39.mnemonicToSeed(seedPhrase);
  const master = bip32.fromSeed(seed);

  try {
    // Get signing derivation path
    const networkType = network ?? 'Mainnet';

    var addressPrivateKeyMap: PrivateKeyMap = {};

    inputsToSign.forEach((inputToSign) => {
      const address: string = inputToSign.address;
      if (!(address in addressPrivateKeyMap)) {
        const signingDerivationPath = getSigningDerivationPath(accounts, address, networkType);
        const child = master.derivePath(signingDerivationPath);
        const privateKey = child.privateKey!.toString('hex');
        addressPrivateKeyMap[address] = privateKey;
      }
    });

    // Sign inputs at indexes
    inputsToSign.forEach((inputToSign) => {
      const privateKey = addressPrivateKeyMap[inputToSign.address];
      inputToSign.signingIndexes.forEach((signingIndex) => {
        if (inputToSign.sigHash) {
          psbt.signIdx(hex.decode(privateKey), signingIndex, [inputToSign.sigHash]);
        } else {
          psbt.signIdx(hex.decode(privateKey), signingIndex);
        }
      });
    });

    if (finalize) {
      psbt.finalize();
    }
  } catch (error) {
    throw new Error(`Error signing PSBT ${error.toString()}`);
  }

  const signedPsbt = psbt.toPSBT(0);
  return base64.encode(signedPsbt);
}

export function psbtBase64ToHex(psbtBase64: string): string {
  if (psbtBase64.length <= 0) {
    throw new Error('Invalid transaction');
  }

  // decode raw tx
  var psbt: btc.Transaction;
  try {
    psbt = btc.Transaction.fromPSBT(base64.decode(psbtBase64));
  } catch (error) {
    throw new Error('Error decoding transaction');
  }

  return psbt.hex;
}

export async function signBip340(
  seedPhrase: string,
  accounts: Array<Account>,
  address: string,
  messageHash: string,
  network?: NetworkType
): Promise<string> {
  const networkType = network ?? 'Mainnet';

  const seed = await bip39.mnemonicToSeed(seedPhrase);
  const master = bip32.fromSeed(seed);
  const signingDerivationPath = getSigningDerivationPath(accounts, address, networkType);
  const child = master.derivePath(signingDerivationPath);
  const privateKey = child.privateKey!.toString('hex');

  const signature = await secp256k1.schnorr.sign(hex.decode(messageHash), hex.decode(privateKey));

  return hex.encode(signature);
}

export interface PSBTInput {
  txid: string;
  index: number;
  value: bigint;
  userSigns: boolean;
  sighashType: number;
}

export interface PSBTOutput {
  address: string;
  amount: bigint;
  userReceives: boolean;
}

export interface ParsedPSBT {
  inputs: Array<PSBTInput>;
  outputs: Array<PSBTOutput>;
  netAmount: bigint;
  fees: bigint;
}

export function parsePsbt(
  account: Account,
  inputsToSign: Array<InputToSign>,
  psbtBase64: string,
  network?: NetworkType
): ParsedPSBT {
  const btcNetwork = getBtcNetwork(network ?? 'Mainnet');

  if (psbtBase64.length <= 0) {
    throw new Error('Invalid transaction');
  }

  // decode raw tx
  var psbt: btc.Transaction;
  try {
    psbt = btc.Transaction.fromPSBT(base64.decode(psbtBase64));
  } catch (error) {
    throw new Error('Error decoding transaction');
  }

  const inputs: Array<PSBTInput> = [];
  // @ts-expect-error:
  psbt.inputs.forEach((input) => {
    var value = 0n;
    if (!input.witnessUtxo) {
      value = input.nonWitnessUtxo.outputs[input.index].amount;
    } else {
      value = input.witnessUtxo.amount;
    }

    inputs.push({
      txid: Buffer.from(input.txid).toString('hex'),
      index: input.index,
      value: value,
      sighashType: input.sighashType,
      userSigns: false,
    });
  });

  inputsToSign.forEach((inputToSign) => {
    inputToSign.signingIndexes.forEach((index) => {
      if (inputs.length >= index) {
        inputs[index].userSigns = true;
      } else {
        throw new Error('Signing index out of range');
      }
    });
  });

  const outputs: Array<PSBTOutput> = [];
  // @ts-expect-error:
  psbt.outputs.forEach((output) => {
    const outputScript = btc.OutScript.decode(output.script);

    var outputAddress = '';

    if (outputScript.type === 'ms' || outputScript.type === 'tr') {
      // @ts-expect-error:
      outputAddress = btc.Address(btcNetwork).encode({
        type: outputScript.type,
        // @ts-expect-error:
        pubkey: outputScript.pubkey,
      });
    } else {
      // @ts-expect-error:
      outputAddress = btc.Address(btcNetwork).encode({
        type: outputScript.type,
        // @ts-expect-error:
        hash: outputScript.hash,
      });
    }

    var userReceives = false;

    if (account.btcAddress === outputAddress || account.ordinalsAddress === outputAddress) {
      userReceives = true;
    }

    outputs.push({
      address: outputAddress,
      amount: output.amount,
      userReceives,
    });
  });

  var initialValue: bigint = 0n;

  const totalInputs = inputs.reduce((accumulator: bigint, input) => {
    return accumulator + input.value;
  }, initialValue);

  const totalUserSpend = inputs.reduce((accumulator: bigint, input) => {
    if (input.userSigns) {
      return accumulator + input.value;
    } else {
      return accumulator;
    }
  }, initialValue);

  const totalOutputs = outputs.reduce((accumulator: bigint, output) => {
    return accumulator + output.amount;
  }, initialValue);

  const totalUserReceive = outputs.reduce((accumulator: bigint, output) => {
    if (output.userReceives) {
      return accumulator + output.amount;
    } else {
      return accumulator;
    }
  }, initialValue);

  return {
    inputs,
    outputs,
    netAmount: totalUserReceive - totalUserSpend,
    fees: totalInputs - totalOutputs,
  };
}
