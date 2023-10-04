import * as secp256k1 from '@noble/secp256k1';
import { hex } from '@scure/base';
import * as btc from '@scure/btc-signer';
import * as bip39 from 'bip39';
import { AddressType, getAddressInfo } from 'bitcoin-address-validation';
import { crypto } from 'bitcoinjs-lib';
import { signAsync } from 'bitcoinjs-message';
import { encode } from 'varuint-bitcoin';
import { BitcoinNetwork, getBtcNetwork } from '../transactions/btcNetwork';
import { getSigningDerivationPath } from '../transactions/psbt';
import { Account, NetworkType } from '../types';
import { bip32 } from '../utils/bip32';

/**
 *
 * @param message
 * @returns Bip322 Message Hash
 *
 */
export function bip0322Hash(message: string) {
  const { sha256 } = crypto;
  const tag = 'BIP0322-signed-message';
  const tagHash = sha256(Buffer.from(tag));
  const result = sha256(Buffer.concat([tagHash, tagHash, Buffer.from(message)]));
  return result.toString('hex');
}

function encodeVarString(b: Uint8Array) {
  return Buffer.concat([encode(b.byteLength), b]);
}

interface SignBip322MessageOptions {
  accounts: Account[];
  signatureAddress: string;
  message: string;
  network: NetworkType;
  seedPhrase: string;
}

const getSigningPk = (type: AddressType, privateKey: string | Buffer) => {
  switch (type) {
    case AddressType.p2tr: {
      return secp256k1.schnorr.getPublicKey(privateKey);
    }
    case AddressType.p2sh: {
      return secp256k1.getPublicKey(privateKey, true);
    }
    case AddressType.p2wpkh: {
      return secp256k1.getPublicKey(privateKey, true);
    }
    default: {
      throw new Error('Unsupported Address Type');
    }
  }
};

const getSignerScript = (type: AddressType, publicKey: Uint8Array, network: BitcoinNetwork) => {
  switch (type) {
    case AddressType.p2tr: {
      return btc.p2tr(publicKey, undefined, network);
    }
    case AddressType.p2wpkh: {
      return btc.p2wpkh(publicKey, network);
    }
    case AddressType.p2sh: {
      const p2wph = btc.p2wpkh(publicKey, network);
      return btc.p2sh(p2wph, network);
    }
    default: {
      throw new Error('Unsupported Address Type');
    }
  }
};

export const signBip322Message = async ({
  accounts,
  message,
  network,
  seedPhrase,
  signatureAddress,
}: SignBip322MessageOptions) => {
  if (!accounts?.length) {
    throw new Error('a List of Accounts are required to derive the correct Private Key');
  }

  const { type } = getAddressInfo(signatureAddress);
  const seed = await bip39.mnemonicToSeed(seedPhrase);
  const master = bip32.fromSeed(seed);
  const signingDerivationPath = getSigningDerivationPath(accounts, signatureAddress, network);
  const child = master.derivePath(signingDerivationPath);
  if (child.privateKey) {
    if (type === AddressType.p2sh) {
      return (await signAsync(message, child.privateKey, false, { segwitType: 'p2sh(p2wpkh)' })).toString('base64');
    }
    const privateKey = child.privateKey?.toString('hex');
    const publicKey = getSigningPk(type, privateKey);
    const txScript = getSignerScript(type, publicKey, getBtcNetwork(network));
    const inputHash = hex.decode('0000000000000000000000000000000000000000000000000000000000000000');
    const txVersion = 0;
    const inputIndex = 4294967295;
    const sequence = 0;
    const scriptSig = btc.Script.encode(['OP_0', hex.decode(bip0322Hash(message))]);
    // tx-to-spend
    const txToSpend = new btc.Transaction({
      allowUnknownOutputs: true,
      version: txVersion,
    });
    txToSpend.addOutput({
      amount: BigInt(0),
      script: txScript.script,
    });
    txToSpend.addInput({
      txid: inputHash,
      index: inputIndex,
      sequence,
      finalScriptSig: scriptSig,
    });
    // tx-to-sign
    const txToSign = new btc.Transaction({
      allowUnknownOutputs: true,
      version: txVersion,
    });
    txToSign.addInput({
      txid: txToSpend.id,
      index: 0,
      sequence,
      tapInternalKey: type === AddressType.p2tr ? publicKey : undefined,
      witnessUtxo: {
        script: txScript.script,
        amount: BigInt(0),
      },
      redeemScript: AddressType.p2sh ? txScript.redeemScript : Buffer.alloc(0),
    });
    txToSign.addOutput({ script: btc.Script.encode(['RETURN']), amount: BigInt(0) });
    txToSign.sign(hex.decode(privateKey));
    txToSign.finalize();

    // formulate-signature
    const firstInput = txToSign.getInput(0);
    if (firstInput.finalScriptWitness?.length) {
      const len = encode(firstInput.finalScriptWitness?.length);
      const result = Buffer.concat([len, ...firstInput.finalScriptWitness.map((w) => encodeVarString(w))]);
      return result.toString('base64');
    } else {
      return '';
    }
  } else {
    throw new Error("Couldn't sign Message");
  }
};
