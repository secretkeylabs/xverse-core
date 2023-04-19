// import { payments, networks, Psbt, Payment, Transaction } from 'bitcoinjs-lib';
// import { ECPairFactory } from 'ecpair';
import BigNumber from 'bignumber.js';
import {
  BtcUtxoDataResponse,
  ErrorCodes,
  NetworkType,
  ResponseError,
  BtcFeeResponse,
} from '../types';
import { fetchBtcFeeRate } from '../api/xverse';
import { getBtcPrivateKey, getBtcTaprootPrivateKey } from '../wallet';
import { fetchBtcAddressUnspent } from '../api/btc';
import * as btc from '@scure/btc-signer';
import { hex } from '@scure/base';
import * as secp256k1 from '@noble/secp256k1';
import { BitcoinNetwork, getBtcNetwork } from './btcNetwork';

const MINIMUM_CHANGE_OUTPUT_SATS = 1000;

const defaultFeeRate = {
  limits: {
    min: 5,
    max: 10,
  },
  regular: 5,
  priority: 10,
};

export interface UnspentOutput extends BtcUtxoDataResponse {}

export interface Recipient {
  address: string;
  amountSats: BigNumber;
}

export interface SignedBtcTx {
  tx: btc.Transaction;
  signedTx: string;
  fee: BigNumber;
  total: BigNumber;
}

/**
 * fetch btc fee rate from the api
 * if api fails, returns default fee rate
 */
export async function getBtcFeeRate() {
  try {
    const feeRate = await fetchBtcFeeRate();
    return feeRate;
  } catch (e) {
    return defaultFeeRate;
  }
}

export async function isCustomFeesAllowed(customFees: string) {
  const feeRate = await getBtcFeeRate();
  return Number(customFees) >= feeRate?.limits?.min ? true : false;
}

export function selectUnspentOutputs(
  amountSats: BigNumber,
  unspentOutputs: Array<UnspentOutput>,
  pinnedOutput?: UnspentOutput
): Array<UnspentOutput> {
  const inputs: Array<UnspentOutput> = [];
  var sumValue = 0;

  if (pinnedOutput) {
    inputs.push(pinnedOutput);
    sumValue += pinnedOutput.value;
  }

  unspentOutputs.forEach((unspentOutput) => {
    if (amountSats.toNumber() > sumValue) {
      inputs.push(unspentOutput);
      sumValue += unspentOutput.value;
    }
  });

  return inputs;
}

export function addInputs(tx: btc.Transaction, unspentOutputs: Array<UnspentOutput>, p2sh: any) {
  unspentOutputs.forEach((output) => {
    tx.addInput({
      txid: output.tx_hash,
      index: output.tx_output_n,
      witnessUtxo: {
        script: p2sh.script ? p2sh.script : Buffer.alloc(0),
        amount: BigInt(output.value),
      },
      redeemScript: p2sh.redeemScript ? p2sh.redeemScript : Buffer.alloc(0),
    });
  });
}

export function addInputsTaproot(
  tx: btc.Transaction,
  unspentOutputs: Array<UnspentOutput>,
  internalPubKey: Uint8Array,
  p2tr: any
) {
  unspentOutputs.forEach((output) => {
    tx.addInput({
      txid: output.tx_hash,
      index: output.tx_output_n,
      witnessUtxo: {
        script: p2tr.script,
        amount: BigInt(output.value),
      },
      tapInternalKey: internalPubKey,
    });
  });
}

export function addOutput(
  tx: btc.Transaction,
  recipientAddress: string,
  amountSats: BigNumber,
  network: BitcoinNetwork
) {
  tx.addOutputAddress(recipientAddress, BigInt(amountSats.toNumber()), network);
}

export function sumUnspentOutputs(unspentOutputs: Array<UnspentOutput>): BigNumber {
  var sumValue = new BigNumber(0);
  unspentOutputs.forEach((output) => {
    sumValue = sumValue.plus(output.value);
  });
  return sumValue;
}

