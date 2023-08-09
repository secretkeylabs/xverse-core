import { AppClient, DefaultWalletPolicy } from 'ledger-bitcoin';
import { Recipient } from '../transactions/btc';
import { NetworkType, UTXO } from '../types';
import {
  getCoinType,
  getNativeSegwitAccountDataFromXpub,
  getPublicKeyFromXpubAtIndex,
  getTaprootAccountDataFromXpub,
  makeLedgerCompatibleUnsignedAuthResponsePayload,
  signStxJWTAuth,
} from './helper';
import { Bip32Derivation, LedgerStxJWTAuthProfile, TapBip32Derivation, Transport } from './types';
import StacksApp, { ResponseSign } from '@zondax/ledger-stacks';
import { StacksTransaction, AddressVersion } from '@stacks/transactions';
import {
  getTransactionData,
  addSignitureToStxTransaction,
  createNativeSegwitPsbt,
  createTaprootPsbt,
  createMixedPsbt,
} from './transaction';
import { Psbt, Transaction } from 'bitcoinjs-lib';
import { bip0322Hash } from '../connect/bip322Signature';
import { encode } from 'varuint-bitcoin';
import { InputToSign } from '../transactions/psbt';
import { getAddressInfo } from 'bitcoin-address-validation';

/**
 * This function is used to get the native segwit account data from the ledger
 * @param transport - the transport object with connected ledger device
 * @param network - the network type (Mainnet or Testnet)
 * @param showAddress - show address on the wallet's screen
 * @returns the address and the public key in compressed format
 * */
