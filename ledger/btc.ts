import { getAddressInfo } from 'bitcoin-address-validation';
import { Psbt, Transaction } from 'bitcoinjs-lib';
import { AppClient, DefaultWalletPolicy } from 'ledger-bitcoin';
import { encode } from 'varuint-bitcoin';
import EsploraApiProvider from '../api/esplora/esploraAPiProvider';
import { bip0322Hash } from '../connect/bip322Signature';
import { BTC_SEGWIT_PATH_PURPOSE, BTC_TAPROOT_PATH_PURPOSE } from '../constant';
import { Recipient } from '../transactions/btc';
import { InputToSign } from '../transactions/psbt';
import { NetworkType, UTXO } from '../types';
import {
  getCoinType,
  getNativeSegwitAccountDataFromXpub,
  getPublicKeyFromXpubAtIndex,
  getTaprootAccountDataFromXpub,
} from './helper';
import { createMixedPsbt, createNativeSegwitPsbt, createTaprootPsbt, getTransactionData } from './transaction';
import { Bip32Derivation, TapBip32Derivation, Transport } from './types';

/**
 * This function is used to get the native segwit account data from the ledger
 * @param transport - the transport object with connected ledger device
 * @param accountIndex - the account index of the account to import
 * @param addressIndex - the index of the account address to import
 * @param network - the network type (Mainnet or Testnet)
 * @param showAddress - show address on the wallet's screen
 * @returns the address and the public key in compressed format
 * */
export async function importNativeSegwitAccountFromLedger({
  transport,
  network,
  accountIndex = 0,
  addressIndex = 0,
  showAddress = false,
}: {
  transport: Transport;
  network: NetworkType;
  accountIndex?: number;
  addressIndex?: number;
  showAddress?: boolean;
}): Promise<{ address: string; publicKey: string }> {
  const app = new AppClient(transport);

  const btcNetwork = getCoinType(network);
  const masterFingerPrint = await app.getMasterFingerprint();
  const extendedPublicKey = await app.getExtendedPubkey(`${BTC_SEGWIT_PATH_PURPOSE}${btcNetwork}'/${accountIndex}'`);
  const accountPolicy = new DefaultWalletPolicy(
    'wpkh(@0/**)',
    `[${masterFingerPrint}/84'/${btcNetwork}'/${accountIndex}']${extendedPublicKey}`,
  );
  const address = await app.getWalletAddress(accountPolicy, null, 0, addressIndex, showAddress);
  const publicKey = getPublicKeyFromXpubAtIndex(extendedPublicKey, addressIndex, network);

  return { address, publicKey: publicKey.toString('hex') };
}

/**
 * This function is used to get the taproot account data from the ledger
 * @param transport - the transport object with connected ledger device
 * @param network - the network type (Mainnet or Testnet)
 * @param accountIndex - the account index of the account to import
 * @param addressIndex - the index of the account address to import
 * @param showAddress - show address on the wallet's screen
 * @returns the address and the public key in compressed format
 * */
export async function importTaprootAccountFromLedger({
  transport,
  network,
  accountIndex = 0,
  addressIndex = 0,
  showAddress = false,
}: {
  transport: Transport;
  network: NetworkType;
  accountIndex?: number;
  addressIndex?: number;
  showAddress?: boolean;
}): Promise<{ address: string; publicKey: string }> {
  const app = new AppClient(transport);

  const btcNetwork = getCoinType(network);
  const masterFingerPrint = await app.getMasterFingerprint();
  const extendedPublicKey = await app.getExtendedPubkey(`${BTC_TAPROOT_PATH_PURPOSE}${btcNetwork}'/${accountIndex}'`);
  const accountPolicy = new DefaultWalletPolicy(
    'tr(@0/**)',
    `[${masterFingerPrint}/86'/${btcNetwork}'/${accountIndex}']${extendedPublicKey}`,
  );
  const address = await app.getWalletAddress(accountPolicy, null, 0, addressIndex, showAddress);
  const publicKey = getPublicKeyFromXpubAtIndex(extendedPublicKey, addressIndex, network);

  return { address, publicKey: publicKey.toString('hex') };
}