export async function generateSignedBtcTransaction(
  privateKey: string,
  selectedUnspentOutputs: Array<BtcUtxoDataResponse>,
  satsToSend: BigNumber,
  recipients: Array<Recipient>,
  changeAddress: string,
  feeSats: BigNumber,
  selectedNetwork: NetworkType
): Promise<btc.Transaction> {
  const privKey = hex.decode(privateKey);
  const tx = new btc.Transaction();
  const btcNetwork = getBtcNetwork(selectedNetwork);
  const p2wph = btc.p2wpkh(secp256k1.getPublicKey(privKey, true), btcNetwork);
  const p2sh = btc.p2sh(p2wph, btcNetwork);

  const sumValue = sumUnspentOutputs(selectedUnspentOutputs);

  if (sumValue.isLessThan(satsToSend.plus(feeSats))) {
    throw new ResponseError(ErrorCodes.InSufficientBalanceWithTxFee).statusCode;
  }

  const changeSats = sumValue.minus(satsToSend);

  addInputs(tx, selectedUnspentOutputs, p2sh);

  recipients.forEach((recipient) => {
    addOutput(tx, recipient.address, recipient.amountSats, btcNetwork);
  });

  if (changeSats.gt(new BigNumber(MINIMUM_CHANGE_OUTPUT_SATS))) {
    addOutput(tx, changeAddress, changeSats, btcNetwork);
  }

  tx.sign(privKey);
  tx.finalize();
  return tx;
}

export async function calculateFee(
  selectedUnspentOutputs: Array<BtcUtxoDataResponse>,
  satsToSend: BigNumber,
  recipients: Array<Recipient>,
  feeRate: BigNumber,
  changeAddress: string,
  network: NetworkType
): Promise<BigNumber> {
  const dummyPrivateKey = '0000000000000000000000000000000000000000000000000000000000000001';

  // Create transaction for estimation
  const tx = createTransaction(
    dummyPrivateKey,
    selectedUnspentOutputs,
    satsToSend,
    recipients,
    changeAddress,
    network
  );

  tx.sign(hex.decode(dummyPrivateKey));
  tx.finalize();

  const txSize = tx.vsize;

  return new BigNumber(feeRate).multipliedBy(txSize);
}

export async function calculateOrdinalSendFee(
  selectedUnspentOutputs: Array<BtcUtxoDataResponse>,
  satsToSend: BigNumber,
  recipients: Array<Recipient>,
  feeRate: BigNumber,
  changeAddress: string,
  network: NetworkType
): Promise<BigNumber> {
  const dummyPrivateKey = '0000000000000000000000000000000000000000000000000000000000000001';

  // Create transaction for estimation
  const tx = createTransaction(
    dummyPrivateKey,
    selectedUnspentOutputs,
    satsToSend,
    recipients,
    changeAddress,
    network
  );

  tx.sign(hex.decode(dummyPrivateKey));
  tx.finalize();

  const txSize = tx.vsize;

  return new BigNumber(feeRate).multipliedBy(txSize);
}

// Used to calculate fees for setting low/high fee settings
// Should replace this function
export async function getBtcFees(
  recipients: Array<Recipient>,
  btcAddress: string,
  network: NetworkType,
  feeMode?: string
): Promise<BigNumber> {
  try {
    const unspentOutputs = await fetchBtcAddressUnspent(btcAddress, network);
    var feeRate: BtcFeeResponse = defaultFeeRate;

    feeRate = await getBtcFeeRate();

    // Get total sats to send (including custom fee)
    var satsToSend = new BigNumber(0);
    recipients.forEach((recipient) => {
      satsToSend = satsToSend.plus(recipient.amountSats);
    });

    // Select unspent outputs
    var selectedUnspentOutputs = selectUnspentOutputs(satsToSend, unspentOutputs);
    var sumSelectedOutputs = sumUnspentOutputs(selectedUnspentOutputs);

    if (sumSelectedOutputs.isLessThan(satsToSend)) {
      throw new ResponseError(ErrorCodes.InSufficientBalanceWithTxFee).statusCode;
    }

    const changeAddress = btcAddress;

    // Calculate transaction fee
    const { fee } = await getFee(
      unspentOutputs,
      selectedUnspentOutputs,
      sumSelectedOutputs,
      satsToSend,
      recipients,
      feeRate,
      changeAddress,
      network,
      undefined,
      feeMode
    );

    return fee;
  } catch (error) {
    return Promise.reject(error.toString());
  }
}

