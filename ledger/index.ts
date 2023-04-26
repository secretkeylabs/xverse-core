import BigNumber from 'bignumber.js';
import { AppClient, DefaultWalletPolicy, WalletPolicy } from 'ledger-bitcoin';
import {
  defaultFeeRate,
  getFee,
  Recipient,
  selectUnspentOutputs,
  sumUnspentOutputs,
} from '../transactions/btc';
import {
  BtcFeeResponse,
  BtcUtxoDataResponse,
  ErrorCodes,
  NetworkType,
  ResponseError,
  StacksNetwork,
} from '../types';
import { getNestedSegwitAccountDataFromXpub, getPublicKeyFromXpubAtIndex } from './helper';
import { Bip32Derivation, Transport } from './types';
import { fetchBtcAddressUnspent } from '../api/btc';
import { fetchBtcFeeRate } from '../api';
import { networks, Psbt } from 'bitcoinjs-lib';
import axios from 'axios';
import StacksApp, { ResponseSign } from '@zondax/ledger-stacks';
import {
  AnchorMode,
  SingleSigSpendingCondition,
  StacksTransaction,
  UnsignedTokenTransferOptions,
  broadcastRawTransaction,
  bytesToHex,
  createMessageSignature,
  deserializeTransaction,
  makeUnsignedSTXTokenTransfer,
  publicKeyToAddress,
} from '@stacks/transactions';
import { hashMessage, publicKeyToBtcAddress } from '@stacks/encryption';
import { makeDIDFromAddress } from '@stacks/auth';
import base64url from 'base64url';
import ecdsaFormat from 'ecdsa-sig-formatter';
import { MAINNET_BROADCAST_URI, TESTNET_BROADCAST_URI } from '../constant';

/**
 * This function is used to get the nested segwit account data from the ledger
 * @param showAddress - show address on the wallet's screen
 * @returns the address and the public key in compressed format
 * */
export async function importNestedSegwitAccountFromLedger(
  transport: Transport,
  network: NetworkType,
  accountIndex: number = 0,
  addressIndex: number = 0,
  showAddress: boolean = false
): Promise<{ address: string; publicKey: string }> {
  const app = new AppClient(transport);

  const btcNetwork = network === 'Mainnet' ? 0 : 1;
  const masterFingerPrint = await app.getMasterFingerprint();
  const extendedPublicKey = await app.getExtendedPubkey(`m/49'/${btcNetwork}'/${accountIndex}'`);
  const accountPolicy = new DefaultWalletPolicy(
    'sh(wpkh(@0/**))',
    `[${masterFingerPrint}/49'/${btcNetwork}'/${accountIndex}']${extendedPublicKey}`
  );
  const address = await app.getWalletAddress(accountPolicy, null, 0, addressIndex, showAddress);
  const publicKey = getPublicKeyFromXpubAtIndex(extendedPublicKey, addressIndex, network);

  return { address, publicKey: publicKey.toString('hex') };
}

/**
 * This function is used to get the taproot account data from the ledger
 * @param showAddress - show address on the wallet's screen
 * @returns the address and the public key in compressed format
 * */
export async function importTaprootAccountFromLedger(
  transport: Transport,
  network: NetworkType,
  accountIndex: number = 0,
  addressIndex: number = 0,
  showAddress: boolean = false
): Promise<{ address: string; publicKey: string }> {
  const app = new AppClient(transport);

  const btcNetwork = network === 'Mainnet' ? 0 : 1;
  const masterFingerPrint = await app.getMasterFingerprint();
  const extendedPublicKey = await app.getExtendedPubkey(`m/86'/${btcNetwork}'/${accountIndex}'`);
  const accountPolicy = new DefaultWalletPolicy(
    'tr(@0/**)',
    `[${masterFingerPrint}/86'/${btcNetwork}'/${accountIndex}']${extendedPublicKey}`
  );
  const address = await app.getWalletAddress(accountPolicy, null, 0, addressIndex, showAddress);
  const publicKey = getPublicKeyFromXpubAtIndex(extendedPublicKey, addressIndex, network);

  return { address, publicKey: publicKey.toString('hex') };
}

/**
 * This function is used to get the transaction data for the ledger psbt
 * @returns the selected utxos, the change value and the fee
 * */
