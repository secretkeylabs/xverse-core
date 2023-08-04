// import { payments, networks, Psbt, Payment, Transaction } from 'bitcoinjs-lib';
// import { ECPairFactory } from 'ecpair';
import * as secp256k1 from '@noble/secp256k1';
import { hex } from '@scure/base';
import * as btc from '@scure/btc-signer';
import BigNumber from 'bignumber.js';
import BitcoinEsploraApiProvider from '../api/esplora/esploraAPiProvider';
import { fetchBtcFeeRate } from '../api/xverse';
import { BtcFeeResponse, ErrorCodes, Inscription, NetworkType, ResponseError, UTXO } from '../types';
import { getBtcPrivateKey, getBtcTaprootPrivateKey } from '../wallet';
import { BitcoinNetwork, getBtcNetwork } from './btcNetwork';

const MINIMUM_CHANGE_OUTPUT_SATS = 1000;

export const defaultFeeRate = {
  limits: {
    min: 5,
    max: 10,
  },
  regular: 5,
  priority: 10,
};

export interface Recipient {
  address: string;
  amountSats: BigNumber;
}

export interface SignedBtcTx {
  tx: btc.Transaction;
  signedTx: string;
  fee: BigNumber;
  feePerVByte?: BigNumber;
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
  unspentOutputs: Array<UTXO>,
  pinnedOutput?: UTXO,
): Array<UTXO> {
  const inputs: Array<UTXO> = [];
  let sumValue = 0;

  if (pinnedOutput) {
    inputs.push(pinnedOutput);
    sumValue += pinnedOutput.value;
  }

  // Sort UTXOs based on block time in ascending order
  unspentOutputs.sort((a, b) => {
    if (a.status.block_time && b.status.block_time) {
      return a.status.block_time - b.status.block_time;
    } else if (a.status.block_time) {
      return 1;
    } else if (b.status.block_time) {
      return -1;
    } else {
      return a.value - b.value;
    }
  });

  unspentOutputs.forEach((unspentOutput) => {
    if (amountSats.toNumber() > sumValue) {
      inputs.push(unspentOutput);
      sumValue += unspentOutput.value;
    }
  });

  return inputs;
}