// Used to calculate fees for setting low/high fee settings
// Should replace this function
export async function getBtcFeesForOrdinalSend(
  recipientAddress: string,
  ordinalUtxo: BtcUtxoDataResponse,
  btcAddress: string,
  network: NetworkType,
  feeMode?: string
): Promise<BigNumber> {
  try {
    const unspentOutputs = await fetchBtcAddressUnspent(btcAddress, network);

    var feeRate: BtcFeeResponse = defaultFeeRate;

    feeRate = await getBtcFeeRate();

    // Get total sats to send (including custom fee)
    var satsToSend = new BigNumber(ordinalUtxo.value);

    // Select unspent outputs
    var selectedUnspentOutputs = selectUnspentOutputs(satsToSend, unspentOutputs, ordinalUtxo);

    var sumSelectedOutputs = sumUnspentOutputs(selectedUnspentOutputs);

    if (sumSelectedOutputs.isLessThan(satsToSend)) {
      throw new ResponseError(ErrorCodes.InSufficientBalanceWithTxFee).statusCode;
    }

    const recipients = [
      {
        address: recipientAddress,
        amountSats: new BigNumber(ordinalUtxo.value),
      },
    ];

    const changeAddress = btcAddress;

    // Calculate transaction fee
    const { fee } = await getFee(
      unspentOutputs,
      selectedUnspentOutputs,
      sumSelectedOutputs,
      satsToSend,
      recipients,
      feeRate,
      changeAddress,
      network,
      ordinalUtxo,
      feeMode
    );

    return fee;
  } catch (error) {
    return Promise.reject(error.toString());
  }
}

// Used to calculate fees for setting low/high fee settings
// Should replace this function
export async function getBtcFeesForNonOrdinalBtcSend(
  recipientAddress: string,
  nonOrdinalUtxos: Array<BtcUtxoDataResponse>,
  btcAddress: string,
  network: NetworkType,
  feeMode?: string
): Promise<BigNumber> {
  try {
    const unspentOutputs = nonOrdinalUtxos;

    var feeRate: BtcFeeResponse = defaultFeeRate;

    feeRate = await getBtcFeeRate();

    var sumSelectedOutputs = sumUnspentOutputs(unspentOutputs);
    var satsToSend = sumSelectedOutputs;

    if (sumSelectedOutputs.isLessThan(satsToSend)) {
      throw new ResponseError(ErrorCodes.InSufficientBalanceWithTxFee).statusCode;
    }

    const recipients = [
      {
        address: recipientAddress,
        amountSats: new BigNumber(satsToSend),
      },
    ];

    const changeAddress = btcAddress;

    // Calculate transaction fee
    var selectedFeeRate = feeRate.regular;
    if (feeMode && feeMode === 'high') {
      selectedFeeRate = feeRate.priority;
    }

    // Calculate fee
    var calculatedFee = await calculateFee(
      unspentOutputs,
      satsToSend,
      recipients,
      new BigNumber(selectedFeeRate),
      changeAddress,
      network
    );

    return calculatedFee;
  } catch (error) {
    return Promise.reject(error.toString());
  }
}

export async function getFee(
  unspentOutputs: Array<BtcUtxoDataResponse>,
  selectedUnspentOutputs: Array<BtcUtxoDataResponse>,
  sumSelectedOutputs: BigNumber,
  satsToSend: BigNumber,
  recipients: Array<Recipient>,
  feeRate: BtcFeeResponse,
  changeAddress: string,
  network: NetworkType,
  pinnedOutput?: UnspentOutput,
  feeMode?: string
): Promise<{
  newSelectedUnspentOutputs: Array<BtcUtxoDataResponse>;
  fee: BigNumber;
}> {
  var i_selectedUnspentOutputs = selectedUnspentOutputs.slice();

  var selectedFeeRate = feeRate.regular;
  if (feeMode && feeMode === 'high') {
    selectedFeeRate = feeRate.priority;
  }

  // Calculate fee
  var calculatedFee = await calculateFee(
    selectedUnspentOutputs,
    satsToSend,
    recipients,
    new BigNumber(selectedFeeRate),
    changeAddress,
    network
  );

  var lastSelectedUnspentOutputCount = i_selectedUnspentOutputs.length;

  var count = 0;
  while (sumSelectedOutputs.isLessThan(satsToSend.plus(calculatedFee))) {
    const newSatsToSend = satsToSend.plus(calculatedFee);

    // Select unspent outputs
    i_selectedUnspentOutputs = selectUnspentOutputs(newSatsToSend, unspentOutputs, pinnedOutput);
    sumSelectedOutputs = sumUnspentOutputs(i_selectedUnspentOutputs);

    // Check if select output count has changed since last iteration
    // If it hasn't, there is insufficient balance
    if (lastSelectedUnspentOutputCount >= unspentOutputs.length + (pinnedOutput ? 1 : 0)) {
      throw new ResponseError(ErrorCodes.InSufficientBalanceWithTxFee).statusCode;
    }

    lastSelectedUnspentOutputCount = i_selectedUnspentOutputs.length;

    // Re-calculate fee
    calculatedFee = await calculateFee(
      i_selectedUnspentOutputs,
      satsToSend,
      recipients,
      new BigNumber(selectedFeeRate),
      changeAddress,
      network
    );

    count++;
    if (count > 500) {
      // Exit after max 500 iterations
      throw new ResponseError(ErrorCodes.InSufficientBalanceWithTxFee).statusCode;
    }
  }

  return {
    newSelectedUnspentOutputs: i_selectedUnspentOutputs,
    fee: calculatedFee,
  };
}

