import * as secp256k1 from '@noble/secp256k1';
import { hex } from '@scure/base';
import * as btc from '@scure/btc-signer';
import * as bip39 from 'bip39';
import { AddressType, getAddressInfo } from 'bitcoin-address-validation';
import { crypto } from 'bitcoinjs-lib';
import { magicHash, signAsync } from 'bitcoinjs-message';
import { encode } from 'varuint-bitcoin';
import { getNativeSegwitDerivationPath, getNestedSegwitDerivationPath, getTaprootDerivationPath } from '../account';
import { BitcoinNetwork, getBtcNetwork } from '../transactions/btcNetwork';
import { Account, MessageSigningProtocols, NetworkType, SignedMessage } from '../types';
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

export const legacyHash = (message: string) => magicHash(message);

export const signMessageECDSA = async (
  message: string,
  privateKey: Buffer,
  addressType: AddressType.p2sh | AddressType.p2wpkh,
): Promise<SignedMessage> => {
  const signature = await signAsync(message, privateKey, false, {
    segwitType: addressType === AddressType.p2sh ? 'p2sh(p2wpkh)' : 'p2wpkh',
  });
  return {
    signature: signature.toString('base64'),
    protocol: MessageSigningProtocols.ECDSA,
  };
};

type SignBip322Options = {
  message: string;
  privateKey: Buffer;
  addressType: AddressType;
  network: NetworkType;
};

export const signMessageBip322 = async ({
  addressType,
  message,
  network,
  privateKey,
}: SignBip322Options): Promise<SignedMessage> => {
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
      protocol: MessageSigningProtocols.BIP322,
    };
  } else {
    throw new Error('Unable to Sign Message with BIP322');
  }
};

function getSigningDerivationPath(accounts: Array<Account>, address: string, network: NetworkType): string {
  // TODO: switch to btc.Address.decode
  const { type } = getAddressInfo(address);

  if (accounts.length <= 0) {
    throw new Error('Invalid accounts list');
  }

  let path = '';

  for (const account of accounts) {
    if (type === 'p2sh') {
      if (account.btcAddresses.nested?.address === address) {
        path = getNestedSegwitDerivationPath({ index: BigInt(account.id), network });
        break;
      }
    } else if (type === 'p2wpkh') {
      if (account.btcAddresses.native?.address === address) {
        path = getNativeSegwitDerivationPath({ index: BigInt(account.id), network });
        break;
      }
    } else if (type === 'p2tr') {
      if (account.btcAddresses.taproot.address === address) {
        path = getTaprootDerivationPath({ index: BigInt(account.id), network });
        break;
      }
    } else {
      throw new Error('Unsupported address type');
    }
  }

  if (path.length <= 0) {
    throw new Error('Address not found');
  }

  return path;
}

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
}: SingMessageOptions): Promise<SignedMessage> => {
  /**
   * Derive Private Key for signing
   */
  if (!accounts?.length) {
    throw new Error('a List of Accounts are required to derive the correct Private Key');
  }
  // TODO: switch to btc.Address.decode
  const { type } = getAddressInfo(address);
  const seed = await bip39.mnemonicToSeed(seedPhrase);
  const master = bip32.fromSeed(seed);
  const signingDerivationPath = getSigningDerivationPath(accounts, address, network);
  const child = master.derivePath(signingDerivationPath);
  /**
   * sing Message with Protocol
   */
  if (child.privateKey) {
    const protocolToUse =
      protocol ||
      (type === AddressType.p2sh || type === AddressType.p2wpkh
        ? MessageSigningProtocols.ECDSA
        : MessageSigningProtocols.BIP322);

    if (protocolToUse === MessageSigningProtocols.ECDSA) {
      if (type === AddressType.p2tr) {
        throw new Error('ECDSA is not supported for Taproot Addresses');
      }
      return signMessageECDSA(message, child.privateKey, type as AddressType.p2sh | AddressType.p2wpkh);
    }
    if (protocolToUse === MessageSigningProtocols.BIP322) {
      return signMessageBip322({ addressType: type, message, network, privateKey: child.privateKey });
    }
  }
  throw new Error("Couldn't sign Message");
};