/**
 * This function is used to sign a Native Segwit transaction with the ledger
 * @param transport - the transport object with connected ledger device
 * @param network - the network type (Mainnet or Testnet)
 * @param addressIndex - the index of the account address to sign with
 * @param recipients - an array of recipients of the transaction
 * @param feeRate - a string representing the fee rate in sats/vB
 * @returns the signed raw transaction in hex format
 * */

export async function signLedgerNativeSegwitBtcTransaction({
  transport,
  esploraProvider,
  network,
  addressIndex,
  recipients,
  feeRate,
}: {
  transport: Transport;
  esploraProvider: EsploraApiProvider;
  network: NetworkType;
  addressIndex: number;
  recipients: Recipient[];
  feeRate?: string;
}): Promise<string> {
  const coinType = getCoinType(network);
  const app = new AppClient(transport);

  // Get account details from ledger to not rely on state
  const masterFingerPrint = await app.getMasterFingerprint();
  const extendedPublicKey = await app.getExtendedPubkey(`${BTC_SEGWIT_PATH_PURPOSE}${coinType}'/0'`);
  const accountPolicy = new DefaultWalletPolicy(
    'wpkh(@0/**)',
    `[${masterFingerPrint}/84'/${coinType}'/0']${extendedPublicKey}`,
  );

  const {
    publicKey: senderPublicKey,
    address: senderAddress,
    witnessScript,
  } = getNativeSegwitAccountDataFromXpub(extendedPublicKey, addressIndex, network);

  const { selectedUTXOs, changeValue } = await getTransactionData(
    esploraProvider,
    network,
    senderAddress,
    recipients,
    feeRate,
  );

  const inputDerivation: Bip32Derivation = {
    path: `${BTC_SEGWIT_PATH_PURPOSE}${coinType}'/0'/0/${addressIndex}`,
    pubkey: senderPublicKey,
    masterFingerprint: Buffer.from(masterFingerPrint, 'hex'),
  };

  const psbt = await createNativeSegwitPsbt(
    network,
    recipients,
    senderAddress,
    changeValue,
    selectedUTXOs,
    [inputDerivation],
    witnessScript,
  );
  const signatures = await app.signPsbt(psbt.toBase64(), accountPolicy, null);
  for (const signature of signatures) {
    psbt.updateInput(signature[0], {
      partialSig: [signature[1]],
    });
  }

  psbt.finalizeAllInputs();
  return psbt.extractTransaction().toHex();
}

/**
 * This function is used to sign a Taproot transaction with the ledger
 * @param transport - the transport object with connected ledger device
 * @param network - the network type (Mainnet or Testnet)
 * @param addressIndex - the index of the account address to sign with
 * @param recipients - an array of recipients of the transaction
 * @param btcAddress - the address to send the transaction from
 * @returns the signed raw transaction in hex format
 * */
export async function signLedgerTaprootBtcTransaction({
  transport,
  esploraProvider,
  network,
  addressIndex,
  recipients,
  btcAddress,
}: {
  transport: Transport;
  esploraProvider: EsploraApiProvider;
  network: NetworkType;
  addressIndex: number;
  recipients: Recipient[];
  btcAddress: string;
}): Promise<string> {
  const coinType = getCoinType(network);
  const app = new AppClient(transport);

  // Get account details from ledger to not rely on state
  const masterFingerPrint = await app.getMasterFingerprint();
  const extendedPublicKey = await app.getExtendedPubkey(`${BTC_TAPROOT_PATH_PURPOSE}${coinType}'/0'`);
  const accountPolicy = new DefaultWalletPolicy(
    'tr(@0/**)',
    `[${masterFingerPrint}/86'/${coinType}'/0']${extendedPublicKey}`,
  );

  const {
    address: senderAddress,
    internalPubkey,
    taprootScript,
  } = getTaprootAccountDataFromXpub(extendedPublicKey, addressIndex, network);

  const { selectedUTXOs, changeValue } = await getTransactionData(esploraProvider, network, btcAddress, recipients);

  // Need to update input derivation path so the ledger can recognize the inputs to sign
  const inputDerivation: TapBip32Derivation = {
    path: `${BTC_TAPROOT_PATH_PURPOSE}${coinType}'/0'/0/${addressIndex}`,
    pubkey: internalPubkey,
    masterFingerprint: Buffer.from(masterFingerPrint, 'hex'),
    leafHashes: [],
  };
  const psbt = await createTaprootPsbt(
    network,
    recipients,
    senderAddress,
    changeValue,
    selectedUTXOs,
    [inputDerivation],
    taprootScript,
    internalPubkey,
  );
  const signatures = await app.signPsbt(psbt.toBase64(), accountPolicy, null);
  for (const signature of signatures) {
    psbt.updateInput(signature[0], {
      tapKeySig: signature[1].signature,
    });
  }
  psbt.finalizeAllInputs();
  return psbt.extractTransaction().toHex();
}