export function createTransaction(
  privateKey: string,
  selectedUnspentOutputs: Array<BtcUtxoDataResponse>,
  totalSatsToSend: BigNumber,
  recipients: Array<Recipient>,
  changeAddress: string,
  network: NetworkType
): btc.Transaction {
  // Create Bitcoin transaction
  const tx = new btc.Transaction();
  const btcNetwork = getBtcNetwork(network);

  // Create wrapped segwit spend
  const privKey = hex.decode(privateKey);
  const p2wpkh = btc.p2wpkh(secp256k1.getPublicKey(privKey, true), btcNetwork);
  const p2sh = btc.p2sh(p2wpkh, btcNetwork);

  // Calculate utxo sum
  const sumValue = sumUnspentOutputs(selectedUnspentOutputs);

  // Calculate change
  const changeSats = sumValue.minus(totalSatsToSend);

  // Add inputs
  addInputs(tx, selectedUnspentOutputs, p2sh);

  // Add outputs
  recipients.forEach((recipient) => {
    addOutput(tx, recipient.address, recipient.amountSats, btcNetwork);
  });

  // Add change output
  if (changeSats.gt(new BigNumber(MINIMUM_CHANGE_OUTPUT_SATS))) {
    addOutput(tx, changeAddress, changeSats, btcNetwork);
  }

  return tx;
}

export function createOrdinalTransaction(
  privateKey: string,
  taprootPrivateKey: string,
  selectedUnspentOutputs: Array<BtcUtxoDataResponse>,
  totalSatsToSend: BigNumber,
  recipients: Array<Recipient>,
  changeAddress: string,
  network: NetworkType
): btc.Transaction {
  // Create Bitcoin transaction
  const tx = new btc.Transaction();
  const btcNetwork = getBtcNetwork(network);

  // Create wrapped segwit spend
  const privKey = hex.decode(privateKey);

  const p2wpkh = btc.p2wpkh(secp256k1.getPublicKey(privKey, true), btcNetwork);
  const p2sh = btc.p2sh(p2wpkh, btcNetwork);

  // Calculate utxo sum
  const sumValue = sumUnspentOutputs(selectedUnspentOutputs);

  // Calculate change
  const changeSats = sumValue.minus(totalSatsToSend);

  var i_selectedUnspentOutputs = selectedUnspentOutputs;

  if (taprootPrivateKey) {
    // Assume first input is taproot ordinal utxo
    i_selectedUnspentOutputs = selectedUnspentOutputs.slice();
    const taprootInternalPubKey = secp256k1.schnorr.getPublicKey(taprootPrivateKey);
    const p2tr = btc.p2tr(taprootInternalPubKey, undefined, btcNetwork);
    const ordinalUnspentOutput = i_selectedUnspentOutputs.shift();
    addInputsTaproot(tx, [ordinalUnspentOutput!], taprootInternalPubKey, p2tr);
  }

  // Add remaining inputs
  addInputs(tx, i_selectedUnspentOutputs, p2sh);

  // Add outputs
  recipients.forEach((recipient) => {
    addOutput(tx, recipient.address, recipient.amountSats, btcNetwork);
  });

  // Add change output
  if (changeSats.gt(new BigNumber(MINIMUM_CHANGE_OUTPUT_SATS))) {
    addOutput(tx, changeAddress, changeSats, btcNetwork);
  }

  return tx;
}