async function getTransactionData(
  network: NetworkType,
  senderAddress: string,
  recipient: Recipient
) {
  let feeRate: BtcFeeResponse = defaultFeeRate;
  const { amountSats } = recipient;

  const allUTXOs = await fetchBtcAddressUnspent(senderAddress, network);
  let selectedUTXOs = selectUnspentOutputs(amountSats, allUTXOs);
  let sumOfSelectedUTXOs = sumUnspentOutputs(selectedUTXOs);

  if (sumOfSelectedUTXOs.isLessThan(amountSats)) {
    throw new ResponseError(ErrorCodes.InSufficientBalanceWithTxFee).statusCode;
  }

  feeRate = await fetchBtcFeeRate();
  const { newSelectedUnspentOutputs, fee } = await getFee(
    allUTXOs,
    selectedUTXOs,
    sumOfSelectedUTXOs,
    amountSats,
    [recipient],
    feeRate,
    senderAddress,
    network
  );

  // Recalculate the sum of selected UTXOs if new UTXOs were selected
  if (newSelectedUnspentOutputs.length !== selectedUTXOs.length) {
    selectedUTXOs = newSelectedUnspentOutputs;
    sumOfSelectedUTXOs = sumUnspentOutputs(newSelectedUnspentOutputs);

    if (sumOfSelectedUTXOs.isLessThan(amountSats.plus(fee))) {
      throw new ResponseError(ErrorCodes.InSufficientBalanceWithTxFee).statusCode;
    }
  }

  const changeValue = sumOfSelectedUTXOs.minus(amountSats).minus(fee);

  return { selectedUTXOs, changeValue, fee };
}

/**
 * This function is used to create a nested segwit transaction for the ledger
 * @param inputUTXOs - the selected input utxos
 * @param inputDerivation - the derivation data for the sender address
 * @returns the psbt without any signatures
 * */
async function createNestedSegwitPsbt(
  network: NetworkType,
  recipient: Recipient,
  changeAddress: string,
  changeValue: BigNumber,
  inputUTXOs: BtcUtxoDataResponse[],
  inputDerivation: Bip32Derivation[] | undefined,
  redeemScript: Buffer,
  witnessScript: Buffer
): Promise<Psbt> {
  const btcNetwork = network === 'Mainnet' ? networks.bitcoin : networks.testnet;
  const psbt = new Psbt({ network: btcNetwork });
  const { address: recipientAddress, amountSats } = recipient;

  const transactionMap = new Map<string, Buffer>();
  for (const utxo of inputUTXOs) {
    const txDataApiUrl = `${
      network === 'Mainnet' ? MAINNET_BROADCAST_URI : TESTNET_BROADCAST_URI
    }/${utxo.tx_hash}/hex`;
    const response = await axios.get(txDataApiUrl);
    transactionMap.set(utxo.tx_hash, Buffer.from(response.data, 'hex'));
  }

  for (const utxo of inputUTXOs) {
    psbt.addInput({
      hash: utxo.tx_hash,
      index: utxo.tx_output_n,
      redeemScript: redeemScript,
      // both nonWitnessUtxo and witnessUtxo are required or the ledger displays warning message
      witnessUtxo: {
        script: witnessScript,
        value: utxo.value,
      },
      nonWitnessUtxo: transactionMap.get(utxo.tx_hash),
      bip32Derivation: inputDerivation,
    });
  }

  psbt.addOutputs([
    {
      address: recipientAddress,
      value: amountSats.toNumber(),
    },
    {
      address: changeAddress,
      value: changeValue.toNumber(),
    },
  ]);

  return psbt;
}

/**
 * This function is used to sign a Nested Segwit transaction with the ledger
 * @param transport - the transport object with connected ledger device
 * @param recipient - the recipient of the transaction
 * @returns the signed raw transaction in hex format
 * */