export function addInputs(tx: btc.Transaction, unspentOutputs: Array<UTXO>, p2sh: any) {
  unspentOutputs.forEach((output) => {
    tx.addInput({
      txid: output.txid,
      index: output.vout,
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
  unspentOutputs: Array<UTXO>,
  internalPubKey: Uint8Array,
  p2tr: any,
) {
  unspentOutputs.forEach((output) => {
    tx.addInput({
      txid: output.txid,
      index: output.vout,
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
  network: BitcoinNetwork,
) {
  tx.addOutputAddress(recipientAddress, BigInt(amountSats.toNumber()), network);
}

export function sumUnspentOutputs(unspentOutputs: Array<UTXO>): BigNumber {
  let sumValue = new BigNumber(0);
  unspentOutputs.forEach((output) => {
    sumValue = sumValue.plus(output.value);
  });
  return sumValue;
}

export async function generateSignedBtcTransaction(
  privateKey: string,
  selectedUnspentOutputs: Array<UTXO>,
  satsToSend: BigNumber,
  recipients: Array<Recipient>,
  changeAddress: string,
  feeSats: BigNumber,
  selectedNetwork: NetworkType,
): Promise<btc.Transaction> {
  const privKey = hex.decode(privateKey);
  const tx = new btc.Transaction();
  const btcNetwork = getBtcNetwork(selectedNetwork);
  const p2wph = btc.p2wpkh(secp256k1.getPublicKey(privKey, true), btcNetwork);
  const p2sh = btc.p2sh(p2wph, btcNetwork);

  const sumValue = sumUnspentOutputs(selectedUnspentOutputs);

  if (sumValue.isLessThan(satsToSend.plus(feeSats))) {
    // TODO: Throw error and not just the code
    // eslint-disable-next-line @typescript-eslint/no-throw-literal
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

export function createTransaction(
  privateKey: string,
  selectedUnspentOutputs: Array<UTXO>,
  totalSatsToSend: BigNumber,
  recipients: Array<Recipient>,
  changeAddress: string,
  network: NetworkType,
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

export async function calculateFee(
  selectedUnspentOutputs: Array<UTXO>,
  satsToSend: BigNumber,
  recipients: Array<Recipient>,
  feeRate: BigNumber,
  changeAddress: string,
  network: NetworkType,
): Promise<BigNumber> {
  const dummyPrivateKey = '0000000000000000000000000000000000000000000000000000000000000001';

  // Create transaction for estimation
  const tx = createTransaction(dummyPrivateKey, selectedUnspentOutputs, satsToSend, recipients, changeAddress, network);

  tx.sign(hex.decode(dummyPrivateKey));
  tx.finalize();

  const txSize = tx.vsize;

  return new BigNumber(feeRate).multipliedBy(txSize);
}

export async function getFee(
  unspentOutputs: Array<UTXO>,
  selectedUnspentOutputs: Array<UTXO>,
  sumSelectedOutputs: BigNumber,
  satsToSend: BigNumber,
  recipients: Array<Recipient>,
  feeRate: BtcFeeResponse | string,
  changeAddress: string,
  network: NetworkType,
  pinnedOutput?: UTXO,
  feeMode?: string,
): Promise<{
  newSelectedUnspentOutputs: Array<UTXO>;
  fee: BigNumber;
  selectedFeeRate?: BigNumber;
}> {
  let iSelectedUnspentOutputs = selectedUnspentOutputs.slice();

  let selectedFeeRate = Number(feeRate);

  if (typeof feeRate === 'object') {
    selectedFeeRate = feeRate.regular;

    if (feeMode && feeMode === 'high') {
      selectedFeeRate = feeRate.priority;
    }
  }

  // Calculate fee
  let calculatedFee = await calculateFee(
    selectedUnspentOutputs,
    satsToSend,
    recipients,
    new BigNumber(selectedFeeRate),
    changeAddress,
    network,
  );

  let lastSelectedUnspentOutputCount = iSelectedUnspentOutputs.length;

  let count = 0;
  while (sumSelectedOutputs.isLessThan(satsToSend.plus(calculatedFee))) {
    const newSatsToSend = satsToSend.plus(calculatedFee);

    // Select unspent outputs
    iSelectedUnspentOutputs = selectUnspentOutputs(newSatsToSend, unspentOutputs, pinnedOutput);
    sumSelectedOutputs = sumUnspentOutputs(iSelectedUnspentOutputs);

    // Check if select output count has changed since last iteration
    // If it hasn't, there is insufficient balance
    if (lastSelectedUnspentOutputCount >= unspentOutputs.length + (pinnedOutput ? 1 : 0)) {
      // TODO: Throw error and not just the code
      // eslint-disable-next-line @typescript-eslint/no-throw-literal
      throw new ResponseError(ErrorCodes.InSufficientBalanceWithTxFee).statusCode;
    }

    lastSelectedUnspentOutputCount = iSelectedUnspentOutputs.length;

    // Re-calculate fee
    calculatedFee = await calculateFee(
      iSelectedUnspentOutputs,
      satsToSend,
      recipients,
      new BigNumber(selectedFeeRate),
      changeAddress,
      network,
    );

    count++;
    if (count > 500) {
      // Exit after max 500 iterations
      // TODO: Throw error and not just the code
      // eslint-disable-next-line @typescript-eslint/no-throw-literal
      throw new ResponseError(ErrorCodes.InSufficientBalanceWithTxFee).statusCode;
    }
  }

  return {
    newSelectedUnspentOutputs: iSelectedUnspentOutputs,
    fee: calculatedFee,
    selectedFeeRate: new BigNumber(selectedFeeRate),
  };
}

export async function calculateOrdinalSendFee(
  selectedUnspentOutputs: Array<UTXO>,
  satsToSend: BigNumber,
  recipients: Array<Recipient>,
  feeRate: BigNumber,
  changeAddress: string,
  network: NetworkType,
): Promise<BigNumber> {
  const dummyPrivateKey = '0000000000000000000000000000000000000000000000000000000000000001';

  // Create transaction for estimation
  const tx = createTransaction(dummyPrivateKey, selectedUnspentOutputs, satsToSend, recipients, changeAddress, network);

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
  feeMode?: string,
  feeRateInput?: string,
): Promise<{ fee: BigNumber; selectedFeeRate?: BigNumber }> {
  try {
    const btcClient = new BitcoinEsploraApiProvider({
      network,
    });
    const unspentOutputs = await btcClient.getUnspentUtxos(btcAddress);
    let feeRate: BtcFeeResponse = defaultFeeRate;

    feeRate = await getBtcFeeRate();

    // Get total sats to send (including custom fee)
    let satsToSend = new BigNumber(0);
    recipients.forEach((recipient) => {
      satsToSend = satsToSend.plus(recipient.amountSats);
    });

    // Select unspent outputs
    const selectedUnspentOutputs = selectUnspentOutputs(satsToSend, unspentOutputs);
    const sumSelectedOutputs = sumUnspentOutputs(selectedUnspentOutputs);

    if (sumSelectedOutputs.isLessThan(satsToSend)) {
      // TODO: Throw error and not just the code
      // eslint-disable-next-line @typescript-eslint/no-throw-literal
      throw new ResponseError(ErrorCodes.InSufficientBalanceWithTxFee).statusCode;
    }

    const changeAddress = btcAddress;

    // Calculate transaction fee
    const { fee, selectedFeeRate } = await getFee(
      unspentOutputs,
      selectedUnspentOutputs,
      sumSelectedOutputs,
      satsToSend,
      recipients,
      feeRateInput || feeRate,
      changeAddress,
      network,
      undefined,
      feeMode,
    );

    return { fee, selectedFeeRate };
  } catch (error) {
    return Promise.reject(error.toString());
  }
}

export function filterUtxos(allUtxos: UTXO[], filterUtxoSet: UTXO[]) {
  return allUtxos.filter(
    (utxo) => !filterUtxoSet.some((filterUtxo) => utxo.txid === filterUtxo.txid && utxo.vout === filterUtxo.vout),
  );
}

// Used to calculate fees for setting low/high fee settings
// Should replace this function
export async function getBtcFeesForOrdinalSend(
  recipientAddress: string,
  ordinalUtxo: UTXO,
  btcAddress: string,
  network: NetworkType,
  addressOrdinalsUtxos: UTXO[],
  feeMode?: string,
  feeRateInput?: string,
): Promise<{ fee: BigNumber; selectedFeeRate?: BigNumber }> {
  try {
    const btcClient = new BitcoinEsploraApiProvider({
      network,
    });
    const unspentOutputs = await btcClient.getUnspentUtxos(btcAddress);
    const filteredUnspentOutputs = filterUtxos(unspentOutputs, addressOrdinalsUtxos);
    let feeRate: BtcFeeResponse = defaultFeeRate;

    feeRate = await getBtcFeeRate();

    // Get total sats to send (including custom fee)
    const satsToSend = new BigNumber(ordinalUtxo.value);

    // Select unspent outputs
    const selectedUnspentOutputs = selectUnspentOutputs(satsToSend, filteredUnspentOutputs, ordinalUtxo);

    const sumSelectedOutputs = sumUnspentOutputs(selectedUnspentOutputs);

    if (sumSelectedOutputs.isLessThan(satsToSend)) {
      // TODO: Throw error and not just the code
      // eslint-disable-next-line @typescript-eslint/no-throw-literal
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
    const { fee, selectedFeeRate } = await getFee(
      unspentOutputs,
      selectedUnspentOutputs,
      sumSelectedOutputs,
      satsToSend,
      recipients,
      feeRateInput || feeRate,
      changeAddress,
      network,
      ordinalUtxo,
      feeMode,
    );

    return { fee, selectedFeeRate };
  } catch (error) {
    return Promise.reject(error.toString());
  }
}

export async function getBtcFeesForOrdinalTransaction(
  recipientAddress: string,
  btcAddress: string,
  ordinalsAddress: string,
  network: NetworkType,
  ordinal: Inscription,
  isRecover?: boolean,
  feeMode?: string,
  feeRateInput?: string,
) {
  const btcClient = new BitcoinEsploraApiProvider({
    network,
  });
  const address = isRecover ? btcAddress : ordinalsAddress;
  const addressUtxos = await btcClient.getUnspentUtxos(address);
  const ordUtxo = addressUtxos.find((utx) => `${utx.txid}:${utx.vout}` === ordinal.output);
  if (!ordUtxo) {
    // TODO: Throw error and not just the code
    // eslint-disable-next-line @typescript-eslint/no-throw-literal
    throw new ResponseError(ErrorCodes.OrdinalUtxoNotfound).statusCode;
  }
  return getBtcFeesForOrdinalSend(recipientAddress, ordUtxo!, btcAddress, network, addressUtxos, feeMode, feeRateInput);
}

// Used to calculate fees for setting low/high fee settings
// Should replace this function
export async function getBtcFeesForNonOrdinalBtcSend(
  recipientAddress: string,
  nonOrdinalUtxos: Array<UTXO>,
  btcAddress: string,
  network: NetworkType,
  feeMode?: string,
  feeRateInput?: string,
): Promise<{ fee: BigNumber; selectedFeeRate?: BigNumber }> {
  try {
    const unspentOutputs = nonOrdinalUtxos;

    let feeRate: BtcFeeResponse = defaultFeeRate;

    feeRate = await getBtcFeeRate();

    const sumSelectedOutputs = sumUnspentOutputs(unspentOutputs);
    const satsToSend = sumSelectedOutputs;

    if (sumSelectedOutputs.isLessThan(satsToSend)) {
      // TODO: Throw error and not just the code
      // eslint-disable-next-line @typescript-eslint/no-throw-literal
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
    let selectedFeeRate = feeRate.regular;
    if (feeMode && feeMode === 'high') {
      selectedFeeRate = feeRate.priority;
    }

    // Calculate fee
    const calculatedFee = await calculateFee(
      unspentOutputs,
      satsToSend,
      recipients,
      new BigNumber(feeRateInput || selectedFeeRate),
      changeAddress,
      network,
    );

    return { fee: calculatedFee, selectedFeeRate: new BigNumber(feeRateInput || selectedFeeRate) };
  } catch (error) {
    return Promise.reject(error.toString());
  }
}

export function createOrdinalTransaction(
  privateKey: string,
  taprootPrivateKey: string,
  selectedUnspentOutputs: Array<UTXO>,
  totalSatsToSend: BigNumber,
  recipients: Array<Recipient>,
  changeAddress: string,
  network: NetworkType,
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

  let iSelectedUnspentOutputs = selectedUnspentOutputs;

  if (taprootPrivateKey) {
    // Assume first input is taproot ordinal utxo
    iSelectedUnspentOutputs = selectedUnspentOutputs.slice();
    const taprootInternalPubKey = secp256k1.schnorr.getPublicKey(taprootPrivateKey);
    const p2tr = btc.p2tr(taprootInternalPubKey, undefined, btcNetwork);
    const ordinalUnspentOutput = iSelectedUnspentOutputs.shift();
    addInputsTaproot(tx, [ordinalUnspentOutput!], taprootInternalPubKey, p2tr);
  }

  // Add remaining inputs
  addInputs(tx, iSelectedUnspentOutputs, p2sh);

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
  fee?: BigNumber,
): Promise<SignedBtcTx> {
  try {
    // Get sender address unspent outputs
    const btcClient = new BitcoinEsploraApiProvider({
      network,
    });
    const unspentOutputs = await btcClient.getUnspentUtxos(btcAddress);
    let feeRate: BtcFeeResponse = defaultFeeRate;
    let feePerVByte: BigNumber = new BigNumber(0);

    if (!fee) {
      feeRate = await getBtcFeeRate();
    }

    // Get sender address payment private key
    const privateKey = await getBtcPrivateKey({ seedPhrase, index: BigInt(accountIndex), network });

    // Get total sats to send (including custom fee)
    let satsToSend = fee ?? new BigNumber(0);
    recipients.forEach((recipient) => {
      satsToSend = satsToSend.plus(recipient.amountSats);
    });

    // Select unspent outputs
    let selectedUnspentOutputs = selectUnspentOutputs(satsToSend, unspentOutputs);
    const sumSelectedOutputs = sumUnspentOutputs(selectedUnspentOutputs);

    if (sumSelectedOutputs.isLessThan(satsToSend)) {
      // TODO: Throw error and not just the code
      // eslint-disable-next-line @typescript-eslint/no-throw-literal
      throw new ResponseError(ErrorCodes.InSufficientBalanceWithTxFee).statusCode;
    }

    const changeAddress = btcAddress;

    // Calculate transaction fee
    let calculatedFee: BigNumber = new BigNumber(0);
    if (!fee) {
      const {
        newSelectedUnspentOutputs,
        fee: modifiedFee,
        selectedFeeRate,
      } = await getFee(
        unspentOutputs,
        selectedUnspentOutputs,
        sumSelectedOutputs,
        satsToSend,
        recipients,
        feeRate,
        changeAddress,
        network,
      );

      calculatedFee = modifiedFee;
      feePerVByte = selectedFeeRate as BigNumber;
      selectedUnspentOutputs = newSelectedUnspentOutputs;
      satsToSend = satsToSend.plus(modifiedFee);
    }

    const tx = createTransaction(privateKey, selectedUnspentOutputs, satsToSend, recipients, changeAddress, network);

    tx.sign(hex.decode(privateKey));
    tx.finalize();

    const signedBtcTx: SignedBtcTx = {
      tx,
      signedTx: tx.hex,
      fee: fee ?? calculatedFee,
      feePerVByte,
      total: satsToSend,
    };
    return await Promise.resolve(signedBtcTx);
  } catch (error) {
    return Promise.reject(error.toString());
  }
}

export async function signOrdinalSendTransaction(
  recipientAddress: string,
  ordinalUtxo: UTXO,
  btcAddress: string,
  accountIndex: number,
  seedPhrase: string,
  network: NetworkType,
  addressOrdinalsUtxos: UTXO[],
  fee?: BigNumber,
): Promise<SignedBtcTx> {
  // Get sender address unspent outputs

  const btcClient = new BitcoinEsploraApiProvider({
    network,
  });
  const unspentOutputs = await btcClient.getUnspentUtxos(btcAddress);

  // Make sure ordinal utxo is removed from utxo set used for fees
  // This can be true if ordinal utxo is from the payment address

  const filteredUnspentOutputs = filterUtxos(unspentOutputs, addressOrdinalsUtxos);
  const ordinalUtxoInPaymentAddress = filteredUnspentOutputs.length < unspentOutputs.length;

  let feeRate: BtcFeeResponse = defaultFeeRate;
  let feePerVByte: BigNumber = new BigNumber(0);

  if (!fee) {
    feeRate = await getBtcFeeRate();
  }

  // Get sender address payment and ordinals private key
  const privateKey = await getBtcPrivateKey({
    seedPhrase,
    index: BigInt(accountIndex),
    network,
  });

  const taprootPrivateKey = await getBtcTaprootPrivateKey({
    seedPhrase,
    index: BigInt(accountIndex),
    network,
  });

  // Get total sats to send (including custom fee)
  let satsToSend = fee ? fee.plus(new BigNumber(ordinalUtxo.value)) : new BigNumber(ordinalUtxo.value);

  // Select unspent outputs
  let selectedUnspentOutputs = selectUnspentOutputs(satsToSend, filteredUnspentOutputs, ordinalUtxo);

  const sumSelectedOutputs = sumUnspentOutputs(selectedUnspentOutputs);

  if (sumSelectedOutputs.isLessThan(satsToSend)) {
    // TODO: Throw error and not just the code
    // eslint-disable-next-line @typescript-eslint/no-throw-literal
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
  let calculatedFee: BigNumber = new BigNumber(0);
  if (!fee) {
    const {
      newSelectedUnspentOutputs,
      fee: modifiedFee,
      selectedFeeRate,
    } = await getFee(
      filteredUnspentOutputs,
      selectedUnspentOutputs,
      sumSelectedOutputs,
      satsToSend,
      recipients,
      feeRate,
      changeAddress,
      network,
      ordinalUtxo,
    );

    calculatedFee = modifiedFee;
    selectedUnspentOutputs = newSelectedUnspentOutputs;
    satsToSend = satsToSend.plus(modifiedFee);
    feePerVByte = selectedFeeRate as BigNumber;
  }

  const tx = createOrdinalTransaction(
    privateKey,
    ordinalUtxoInPaymentAddress ? '' : taprootPrivateKey,
    selectedUnspentOutputs,
    satsToSend,
    recipients,
    changeAddress,
    network,
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
    tx,
    signedTx: tx.hex,
    fee: fee ?? calculatedFee,
    feePerVByte,
    total: satsToSend,
  };

  return signedBtcTx;
}

export async function signOrdinalTransaction(
  recipientAddress: string,
  btcAddress: string,
  ordinalsAddress: string,
  accountIndex: number,
  seedPhrase: string,
  network: NetworkType,
  ordinal: Inscription,
  fee?: BigNumber,
  isRecover?: boolean,
): Promise<SignedBtcTx> {
  const btcClient = new BitcoinEsploraApiProvider({
    network,
  });
  const address = isRecover ? btcAddress : ordinalsAddress;
  const addressUtxos = await btcClient.getUnspentUtxos(address);
  const ordUtxo = addressUtxos.find((utx) => `${utx.txid}:${utx.vout}` === ordinal.output);
  if (!ordUtxo) {
    // TODO: Throw error and not just the code
    // eslint-disable-next-line @typescript-eslint/no-throw-literal
    throw new ResponseError(ErrorCodes.OrdinalUtxoNotfound).statusCode;
  }
  return signOrdinalSendTransaction(
    recipientAddress,
    ordUtxo,
    btcAddress,
    accountIndex,
    seedPhrase,
    network,
    addressUtxos,
    fee,
  );
}

export async function signNonOrdinalBtcSendTransaction(
  recipientAddress: string,
  nonOrdinalUtxos: Array<UTXO>,
  accountIndex: number,
  seedPhrase: string,
  network: NetworkType,
  fee?: BigNumber,
): Promise<SignedBtcTx> {
  // Get sender address unspent outputs
  const unspentOutputs = nonOrdinalUtxos;

  let feeRate: BtcFeeResponse = defaultFeeRate;

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
  const selectedUnspentOutputs = unspentOutputs;

  const sumSelectedOutputs = sumUnspentOutputs(selectedUnspentOutputs);

  const recipients = [
    {
      address: recipientAddress,
      amountSats: sumSelectedOutputs,
    },
  ];

  const changeAddress = '';

  // Calculate transaction fee
  let calculatedFee: BigNumber = new BigNumber(0);
  if (!fee) {
    calculatedFee = await calculateFee(
      selectedUnspentOutputs,
      sumSelectedOutputs,
      recipients,
      new BigNumber(feeRate.regular),
      changeAddress,
      network,
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

    return await Promise.resolve(signedBtcTx);
  } catch (error) {
    return Promise.reject(error.toString());
  }
}