export async function signBtcTransaction(
  recipients: Array<Recipient>,
  btcAddress: string,
  accountIndex: number,
  seedPhrase: string,
  network: NetworkType,
  fee?: BigNumber
): Promise<SignedBtcTx> {
  // Get sender address unspent outputs
  const unspentOutputs = await fetchBtcAddressUnspent(btcAddress, network);
  var feeRate: BtcFeeResponse = defaultFeeRate;

  if (!fee) {
    feeRate = await getBtcFeeRate();
  }

  // Get sender address payment private key
  const privateKey = await getBtcPrivateKey({ seedPhrase, index: BigInt(accountIndex), network });

  // Get total sats to send (including custom fee)
  var satsToSend = fee ?? new BigNumber(0);
  recipients.forEach((recipient) => {
    satsToSend = satsToSend.plus(recipient.amountSats);
  });

  // Select unspent outputs
  var selectedUnspentOutputs = selectUnspentOutputs(satsToSend, unspentOutputs);
  var sumSelectedOutputs = sumUnspentOutputs(selectedUnspentOutputs);

  if (sumSelectedOutputs.isLessThan(satsToSend)) {
    throw new ResponseError(ErrorCodes.InSufficientBalanceWithTxFee).statusCode;
  }

  const changeAddress = btcAddress;

  // Calculate transaction fee
  var calculatedFee: BigNumber = new BigNumber(0);
  if (!fee) {
    const { newSelectedUnspentOutputs, fee } = await getFee(
      unspentOutputs,
      selectedUnspentOutputs,
      sumSelectedOutputs,
      satsToSend,
      recipients,
      feeRate,
      changeAddress,
      network
    );

    calculatedFee = fee;
    selectedUnspentOutputs = newSelectedUnspentOutputs;
    satsToSend = satsToSend.plus(fee);
  }

  try {
    const tx = createTransaction(
      privateKey,
      selectedUnspentOutputs,
      satsToSend,
      recipients,
      changeAddress,
      network
    );

    tx.sign(hex.decode(privateKey));
    tx.finalize();

    const signedBtcTx: SignedBtcTx = {
      tx: tx,
      signedTx: tx.hex,
      fee: fee ?? calculatedFee,
      total: satsToSend,
    };
    return Promise.resolve(signedBtcTx);
  } catch (error) {
    return Promise.reject(error.toString());
  }
}

export async function signOrdinalSendTransaction(
  recipientAddress: string,
  ordinalUtxo: BtcUtxoDataResponse,
  btcAddress: string,
  accountIndex: number,
  seedPhrase: string,
  network: NetworkType,
  fee?: BigNumber
): Promise<SignedBtcTx> {
  // Get sender address unspent outputs
  const unspentOutputs = await fetchBtcAddressUnspent(btcAddress, network);

  // Make sure ordinal utxo is removed from utxo set used for fees
  // This can be true if ordinal utxo is from the payment address
  const filteredUnspentOutputs = unspentOutputs.filter((unspentOutput) => {
    return !(
      unspentOutput.tx_hash === ordinalUtxo.tx_hash &&
      unspentOutput.tx_output_n === ordinalUtxo.tx_output_n
    );
  });

  var ordinalUtxoInPaymentAddress = false;
  if (filteredUnspentOutputs.length < unspentOutputs.length) {
    ordinalUtxoInPaymentAddress = true;
  }

  var feeRate: BtcFeeResponse = defaultFeeRate;

  if (!fee) {
    feeRate = await getBtcFeeRate();
  }

  // Get sender address payment and ordinals private key
  const privateKey = await getBtcPrivateKey({
    seedPhrase,
    index: BigInt(accountIndex),
    network,
  });

  var taprootPrivateKey = await getBtcTaprootPrivateKey({
    seedPhrase,
    index: BigInt(accountIndex),
    network,
  });

  // Get total sats to send (including custom fee)
  var satsToSend = fee
    ? fee.plus(new BigNumber(ordinalUtxo.value))
    : new BigNumber(ordinalUtxo.value);

  // Select unspent outputs
  var selectedUnspentOutputs = selectUnspentOutputs(
    satsToSend,
    filteredUnspentOutputs,
    ordinalUtxo
  );

  var sumSelectedOutputs = sumUnspentOutputs(selectedUnspentOutputs);

  if (sumSelectedOutputs.isLessThan(satsToSend)) {
    throw new ResponseError(ErrorCodes.InSufficientBalanceWithTxFee).statusCode;
  }

  const recipients = [
    {
      address: recipientAddress,
      amountSats: new BigNumber(ordinalUtxo.value),
    },
  ];

  const changeAddress = btcAddress;

  // Calculate transaction fee
  var calculatedFee: BigNumber = new BigNumber(0);
  if (!fee) {
    const { newSelectedUnspentOutputs, fee } = await getFee(
      filteredUnspentOutputs,
      selectedUnspentOutputs,
      sumSelectedOutputs,
      satsToSend,
      recipients,
      feeRate,
      changeAddress,
      network,
      ordinalUtxo
    );

    calculatedFee = fee;
    selectedUnspentOutputs = newSelectedUnspentOutputs;
    satsToSend = satsToSend.plus(fee);
  }

  try {
    const tx = createOrdinalTransaction(
      privateKey,
      ordinalUtxoInPaymentAddress ? '' : taprootPrivateKey,
      selectedUnspentOutputs,
      satsToSend,
      recipients,
      changeAddress,
      network
    );

    if (!ordinalUtxoInPaymentAddress) {
      // Sign ordinal input at index 0
      tx.signIdx(hex.decode(taprootPrivateKey), 0);

      // Sign remaining inputs
      for (let index = 1; index < selectedUnspentOutputs.length; index++) {
        tx.signIdx(hex.decode(privateKey), index);
      }
    } else {
      // Sign all inputs with same private key
      tx.sign(hex.decode(privateKey));
    }

    tx.finalize();

    const signedBtcTx: SignedBtcTx = {
      tx: tx,
      signedTx: tx.hex,
      fee: fee ?? calculatedFee,
      total: satsToSend,
    };

    return Promise.resolve(signedBtcTx);
  } catch (error) {
    return Promise.reject(error.toString());
  }
}