export async function signLedgerNestedSegwitBtcTransaction(
  transport: Transport,
  network: NetworkType,
  addressIndex: number,
  recipient: Recipient
): Promise<string> {
  const coinType = network === 'Mainnet' ? 0 : 1;
  const app = new AppClient(transport);

  //================================================================================================
  // 1. Get Account Data
  //================================================================================================

  const masterFingerPrint = await app.getMasterFingerprint();
  const extendedPublicKey = await app.getExtendedPubkey(`m/49'/${coinType}'/0'`);
  const accountPolicy = new DefaultWalletPolicy(
    'sh(wpkh(@0/**))',
    `[${masterFingerPrint}/49'/${coinType}'/0']${extendedPublicKey}`
  );

  const {
    publicKey: senderPublicKey,
    address: senderAddress,
    redeemScript,
    witnessScript,
  } = getNestedSegwitAccountDataFromXpub(extendedPublicKey, addressIndex, network);

  //================================================================================================
  // 2. Get UTXOs
  //================================================================================================

  const { selectedUTXOs, changeValue } = await getTransactionData(
    network,
    senderAddress,
    recipient
  );

  //================================================================================================
  // 3. Create Transaction
  //================================================================================================

  const inputDerivation: Bip32Derivation = {
    path: `m/49'/${coinType}'/0'/0/${addressIndex}`,
    pubkey: senderPublicKey,
    masterFingerprint: Buffer.from(masterFingerPrint, 'hex'),
  };
  const psbt = await createNestedSegwitPsbt(
    network,
    recipient,
    senderAddress,
    changeValue,
    selectedUTXOs,
    [inputDerivation],
    redeemScript,
    witnessScript
  );

  console.log({ psbt: psbt.toBase64() });

  //================================================================================================
  // 4. Sign Transaction
  //================================================================================================

  const signatures = await app.signPsbt(psbt.toBase64(), accountPolicy, null);

  for (const signature of signatures) {
    psbt.updateInput(signature[0], {
      partialSig: [signature[1]],
    });
  }

  //================================================================================================
  // 5. Finalize Transaction
  //================================================================================================

  psbt.finalizeAllInputs();
  return psbt.extractTransaction().toHex();
}

//================================================================================================
// STX
//================================================================================================

export async function importStacksAccountFromLedger(
  transport: Transport,
  network: NetworkType,
  accountIndex: number = 0,
  addressIndex: number = 0
): Promise<{ address: string; publicKey: string; testnetAddress: string }> {
  const appStacks = new StacksApp(transport);
  const MainnetSingleSig = 22;
  const TestnetSingleSig = 26;

  // Returns address and COMPRESSED public key
  const { address, publicKey } = await appStacks.getAddressAndPubKey(
    `m/44'/5757'/${accountIndex}'/0/${addressIndex}`, // copied from hiro, /0 at the end means 1st account
    MainnetSingleSig
  );

  const testnetAddress = publicKeyToAddress(TestnetSingleSig, {
    data: publicKey,
    type: 6, // 6 = Public Key
  });

  return { address, testnetAddress, publicKey: publicKey.toString('hex') };
}

type TxPayload = {
  recipient: string;
  memo: string | undefined;
  amount: string;
  network: StacksNetwork | undefined;
  anchorMode: AnchorMode;
};

type UnsignedArgs = {
  txData: TxPayload;
  publicKey: string;
  fee: number | string;
  nonce?: number;
};

function initNonce(nonce?: number) {
  return nonce !== undefined ? new BigNumber(nonce, 10) : undefined;
}

export function generateUnsignedStxTransferTx(args: UnsignedArgs) {
  const { txData, publicKey, nonce, fee } = args;
  const { recipient, memo, amount, network, anchorMode } = txData;
  const options = {
    recipient,
    memo,
    publicKey,
    anchorMode: anchorMode ?? AnchorMode.Any,
    amount: new BigNumber(amount).toString(),
    nonce: initNonce(nonce)?.toString(),
    fee: new BigNumber(fee, 10).toString(),
    network,
  };

  return makeUnsignedSTXTokenTransfer(options);
}

function signTransactionWithSignature(transaction: string | Buffer, signatureVRS: Buffer) {
  const deserialzedTx = deserializeTransaction(transaction);
  const spendingCondition = createMessageSignature(signatureVRS.toString('hex'));
  (deserialzedTx.auth.spendingCondition as SingleSigSpendingCondition).signature =
    spendingCondition;
  return deserialzedTx;
}

export async function signStxTransaction(
  transport: Transport,
  transaction: StacksTransaction,
  addressIndex: number
): Promise<StacksTransaction> {
  const appStacks = new StacksApp(transport);
  const path = `m/44'/5757'/${0}'/0/${addressIndex}`;
  const transactionBuffer = transaction.serialize();
  const resp = await appStacks.sign(path, transactionBuffer);
  const signedTx = signTransactionWithSignature(transactionBuffer, resp.signatureVRS);

  // const stacksTransactionHex = `0x${bytesToHex(signedTx.serialize())}`;

  return signedTx; // TX ready to be broadcast
}

// TODO: check if we use this function, probably not
export async function broadcastStxTransaction(signedTx: StacksTransaction, network: NetworkType) {
  const broadcastUrl =
    network === 'Mainnet'
      ? 'https://stacks-node-api.mainnet.stacks.co/v2/transactions'
      : 'https://stacks-node-api.testnet.stacks.co/v2/transactions';
  const response = await broadcastRawTransaction(signedTx.serialize(), broadcastUrl);
  return response.txid;
}