export async function importNativeSegwitAccountFromLedger(
  transport: Transport,
  network: NetworkType,
  accountIndex = 0,
  addressIndex = 0,
  showAddress = false,
): Promise<{ address: string; publicKey: string }> {
  const app = new AppClient(transport);

  const btcNetwork = getCoinType(network);
  const masterFingerPrint = await app.getMasterFingerprint();
  const extendedPublicKey = await app.getExtendedPubkey(`m/84'/${btcNetwork}'/${accountIndex}'`);
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
 * @param network - the network type (Mainnet or Testnet)
 * @param addressIndex - the index of the account address to import
 * @param showAddress - show address on the wallet's screen
 * @returns the address and the public key in compressed format
 * */
export async function importTaprootAccountFromLedger(
  transport: Transport,
  network: NetworkType,
  accountIndex = 0,
  addressIndex = 0,
  showAddress = false,
): Promise<{ address: string; publicKey: string }> {
  const app = new AppClient(transport);

  const btcNetwork = getCoinType(network);
  const masterFingerPrint = await app.getMasterFingerprint();
  const extendedPublicKey = await app.getExtendedPubkey(`m/86'/${btcNetwork}'/${accountIndex}'`);
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
 * @returns the signed raw transaction in hex format
 * */

export async function signLedgerNativeSegwitBtcTransaction(
  transport: Transport,
  network: NetworkType,
  addressIndex: number,
  recipients: Array<Recipient>,
  feeRateInput?: string,
): Promise<string> {
  const coinType = getCoinType(network);
  const app = new AppClient(transport);

  // Get account details from ledger to not rely on state
  const masterFingerPrint = await app.getMasterFingerprint();
  const extendedPublicKey = await app.getExtendedPubkey(`m/84'/${coinType}'/0'`);
  const accountPolicy = new DefaultWalletPolicy(
    'wpkh(@0/**)',
    `[${masterFingerPrint}/84'/${coinType}'/0']${extendedPublicKey}`,
  );

  const {
    publicKey: senderPublicKey,
    address: senderAddress,
    witnessScript,
  } = getNativeSegwitAccountDataFromXpub(extendedPublicKey, addressIndex, network);

  const { selectedUTXOs, changeValue } = await getTransactionData(network, senderAddress, recipients, feeRateInput);

  const inputDerivation: Bip32Derivation = {
    path: `m/84'/${coinType}'/0'/0/${addressIndex}`,
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
 * @returns the signed raw transaction in hex format
 * */
export async function signLedgerTaprootBtcTransaction(
  transport: Transport,
  network: NetworkType,
  addressIndex: number,
  recipients: Array<Recipient>,
  btcAddress: string,
): Promise<string> {
  const coinType = getCoinType(network);
  const app = new AppClient(transport);

  // Get account details from ledger to not rely on state
  const masterFingerPrint = await app.getMasterFingerprint();
  const extendedPublicKey = await app.getExtendedPubkey(`m/86'/${coinType}'/0'`);
  const accountPolicy = new DefaultWalletPolicy(
    'tr(@0/**)',
    `[${masterFingerPrint}/86'/${coinType}'/0']${extendedPublicKey}`,
  );

  const {
    address: senderAddress,
    internalPubkey,
    taprootScript,
  } = getTaprootAccountDataFromXpub(extendedPublicKey, addressIndex, network);

  const { selectedUTXOs, changeValue } = await getTransactionData(network, btcAddress, recipients);

  // Need to update input derivation path so the ledger can recognize the inputs to sign
  const inputDerivation: TapBip32Derivation = {
    path: `m/86'/${coinType}'/0'/0/${addressIndex}`,
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
 * @param ordinalUtxo - the UTXO to send
 * @returns the signed raw transaction in hex format
 * */

export async function* signLedgerMixedBtcTransaction(
  transport: Transport,
  network: NetworkType,
  addressIndex: number,
  recipients: Array<Recipient>,
  feeRateInput?: string,
  ordinalUtxo?: UTXO,
): AsyncGenerator<string> {
  const coinType = getCoinType(network);
  const app = new AppClient(transport);

  // Get account details from ledger to not rely on state
  const masterFingerPrint = await app.getMasterFingerprint();
  const extendedPublicKey = await app.getExtendedPubkey(`m/84'/${coinType}'/0'`);
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
    network,
    senderAddress,
    recipients,
    feeRateInput,
    ordinalUtxo,
  );

  const inputDerivation: Bip32Derivation = {
    path: `m/84'/${coinType}'/0'/0/${addressIndex}`,
    pubkey: senderPublicKey,
    masterFingerprint: Buffer.from(masterFingerPrint, 'hex'),
  };

  const taprootExtendedPublicKey = await app.getExtendedPubkey(`m/86'/${coinType}'/0'`);
  const { internalPubkey, taprootScript } = getTaprootAccountDataFromXpub(
    taprootExtendedPublicKey,
    addressIndex,
    network,
  );
  // Need to update input derivation path so the ledger can recognize the inputs to sign
  const taprootInputDerivation: TapBip32Derivation = {
    path: `m/86'/${coinType}'/0'/0/${addressIndex}`,
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
 * @param inputToSign - the input with address and indexes to sign
 * @param psbtBase64 - the incoming transaction in base64 format
 * @param finalize - boolean to finalize the transaction
 * @returns the signed PSBT in string (base64) format
 * */
export async function signIncomingSingleSigPSBT(
  transport: Transport,
  network: NetworkType,
  addressIndex: number,
  inputToSign: InputToSign,
  psbtBase64: string,
  finalize = false,
): Promise<string> {
  if (!psbtBase64?.length) {
    throw new Error('Invalid transaction');
  }

  const coinType = getCoinType(network);
  const app = new AppClient(transport);
  const { type } = getAddressInfo(inputToSign.address);
  const isSegwit = type === 'p2wpkh';

  // Get account details from ledger to not rely on state
  const masterFingerPrint = await app.getMasterFingerprint();
  const extendedPublicKey = await app.getExtendedPubkey(`m/84'/${coinType}'/0'`);
  const accountPolicy = new DefaultWalletPolicy(
    'wpkh(@0/**)',
    `[${masterFingerPrint}/84'/${coinType}'/0']${extendedPublicKey}`,
  );

  const { publicKey: senderPublicKey } = getNativeSegwitAccountDataFromXpub(extendedPublicKey, addressIndex, network);

  const inputDerivation: Bip32Derivation = {
    path: `m/84'/${coinType}'/0'/0/${addressIndex}`,
    pubkey: senderPublicKey,
    masterFingerprint: Buffer.from(masterFingerPrint, 'hex'),
  };

  const taprootExtendedPublicKey = await app.getExtendedPubkey(`m/86'/${coinType}'/0'`);
  const { internalPubkey } = getTaprootAccountDataFromXpub(taprootExtendedPublicKey, addressIndex, network);
  // Need to update input derivation path so the ledger can recognize the inputs to sign
  const taprootInputDerivation: TapBip32Derivation = {
    path: `m/86'/${coinType}'/0'/0/${addressIndex}`,
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
  for (let i = 0; i < psbt.data.inputs.length; i++) {
    if (inputToSign.signingIndexes.includes(i)) {
      if (isSegwit) {
        psbt.updateInput(i, {
          bip32Derivation: [inputDerivation],
        });
      } else {
        psbt.updateInput(i, {
          tapBip32Derivation: [taprootInputDerivation],
        });
      }
    }
  }

  const signatures = await app.signPsbt(psbt.toBase64(), isSegwit ? accountPolicy : taprootAccountPolicy, null);
  for (const signature of signatures) {
    if (isSegwit) {
      psbt.updateInput(signature[0], {
        partialSig: [signature[1]],
      });
    } else {
      psbt.updateInput(signature[0], {
        tapKeySig: signature[1].signature,
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
  const extendedPublicKey = await app.getExtendedPubkey(`m/86'/${coinType}'/0'`);
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
    path: `m/86'/${coinType}'/0'/0/${addressIndex}`,
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

//================================================================================================
// STX
//================================================================================================

/**
 * This function is used to get the stx account data from the ledger
 * @param transport - the transport object with connected ledger device
 * @returns the address and the public key in compressed format
 * */
export async function importStacksAccountFromLedger(
  transport: Transport,
  network: NetworkType,
  accountIndex = 0,
  addressIndex = 0,
): Promise<{ address: string; publicKey: string }> {
  const appStacks = new StacksApp(transport);

  const { address, publicKey } = await appStacks.getAddressAndPubKey(
    `m/44'/5757'/${accountIndex}'/0/${addressIndex}`,
    network === 'Mainnet' ? AddressVersion.MainnetSingleSig : AddressVersion.TestnetSingleSig,
  );

  return { address, publicKey: publicKey.toString('hex') };
}

/**
 * This function is used to sign a Stacks transaction with the ledger
 * @param transport - the transport object with connected ledger device
 * @param transaction - the transaction to sign
 * @param addressIndex - the address index of the account to sign with
 * @returns the signed transaction ready to be broadcasted
 * */
export async function signLedgerStxTransaction(
  transport: Transport,
  transaction: StacksTransaction,
  addressIndex: number,
): Promise<StacksTransaction> {
  const appStacks = new StacksApp(transport);
  const path = `m/44'/5757'/${0}'/0/${addressIndex}`;
  const transactionBuffer = transaction.serialize();
  const resp = await appStacks.sign(path, transactionBuffer);
  const signedTx = addSignitureToStxTransaction(transactionBuffer, resp.signatureVRS);

  return signedTx; // TX ready to be broadcast
}

/**
 * This function is used to sign a Stacks message with the ledger
 * @param transport - the transport object with connected ledger device
 * @param message - the message to sign
 * @param accountIndex - the account index of the account to sign with
 * @param addressIndex - the address index of the account to sign with
 * @returns the signed message
 * */
export async function signStxMessage(
  transport: Transport,
  message: string,
  accountIndex = 0,
  addressIndex = 0,
): Promise<ResponseSign> {
  const appStacks = new StacksApp(transport);
  const path = `m/44'/5757'/${accountIndex}'/0/${addressIndex}`;
  // As of now 2023-04-27, the ledger app does not support signing messages longer than 152 bytes
  const result = await appStacks.sign_msg(path, message);
  return result as ResponseSign;
}

/**
 * This function is used to sign a Stacks JWT authentication request with the ledger
 * @param transport - the transport object with connected ledger device
 * @param accountIndex - the account index of the account to sign with
 * @param profile
 * @returns the signed JWT authentication request
 * */
export async function handleLedgerStxJWTAuth(
  transport: Transport,
  accountIndex: number,
  profile: LedgerStxJWTAuthProfile,
): Promise<string> {
  const appStacks = new StacksApp(transport);
  const { publicKey } = await appStacks.getIdentityPubKey(`m/888'/0'/${accountIndex}'`);

  const inputToSign = await makeLedgerCompatibleUnsignedAuthResponsePayload(publicKey.toString('hex'), profile);
  return signStxJWTAuth(transport, accountIndex, inputToSign);
}