export async function signNonOrdinalBtcSendTransaction(
  recipientAddress: string,
  nonOrdinalUtxos: Array<BtcUtxoDataResponse>,
  accountIndex: number,
  seedPhrase: string,
  network: NetworkType,
  fee?: BigNumber
): Promise<SignedBtcTx> {
  // Get sender address unspent outputs
  const unspentOutputs = nonOrdinalUtxos;

  var feeRate: BtcFeeResponse = defaultFeeRate;

  if (!fee) {
    feeRate = await getBtcFeeRate();
  }

  // Get sender address payment and ordinals private key
  const taprootPrivateKey = await getBtcTaprootPrivateKey({
    seedPhrase,
    index: BigInt(accountIndex),
    network,
  });

  // Select unspent outputs
  var selectedUnspentOutputs = unspentOutputs;

  var sumSelectedOutputs = sumUnspentOutputs(selectedUnspentOutputs);

  const recipients = [
    {
      address: recipientAddress,
      amountSats: sumSelectedOutputs,
    },
  ];

  const changeAddress = '';

  // Calculate transaction fee
  var calculatedFee: BigNumber = new BigNumber(0);
  if (!fee) {
    calculatedFee = await calculateFee(
      selectedUnspentOutputs,
      sumSelectedOutputs,
      recipients,
      new BigNumber(feeRate.regular),
      changeAddress,
      network
    );
  } else {
    calculatedFee = fee;
  }

  try {
    const tx = new btc.Transaction();
    const btcNetwork = getBtcNetwork(network);

    // Create spend
    const taprootInternalPubKey = secp256k1.schnorr.getPublicKey(taprootPrivateKey);
    const p2tr = btc.p2tr(taprootInternalPubKey, undefined, btcNetwork);

    addInputsTaproot(tx, selectedUnspentOutputs, taprootInternalPubKey, p2tr);

    // Add outputs
    recipients.forEach((recipient) => {
      addOutput(tx, recipient.address, recipient.amountSats.minus(calculatedFee), btcNetwork);
    });

    // Sign inputs
    tx.sign(hex.decode(taprootPrivateKey));
    tx.finalize();

    const signedBtcTx: SignedBtcTx = {
      tx: tx,
      signedTx: tx.hex,
      fee: fee ?? calculatedFee,
      total: sumSelectedOutputs,
    };

    return Promise.resolve(signedBtcTx);
  } catch (error) {
    return Promise.reject(error.toString());
  }
}