/**
 * This function is used to sign a Native Segwit and Taproot transaction with the ledger
 * @param transport - the transport object with connected ledger device
 * @param network - the network type (Mainnet or Testnet)
 * @param addressIndex - the index of the account address to sign with
 * @param recipients - an array of recipients of the transaction
 * @param feeRate - a string representing the fee rate in sats/vB
 * @param ordinalUtxo - the UTXO to send
 * @returns the signed raw transaction in hex format
 * */

export async function* signLedgerMixedBtcTransaction({
  transport,
  esploraProvider,
  network,
  addressIndex,
  recipients,
  feeRate,
  ordinalUtxo,
}: {
  transport: Transport;
  esploraProvider: EsploraApiProvider;
  network: NetworkType;
  addressIndex: number;
  recipients: Recipient[];
  feeRate?: string;
  ordinalUtxo?: UTXO;
}): AsyncGenerator<string> {
  const coinType = getCoinType(network);
  const app = new AppClient(transport);

  // Get account details from ledger to not rely on state
  const masterFingerPrint = await app.getMasterFingerprint();
  const extendedPublicKey = await app.getExtendedPubkey(`${BTC_SEGWIT_PATH_PURPOSE}${coinType}'/0'`);
  const accountPolicy = new DefaultWalletPolicy(
    'wpkh(@0/**)',
    `[${masterFingerPrint}/84'/${coinType}'/0']${extendedPublicKey}`,
  );

  const {
    publicKey: senderPublicKey,
    address: senderAddress,
    witnessScript,
  } = getNativeSegwitAccountDataFromXpub(extendedPublicKey, addressIndex, network);

  const { selectedUTXOs, changeValue, ordinalUtxoInPaymentAddress } = await getTransactionData(
    esploraProvider,
    network,
    senderAddress,
    recipients,
    feeRate,
    ordinalUtxo,
  );

  const inputDerivation: Bip32Derivation = {
    path: `${BTC_SEGWIT_PATH_PURPOSE}${coinType}'/0'/0/${addressIndex}`,
    pubkey: senderPublicKey,
    masterFingerprint: Buffer.from(masterFingerPrint, 'hex'),
  };

  const taprootExtendedPublicKey = await app.getExtendedPubkey(`${BTC_TAPROOT_PATH_PURPOSE}${coinType}'/0'`);
  const { internalPubkey, taprootScript } = getTaprootAccountDataFromXpub(
    taprootExtendedPublicKey,
    addressIndex,
    network,
  );
  // Need to update input derivation path so the ledger can recognize the inputs to sign
  const taprootInputDerivation: TapBip32Derivation = {
    path: `${BTC_TAPROOT_PATH_PURPOSE}${coinType}'/0'/0/${addressIndex}`,
    pubkey: internalPubkey,
    masterFingerprint: Buffer.from(masterFingerPrint, 'hex'),
    leafHashes: [],
  };

  const taprootAccountPolicy = new DefaultWalletPolicy(
    'tr(@0/**)',
    `[${masterFingerPrint}/86'/${coinType}'/0']${taprootExtendedPublicKey}`,
  );

  // If the ordinal UTXO is in the payment address, we need to create a native segwit PSBT
  const psbt = ordinalUtxoInPaymentAddress
    ? await createNativeSegwitPsbt(
        network,
        recipients,
        senderAddress,
        changeValue,
        selectedUTXOs,
        [inputDerivation],
        witnessScript,
      )
    : await createMixedPsbt(
        network,
        recipients,
        senderAddress,
        changeValue,
        selectedUTXOs,
        [inputDerivation],
        witnessScript,
        [taprootInputDerivation],
        taprootScript,
        internalPubkey,
      );
  yield 'Psbt created';

  if (!ordinalUtxoInPaymentAddress) {
    // Sign Taproot inputs
    const taprootSignatures = await app.signPsbt(psbt.toBase64(), taprootAccountPolicy, null);
    for (const signature of taprootSignatures) {
      psbt.updateInput(signature[0], {
        tapKeySig: signature[1].signature,
      });
    }
    yield 'Taproot inputs signed';
  }

  // Sign Segwit inputs
  const signatures = await app.signPsbt(psbt.toBase64(), accountPolicy, null);
  for (const signature of signatures) {
    psbt.updateInput(signature[0], {
      partialSig: [signature[1]],
    });
  }

  psbt.finalizeAllInputs();
  return psbt.extractTransaction().toHex();
}

