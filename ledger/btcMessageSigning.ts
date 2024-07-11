import AppClient, { DefaultWalletPolicy } from 'ledger-bitcoin';
import { AddressType, getAddressInfo } from 'bitcoin-address-validation';
import { Psbt, Transaction } from 'bitcoinjs-lib';
import { encode } from 'varuint-bitcoin';
import { BTC_SEGWIT_PATH_PURPOSE, BTC_TAPROOT_PATH_PURPOSE } from '../constant';
import { bip0322Hash, MessageSigningProtocols } from '../connect';
import { NetworkType } from '../types';
import { getCoinType, getNativeSegwitAccountDataFromXpub, getTaprootAccountDataFromXpub } from './helper';
import { Bip32Derivation, TapBip32Derivation, Transport } from './types';

const encodeVarString = (b: Buffer) => Buffer.concat([encode(b.byteLength), b]);
const DUMMY_INPUT_HASH = Buffer.from('0000000000000000000000000000000000000000000000000000000000000000', 'hex');
const DUMMY_INPUT_INDEX = 0xffffffff;
const DUMMY_INPUT_SEQUENCE = 0;
type PsbtInput = Parameters<Psbt['addInput']>[0];

const createMessageSignature = async (
  app: AppClient,
  accountPolicy: DefaultWalletPolicy,
  message: string,
  witnessScript: Buffer,
  inputArgs: Pick<PsbtInput, 'bip32Derivation'> | Pick<PsbtInput, 'tapBip32Derivation' | 'tapInternalKey'>,
  isSegwit: boolean,
): Promise<string> => {
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
  const signatures = await app.signPsbt(psbtToSign.toBase64(), accountPolicy, null);
  for (const signature of signatures) {
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
  return signature;
};

const createSegwitBip322Signature = async ({
  message,
  app,
  addressIndex,
  networkType,
}: {
  message: string;
  app: AppClient;
  addressIndex: number;
  networkType: NetworkType;
}): Promise<string> => {
  const coinType = getCoinType(networkType);
  const masterFingerPrint = await app.getMasterFingerprint();
  const extendedPublicKey = await app.getExtendedPubkey(`${BTC_SEGWIT_PATH_PURPOSE}${coinType}'/0'`);
  const { publicKey, witnessScript } = getNativeSegwitAccountDataFromXpub(extendedPublicKey, addressIndex, networkType);
  const inputDerivation: Bip32Derivation = {
    path: `${BTC_SEGWIT_PATH_PURPOSE}${coinType}'/0'/0/${addressIndex}`,
    pubkey: publicKey,
    masterFingerprint: Buffer.from(masterFingerPrint, 'hex'),
  };
  const accountPolicy = new DefaultWalletPolicy(
    'wpkh(@0/**)',
    `[${masterFingerPrint}/84'/${coinType}'/0']${extendedPublicKey}`,
  );
  return createMessageSignature(
    app,
    accountPolicy,
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
  addressIndex,
  networkType,
}: {
  message: string;
  app: AppClient;
  addressIndex: number;
  networkType: NetworkType;
}): Promise<string> => {
  const coinType = getCoinType(networkType);
  const masterFingerPrint = await app.getMasterFingerprint();
  const extendedPublicKey = await app.getExtendedPubkey(`${BTC_TAPROOT_PATH_PURPOSE}${coinType}'/0'`);
  const { internalPubkey, taprootScript } = getTaprootAccountDataFromXpub(extendedPublicKey, addressIndex, networkType);
  // Need to update input derivation path so the ledger can recognize the inputs to sign
  const inputDerivation: TapBip32Derivation = {
    path: `${BTC_TAPROOT_PATH_PURPOSE}${coinType}'/0'/0/${addressIndex}`,
    pubkey: internalPubkey,
    masterFingerprint: Buffer.from(masterFingerPrint, 'hex'),
    leafHashes: [],
  };
  const accountPolicy = new DefaultWalletPolicy(
    'tr(@0/**)',
    `[${masterFingerPrint}/86'/${coinType}'/0']${extendedPublicKey}`,
  );
  return createMessageSignature(
    app,
    accountPolicy,
    message,
    taprootScript,
    {
      tapBip32Derivation: [inputDerivation],
      tapInternalKey: internalPubkey,
    },
    false,
  );
};

export async function createNativeSegwitECDSA({
  transport,
  networkType,
  message,
  addressIndex,
}: {
  transport: Transport;
  networkType: NetworkType;
  message: string;
  addressIndex: number;
}) {
  const app = new AppClient(transport);
  const coinType = getCoinType(networkType);
  const signature = await app.signMessage(
    Buffer.from(message),
    `${BTC_SEGWIT_PATH_PURPOSE}${coinType}'/0'/0/${addressIndex}`,
  );
  return signature;
}

/**
 * This function is used to sign an incoming BIP 322 message with the ledger
 * @param transport - the transport object with connected ledger device
 * @param networkType - the network type (Mainnet or Testnet)
 * @param addressIndex - the index of the account address to sign with
 * @param message - the incoming message in string format to sign
 * @returns the signature in string (base64) format
 * */
export async function signMessageLedger({
  transport,
  networkType,
  addressIndex,
  address,
  message,
  protocol,
}: {
  transport: Transport;
  networkType: NetworkType;
  addressIndex: number;
  address: string;
  message: string;
  protocol?: MessageSigningProtocols;
}) {
  const app = new AppClient(transport);
  const { type } = getAddressInfo(address);
  if (!protocol) {
    if (type === AddressType.p2tr) {
      return createTaprootBip322Signature({ message, app, addressIndex, networkType });
    }
    return createSegwitBip322Signature({ message, app, addressIndex, networkType });
  }
  if (protocol === MessageSigningProtocols.ECDSA) {
    return createNativeSegwitECDSA({ transport, networkType, message, addressIndex });
  }
  if (protocol === MessageSigningProtocols.BIP322) {
    return createTaprootBip322Signature({ message, app, addressIndex, networkType });
  }
  throw new Error('Invalid Address Type');
}
