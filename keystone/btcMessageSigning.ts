import { AddressType, getAddressInfo } from 'bitcoin-address-validation';
import { BTC_SEGWIT_PATH_PURPOSE, BTC_TAPROOT_PATH_PURPOSE } from '../constant';
import { MessageSigningProtocols, NetworkType, SignedMessage } from '../types';
import Bitcoin from '@keystonehq/hw-app-bitcoin';
import { TransportWebUSB } from '@keystonehq/hw-transport-webusb';

import { Psbt, Transaction } from 'bitcoinjs-lib';
import { encode } from 'varuint-bitcoin';
import { bip0322Hash } from '../connect';
import { getCoinType, getNativeSegwitAccountDataFromXpub, getTaprootAccountDataFromXpub } from './helper';
import { Bip32Derivation, TapBip32Derivation } from './bip32Type';

const encodeVarString = (b: Buffer) => Buffer.concat([encode(b.byteLength), b]);
const DUMMY_INPUT_HASH = Buffer.from('0000000000000000000000000000000000000000000000000000000000000000', 'hex');
const DUMMY_INPUT_INDEX = 0xffffffff;
const DUMMY_INPUT_SEQUENCE = 0;
type PsbtInput = Parameters<Psbt['addInput']>[0];

const createMessageSignature = async (
  app: Bitcoin,
  message: string,
  witnessScript: Buffer,
  inputArgs: Pick<PsbtInput, 'bip32Derivation'> | Pick<PsbtInput, 'tapBip32Derivation' | 'tapInternalKey'>,
  isSegwit: boolean,
): Promise<SignedMessage> => {
  const scriptSig = Buffer.concat([Buffer.from('0020', 'hex'), Buffer.from(bip0322Hash(message), 'hex')]);
  const txToSpend = new Transaction();
  txToSpend.version = 0;
  txToSpend.addInput(DUMMY_INPUT_HASH, DUMMY_INPUT_INDEX, DUMMY_INPUT_SEQUENCE, scriptSig);
  txToSpend.addOutput(witnessScript, 0);
  const psbtToSign = new Psbt();
  psbtToSign.setVersion(0);
  psbtToSign.addInput({
    hash: txToSpend.getHash(),
    index: 0,
    sequence: 0,
    witnessUtxo: {
      script: witnessScript,
      value: 0,
    },
    ...inputArgs,
  });
  psbtToSign.addOutput({ script: Buffer.from('6a', 'hex'), value: 0 });
  const signatures = await app.signPsbt(psbtToSign.toBase64());
  for (const signature of signatures) {
    if (!signature[1]) {
      continue;
    }
    if (isSegwit) {
      psbtToSign.updateInput(signature[0], {
        partialSig: [signature[1]],
      });
    } else {
      psbtToSign.updateInput(signature[0], {
        tapKeySig: signature[1].signature,
      });
    }
  }
  psbtToSign.finalizeAllInputs();
  const txToSign = psbtToSign.extractTransaction();
  const len = encode(txToSign.ins[0].witness.length);
  const result = Buffer.concat([len, ...txToSign.ins[0].witness.map((w) => encodeVarString(w))]);
  const signature = result.toString('base64');
  return {
    signature,
    protocol: MessageSigningProtocols.BIP322,
  };
};

const createSegwitBip322Signature = async ({
  message,
  app,
  xpub,
  addressIndex,
  networkType,
}: {
  message: string;
  app: Bitcoin;
  xpub?: string;
  addressIndex: number;
  networkType: NetworkType;
}): Promise<SignedMessage> => {
  const coinType = getCoinType(networkType);

  if (!app.mfp) {
    throw new Error('not found keystoneBitcoin mfp');
  }
  if (!xpub) {
    throw new Error('not found keystone extendedPublicKey');
  }
  const { publicKey, witnessScript } = getNativeSegwitAccountDataFromXpub(xpub, addressIndex, networkType);
  const inputDerivation: Bip32Derivation = {
    path: `${BTC_SEGWIT_PATH_PURPOSE}${coinType}'/0'/0/${addressIndex}`,
    pubkey: publicKey,
    masterFingerprint: Buffer.from(app.mfp, 'hex'),
  };
  return createMessageSignature(
    app,
    message,
    witnessScript,
    {
      bip32Derivation: [inputDerivation],
    },
    true,
  );
};

