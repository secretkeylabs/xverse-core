import * as bitcoin from 'bitcoinjs-lib';
import * as btc from '@scure/btc-signer';
import * as bip39 from 'bip39';
import * as secp256k1 from '@noble/secp256k1';
import { hex } from '@scure/base';
import { encode } from 'varuint-bitcoin';
import { getAddressInfo, AddressType } from 'bitcoin-address-validation';
import { BitcoinNetwork, getBtcNetwork } from '../transactions/btcNetwork';
import { getSigningDerivationPath } from '../transactions/psbt';
import { Account, NetworkType } from '../types';

/**
 *
 * @param message
 * @returns Bip322 Message Hash
 *
 */
export function bip0322Hash(message: string) {
  const { sha256 } = bitcoin.crypto;
  const tag = 'BIP0322-signed-message';
  const tagHash = sha256(Buffer.from(tag));
  const result = sha256(Buffer.concat([tagHash, tagHash, Buffer.from(message)]));
  return result.toString('hex');
}

const toUint8 = (buf: Buffer): Uint8Array => {
  const uin = new Uint8Array(buf.length);
  return uin.map((a, index, arr) => (arr[index] = buf[index]));
};

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
      if (typeof privateKey !== 'string') {
        const pk = bitcoin.ECPair.fromPrivateKey(privateKey).publicKey;
        return toUint8(pk);
      }
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
      return btc.p2tr(publicKey, undefined, network).script;
    }
    case AddressType.p2wpkh: {
      return btc.p2wpkh(publicKey, network).script;
    }
    case AddressType.p2sh: {
      return btc.p2wpkh(publicKey, network).script;
    }
    default: {
      throw new Error('Unsupported Address Type');
    }
  }
};

export const signBip322Message = async (options: SignBip322MessageOptions) => {
  const { accounts, message, network, seedPhrase, signatureAddress } = options;
  if (!accounts || accounts.length === 0) {
    throw new Error('a List of Accounts are required to derive the correct Private Key');
  }
  const { type } = getAddressInfo(signatureAddress);
  const seed = await bip39.mnemonicToSeed(seedPhrase);
  const master = bitcoin.bip32.fromSeed(seed);
  const signingDerivationPath = getSigningDerivationPath(accounts, signatureAddress, network);
  const child = master.derivePath(signingDerivationPath);
  if (child.privateKey) {
    const privateKey = child.privateKey?.toString('hex');
    const publicKey = getSigningPk(type, privateKey);
    const txScript = getSignerScript(type, publicKey, getBtcNetwork(network));
    const inputHash = hex.decode(
      '0000000000000000000000000000000000000000000000000000000000000000'
    );
    const txVersion = 0;
    const inputIndex = 4294967295;
    const sequence = 0;
    const scriptSig = btc.Script.encode(['OP_0', hex.decode(bip0322Hash(message))]);
    // tx-to-spend
    const txToSpend = new btc.Transaction({
      allowUnknowOutput: true,
      version: txVersion,
    });
    txToSpend.addOutput({
      amount: BigInt(0),
      script: txScript,
    });
    txToSpend.addInput({
      txid: inputHash,
      index: inputIndex,
      sequence,
      finalScriptSig: scriptSig,
    });
    // tx-to-sign
    const txToSign = new btc.Transaction({
      allowUnknowOutput: true,
      version: txVersion,
    });
    txToSign.addInput({
      txid: txToSpend.id,
      index: 0,
      sequence,
      tapInternalKey: type === AddressType.p2tr ? publicKey : undefined,
      witnessUtxo: {
        script: txScript,
        amount: BigInt(0),
      },
    });
    txToSign.addOutput({ script: btc.Script.encode(['RETURN']), amount: BigInt(0) });
    txToSign.sign(hex.decode(privateKey));
    txToSign.finalize();

    // formulate-signature
    const firstInput = txToSign.getInput(0);
    if (firstInput.finalScriptWitness?.length) {
      const len = encode(firstInput.finalScriptWitness?.length);
      const result = Buffer.concat([
        len,
        ...firstInput.finalScriptWitness.map((w) => encodeVarString(w)),
      ]);
      return result.toString('base64');
    } else {
      return '';
    }
  } else {
    throw new Error("Couldn't sign Message");
  }
};
