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

export enum MessageSigningProtocols {
  ECDSA = 'ECDSA',
  BIP322 = 'BIP322',
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

export const signMessageECDSA = async (message: string, privateKey: Buffer) => {
  // to-do support signing with p2wpkh
  const signature = await signAsync(message, privateKey, false, { segwitType: 'p2sh(p2wpkh)' });
  return {
    signature: signature.toString('base64'),
    publicKey: hex.encode(secp256k1.getPublicKey(privateKey, true)),
    protocol: MessageSigningProtocols.ECDSA,
  };
};

type SignBip322Options = {
  message: string;
  privateKey: Buffer;
  addressType: AddressType;
  network: NetworkType;
};

export const signMessageBip322 = async ({ addressType, message, network, privateKey }: SignBip322Options) => {
  const privateKeyHex = privateKey?.toString('hex');
  const publicKey = getSigningPk(addressType, privateKeyHex);
  const txScript = getSignerScript(addressType, publicKey, getBtcNetwork(network));
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
    tapInternalKey: addressType === AddressType.p2tr ? publicKey : undefined,
    witnessUtxo: {
      script: txScript.script,
      amount: BigInt(0),
    },
    redeemScript: addressType === AddressType.p2sh ? txScript.redeemScript : Buffer.alloc(0),
  });
  txToSign.addOutput({ script: btc.Script.encode(['RETURN']), amount: BigInt(0) });
  txToSign.sign(hex.decode(privateKeyHex));
  txToSign.finalize();

  // formulate-signature
  const firstInput = txToSign.getInput(0);
  if (firstInput.finalScriptWitness?.length) {
    const len = encode(firstInput.finalScriptWitness?.length);
    const result = Buffer.concat([len, ...firstInput.finalScriptWitness.map((w) => encodeVarString(w))]);
    return {
      signature: result.toString('base64'),
      publicKey: hex.encode(publicKey),
      protocol: MessageSigningProtocols.BIP322,
    };
  } else {
    throw new Error('Unable to Sign Message with BIP322');
  }
};

interface SingMessageOptions {
  accounts: Account[];
  address: string;
  message: string;
  network: NetworkType;
  seedPhrase: string;
  protocol?: MessageSigningProtocols;
}

export const signMessage = async ({
  address,
  message,
  network,
  accounts,
  seedPhrase,
  protocol,
}: SingMessageOptions) => {
  if (!accounts?.length) {
    throw new Error('a List of Accounts are required to derive the correct Private Key');
  }

  const { type } = getAddressInfo(address);
  const seed = await bip39.mnemonicToSeed(seedPhrase);
  const master = bip32.fromSeed(seed);
  const signingDerivationPath = getSigningDerivationPath(accounts, address, network);
  const child = master.derivePath(signingDerivationPath);
  /**
   * sing Message with Protocol
   */
  if (child.privateKey) {
    if (!protocol) {
      if (type === AddressType.p2tr || type === AddressType.p2wpkh) {
        // default to BIP322 for p2tr and p2wpkh
        return signMessageBip322({ addressType: type, message, network, privateKey: child.privateKey });
      }
      if (type === AddressType.p2sh) {
        // default to ECDSA for p2sh
        return signMessageECDSA(message, child.privateKey);
      }
    }
    if (protocol === MessageSigningProtocols.ECDSA) {
      return signMessageECDSA(message, child.privateKey);
    }
    if (protocol === MessageSigningProtocols.BIP322) {
      return signMessageBip322({ addressType: type, message, network, privateKey: child.privateKey });
    }
  }
  throw new Error("Couldn't sign Message");
};