export async function signStxMessage(
  transport: Transport,
  message: string,
  addressIndex: number
): Promise<ResponseSign> {
  const appStacks = new StacksApp(transport);
  const path = `m/44'/5757'/${0}'/0/${addressIndex}`;
  const result = await appStacks.sign_msg(path, message);
  return result as ResponseSign;
}

export async function makeLedgerCompatibleUnsignedAuthResponsePayload(
  dataPublicKey: string,
  profile: any
): Promise<string> {
  const address = publicKeyToBtcAddress(dataPublicKey);

  if (!address) {
    throw new Error();
  }

  const expiresAt = new Date().getTime() + 30 * 24 * 60 * 60 * 1000;
  const payload = {
    // TODO: use a UUID
    jti: '9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d',
    iat: Math.floor(new Date().getTime() / 1000), // JWT times are in seconds
    exp: Math.floor(expiresAt / 1000), // JWT times are in seconds
    iss: makeDIDFromAddress(address),
    public_keys: [dataPublicKey],
    profile,
  };

  const header = { typ: 'JWT', alg: 'ES256K' };

  const formedHeader = base64url.encode(JSON.stringify(header));

  const formedPayload = base64url.encode(JSON.stringify(payload));

  const inputToSign = [formedHeader, formedPayload].join('.');

  return inputToSign;
}

export async function signStxJWTAuth(transport: Transport, accountIndex: number, payload: string) {
  const appStacks = new StacksApp(transport);
  const response = await appStacks.sign_jwt(`m/888'/0'/${accountIndex}'`, payload);
  console.log({ response, payload });

  const resultingSig = ecdsaFormat.derToJose(Buffer.from(response.signatureDER), 'ES256');
  return [payload, resultingSig].join('.');
}

export async function handleLedgerStxJWTAuth(
  transport: Transport,
  accountIndex: number,
  profile: any
) {
  const appStacks = new StacksApp(transport);
  const { publicKey } = await appStacks.getIdentityPubKey(`m/888'/0'/${accountIndex}'`);

  const inputToSign = await makeLedgerCompatibleUnsignedAuthResponsePayload(
    publicKey.toString('hex'),
    profile
  );
  return await signStxJWTAuth(transport, accountIndex, inputToSign);
}

// FIXME: below doesn't work yet
export async function signLedgerNestedSegwitBtcTransactionRequest(
  transport: Transport,
  network: NetworkType,
  addressIndex: number,
  serializedPSBT: string
): Promise<string> {
  const coinType = network === 'Mainnet' ? 0 : 1;
  const app = new AppClient(transport);

  //================================================================================================
  // 1. Get Account Data
  //================================================================================================

  const masterFingerPrint = await app.getMasterFingerprint();
  const extendedPublicKey = await app.getExtendedPubkey(`m/86'/${coinType}'/${0}'`); // account index is hardcoded!!!
  const accountPolicy = new DefaultWalletPolicy(
    'tr(@0/**)',
    `[${masterFingerPrint}/86'/${coinType}'/${0}']${extendedPublicKey}` // account index is hardcoded!!!
  );

  const senderPublicKey = getPublicKeyFromXpubAtIndex(extendedPublicKey, addressIndex, network);

  //================================================================================================
  // 4. Sign Transaction
  //================================================================================================
  const psbt = Psbt.fromBase64(serializedPSBT);

  console.log({ psbt });

  // psbt.addOutputs(parsedPsbt.txOutputs);

  console.log({ psbt });

  const inputDerivation: Bip32Derivation = {
    path: `m/86'/${coinType}'/0'/0/${addressIndex}`,
    pubkey: senderPublicKey,
    masterFingerprint: Buffer.from(masterFingerPrint, 'hex'),
  };

  console.log({ psbt });

  console.log({ hex: psbt.toHex() });

  for (let i = 0; i < psbt.txInputs.length; i++) {
    psbt.updateInput(i, { bip32Derivation: [inputDerivation] });
  }

  console.log({ psbt });

  console.log({ hex: psbt.toHex() });

  const signatures = await app.signPsbt(psbt.toBase64(), accountPolicy, null);
  console.log({ signatures });
  for (const signature of signatures) {
    psbt.updateInput(signature[0], {
      partialSig: [signature[1]],
    });
  }

  //================================================================================================
  // 5. Finalize Transaction
  //================================================================================================

  psbt.finalizeAllInputs();
  return psbt.extractTransaction().toHex();
}