/**
 * This function is used to sign an incoming Native Segwit / Taproot PSBT with the ledger
 * @param transport - the transport object with connected ledger device
 * @param network - the network type (Mainnet or Testnet)
 * @param addressIndex - the index of the account address to sign with
 * @param inputsToSign - the array of inputs to sign with address and indexes
 * @param psbtBase64 - the incoming transaction in base64 format
 * @param finalize - boolean to finalize the transaction
 * @returns the signed PSBT in string (base64) format
 * */
export async function signIncomingSingleSigPSBT({
  transport,
  network,
  addressIndex,
  inputsToSign,
  psbtBase64,
  finalize = false,
}: {
  transport: Transport;
  network: NetworkType;
  addressIndex: number;
  inputsToSign: InputToSign[];
  psbtBase64: string;
  finalize?: boolean;
}): Promise<string> {
  if (!psbtBase64?.length) {
    throw new Error('Invalid transaction');
  }

  const coinType = getCoinType(network);
  const app = new AppClient(transport);

  let hasSegwitInputs = false;
  let hasTaprootInputs = false;

  // Get account details from ledger to not rely on state
  const masterFingerPrint = await app.getMasterFingerprint();
  const extendedPublicKey = await app.getExtendedPubkey(`${BTC_SEGWIT_PATH_PURPOSE}${coinType}'/0'`);
  const accountPolicy = new DefaultWalletPolicy(
    'wpkh(@0/**)',
    `[${masterFingerPrint}/84'/${coinType}'/0']${extendedPublicKey}`,
  );

  const { publicKey: senderPublicKey } = getNativeSegwitAccountDataFromXpub(extendedPublicKey, addressIndex, network);

  const inputDerivation: Bip32Derivation = {
    path: `${BTC_SEGWIT_PATH_PURPOSE}${coinType}'/0'/0/${addressIndex}`,
    pubkey: senderPublicKey,
    masterFingerprint: Buffer.from(masterFingerPrint, 'hex'),
  };

  const taprootExtendedPublicKey = await app.getExtendedPubkey(`${BTC_TAPROOT_PATH_PURPOSE}${coinType}'/0'`);
  const { internalPubkey } = getTaprootAccountDataFromXpub(taprootExtendedPublicKey, addressIndex, network);
  // Need to update input derivation path so the ledger can recognize the inputs to sign
  const taprootInputDerivation: TapBip32Derivation = {
    path: `${BTC_TAPROOT_PATH_PURPOSE}${coinType}'/0'/0/${addressIndex}`,
    pubkey: internalPubkey,
    masterFingerprint: Buffer.from(masterFingerPrint, 'hex'),
    leafHashes: [],
  };

  const taprootAccountPolicy = new DefaultWalletPolicy(
    'tr(@0/**)',
    `[${masterFingerPrint}/86'/${coinType}'/0']${taprootExtendedPublicKey}`,
  );

  const psbt = Psbt.fromBase64(psbtBase64);

  // Ledger needs to know the derivation path of the inputs to sign
  inputsToSign.forEach((inputToSign) => {
    const { type } = getAddressInfo(inputToSign.address);

    if (type === 'p2wpkh' && !hasSegwitInputs) {
      hasSegwitInputs = true;
    } else if (type === 'p2tr' && !hasTaprootInputs) {
      hasTaprootInputs = true;
    }

    inputToSign.signingIndexes.forEach((signingIndex) => {
      if (type === 'p2wpkh') {
        psbt.updateInput(signingIndex, {
          bip32Derivation: [inputDerivation],
        });
      } else if (type === 'p2tr') {
        psbt.updateInput(signingIndex, {
          tapBip32Derivation: [taprootInputDerivation],
        });
      }
    });
  });

  if (hasTaprootInputs) {
    const signatures = await app.signPsbt(psbt.toBase64(), taprootAccountPolicy, null);
    for (const signature of signatures) {
      psbt.updateInput(signature[0], {
        tapKeySig: signature[1].signature,
      });
    }
  }

  if (hasSegwitInputs) {
    const signatures = await app.signPsbt(psbt.toBase64(), accountPolicy, null);
    for (const signature of signatures) {
      psbt.updateInput(signature[0], {
        partialSig: [signature[1]],
      });
    }
  }

  if (finalize) {
    psbt.finalizeAllInputs();
  }

  return psbt.toBase64();
}