const createTaprootBip322Signature = async ({
  message,
  app,
  xpub,
  addressIndex,
  networkType,
}: {
  message: string;
  app: Bitcoin;
  xpub?: string;
  addressIndex: number;
  networkType: NetworkType;
}): Promise<SignedMessage> => {
  const coinType = getCoinType(networkType);

  if (!app.mfp) {
    throw new Error('not found keystoneBitcoin mfp');
  }
  if (!xpub) {
    throw new Error('not found keystone extendedPublicKey');
  }

  const { internalPubkey, taprootScript } = getTaprootAccountDataFromXpub(xpub, addressIndex, networkType);
  const inputDerivation: TapBip32Derivation = {
    path: `${BTC_TAPROOT_PATH_PURPOSE}${coinType}'/0'/0/${addressIndex}`,
    pubkey: internalPubkey,
    masterFingerprint: Buffer.from(app.mfp, 'hex'),
    leafHashes: [],
  };
  return createMessageSignature(
    app,
    message,
    taprootScript,
    {
      tapBip32Derivation: [inputDerivation],
      tapInternalKey: internalPubkey,
    },
    false,
  );
};

async function createNativeSegwitECDSA({
  transport,
  mfp,
  networkType,
  message,
  addressIndex,
}: {
  transport: TransportWebUSB;
  mfp: string;
  networkType: NetworkType;
  message: string;
  addressIndex: number;
}): Promise<SignedMessage> {
  const app = new Bitcoin(transport, mfp);

  const coinType = getCoinType(networkType);
  const signature = await app.signMessage(message, `${BTC_SEGWIT_PATH_PURPOSE}${coinType}'/0'/0/${addressIndex}`);
  return {
    signature,
    protocol: MessageSigningProtocols.ECDSA,
  };
}

/**
 * This function is used to sign an incoming BIP 322 message with the keystone
 * @param transport - the transport object with connected keystone device
 * @param networkType - the network type (Mainnet or Testnet)
 * @param addressIndex - the index of the account address to sign with
 * @param message - the incoming message in string format to sign
 * @returns the signature in string (base64) format
 * */
export async function signMessageKeystone({
  transport,
  networkType,
  addressIndex,
  address,
  message,
  protocol,
  mfp,
  xpub,
}: {
  transport: TransportWebUSB;
  networkType: NetworkType;
  addressIndex: number;
  address: string;
  message: string;
  protocol?: MessageSigningProtocols;
  mfp: string;
  xpub: {
    btc?: string;
    ordinals?: string;
  };
}): Promise<SignedMessage> {
  const app = new Bitcoin(transport, mfp);
  const { type } = getAddressInfo(address);

  // if protocol isn't specified, we default to bip322 for both address types
  const protocolToSign = protocol || MessageSigningProtocols.BIP322;
  if (protocolToSign === MessageSigningProtocols.ECDSA) {
    if (type === AddressType.p2tr) {
      throw new Error('ECDSA is not supported for Taproot Addresses');
    }
    return createNativeSegwitECDSA({ transport, mfp, networkType, message, addressIndex });
  }
  if (protocolToSign === MessageSigningProtocols.BIP322) {
    if (type === AddressType.p2tr) {
      return createTaprootBip322Signature({ message, app, xpub: xpub.ordinals, addressIndex, networkType });
    }
    return createSegwitBip322Signature({ message, app, xpub: xpub.btc, addressIndex, networkType });
  }
  throw new Error("Couldn't sign Message");
}