/**
 * This function is used to sign an incoming BIP 322 message with the ledger
 * @param transport - the transport object with connected ledger device
 * @param networkType - the network type (Mainnet or Testnet)
 * @param addressIndex - the index of the account address to sign with
 * @param message - the incoming message in string format to sign
 * @returns the signature in string (base64) format
 * */
export async function signSimpleBip322Message({
  transport,
  networkType,
  addressIndex,
  message,
}: {
  transport: Transport;
  networkType: NetworkType;
  addressIndex: number;
  message: string;
}) {
  const app = new AppClient(transport);
  const coinType = getCoinType(networkType);

  // Get account details from ledger to not rely on state
  const masterFingerPrint = await app.getMasterFingerprint();
  const extendedPublicKey = await app.getExtendedPubkey(`${BTC_TAPROOT_PATH_PURPOSE}${coinType}'/0'`);
  const accountPolicy = new DefaultWalletPolicy(
    'tr(@0/**)',
    `[${masterFingerPrint}/86'/${coinType}'/0']${extendedPublicKey}`,
  );

  const { internalPubkey, taprootScript } = getTaprootAccountDataFromXpub(extendedPublicKey, addressIndex, networkType);

  const prevoutHash = Buffer.from('0000000000000000000000000000000000000000000000000000000000000000', 'hex');
  const prevoutIndex = 0xffffffff;
  const sequence = 0;
  const scriptSig = Buffer.concat([Buffer.from('0020', 'hex'), Buffer.from(bip0322Hash(message), 'hex')]);

  const txToSpend = new Transaction();
  txToSpend.version = 0;
  txToSpend.addInput(prevoutHash, prevoutIndex, sequence, scriptSig);
  txToSpend.addOutput(taprootScript, 0);

  // Need to update input derivation path so the ledger can recognize the inputs to sign
  const inputDerivation: TapBip32Derivation = {
    path: `${BTC_TAPROOT_PATH_PURPOSE}${coinType}'/0'/0/${addressIndex}`,
    pubkey: internalPubkey,
    masterFingerprint: Buffer.from(masterFingerPrint, 'hex'),
    leafHashes: [],
  };

  const psbtToSign = new Psbt();
  psbtToSign.setVersion(0);
  psbtToSign.addInput({
    hash: txToSpend.getHash(),
    index: 0,
    sequence: 0,
    tapBip32Derivation: [inputDerivation],
    tapInternalKey: internalPubkey,
    witnessUtxo: {
      script: taprootScript,
      value: 0,
    },
  });
  psbtToSign.addOutput({ script: Buffer.from('6a', 'hex'), value: 0 });

  const signatures = await app.signPsbt(psbtToSign.toBase64(), accountPolicy, null);
  for (const signature of signatures) {
    psbtToSign.updateInput(signature[0], {
      tapKeySig: signature[1].signature,
    });
  }

  psbtToSign.finalizeAllInputs();
  const txToSign = psbtToSign.extractTransaction();

  const encodeVarString = (b: any) => Buffer.concat([encode(b.byteLength), b]);

  const len = encode(txToSign.ins[0].witness.length);
  const result = Buffer.concat([len, ...txToSign.ins[0].witness.map((w) => encodeVarString(w))]);

  const signature = result.toString('base64');
  return signature;
}
