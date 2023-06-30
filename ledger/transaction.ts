import { NetworkType } from '../types/network';
import { BtcFeeResponse } from '../types/api/xverse/transaction';
import { UTXO } from 'types/api/esplora';
import { ErrorCodes, ResponseError } from '../types/error';
import { networks, Psbt } from 'bitcoinjs-lib';
import { fetchBtcFeeRate } from '../api';
import BitcoinEsploraApiProvider from '../api/esplora/esploraAPiProvider';
import {
  defaultFeeRate,
  selectUnspentOutputs,
  sumUnspentOutputs,
  Recipient,
  getFee,
  filterUtxos,
} from '../transactions/btc';
import axios from 'axios';
import BigNumber from 'bignumber.js';
import { Bip32Derivation, TapBip32Derivation } from './types';
import { MAINNET_BROADCAST_URI, TESTNET_BROADCAST_URI } from './constants';
import {
  createMessageSignature,
  deserializeTransaction,
  SingleSigSpendingCondition,
} from '@stacks/transactions';

/**
 * This function is used to get the transaction data for the ledger psbt
 * @returns the selected utxos, the change value and the fee
 * */
export async function getTransactionData(
  network: NetworkType,
  senderAddress: string,
  recipient: Recipient,
  ordinalUtxo?: UTXO
) {
  // Get sender address unspent outputs
  const btcClient = new BitcoinEsploraApiProvider({
    network,
  });
  const unspentOutputs: UTXO[] = await btcClient.getUnspentUtxos(senderAddress);

  let filteredUnspentOutputs = unspentOutputs;
  
  if (ordinalUtxo) {
    filteredUnspentOutputs = filterUtxos(unspentOutputs, [ordinalUtxo]);
  }

  let ordinalUtxoInPaymentAddress = false;
  if (filteredUnspentOutputs.length < unspentOutputs.length) {
    ordinalUtxoInPaymentAddress = true;
  }
  
  let feeRate: BtcFeeResponse = defaultFeeRate;
  const { amountSats } = recipient;
  
  let selectedUTXOs = selectUnspentOutputs(amountSats, filteredUnspentOutputs, ordinalUtxo);
  let sumOfSelectedUTXOs = sumUnspentOutputs(selectedUTXOs);

  if (sumOfSelectedUTXOs.isLessThan(amountSats)) {
    // eslint-disable-next-line @typescript-eslint/no-throw-literal
    throw new ResponseError(ErrorCodes.InSufficientBalanceWithTxFee).statusCode;
  }

  feeRate = await fetchBtcFeeRate();
  const { newSelectedUnspentOutputs, fee } = await getFee(
    filteredUnspentOutputs,
    selectedUTXOs,
    sumOfSelectedUTXOs,
    amountSats,
    [recipient],
    feeRate,
    senderAddress,
    network,
    ordinalUtxo
  );

  // Recalculate the sum of selected UTXOs if new UTXOs were selected
  if (newSelectedUnspentOutputs.length !== selectedUTXOs.length) {
    selectedUTXOs = newSelectedUnspentOutputs;
    sumOfSelectedUTXOs = sumUnspentOutputs(newSelectedUnspentOutputs);

    if (sumOfSelectedUTXOs.isLessThan(amountSats.plus(fee))) {
      // eslint-disable-next-line @typescript-eslint/no-throw-literal
      throw new ResponseError(ErrorCodes.InSufficientBalanceWithTxFee).statusCode;
    }
  }

  const changeValue = sumOfSelectedUTXOs.minus(amountSats).minus(fee);

  return { selectedUTXOs, changeValue, fee, ordinalUtxoInPaymentAddress };
}

/**
 * This function is used to create a native segwit transaction for the ledger
 * @param inputUTXOs - the selected input utxos
 * @param inputDerivation - the derivation data for the sender address
 * @returns the psbt without any signatures
 * */
export async function createNativeSegwitPsbt(
  network: NetworkType,
  recipient: Recipient,
  changeAddress: string,
  changeValue: BigNumber,
  inputUTXOs: UTXO[],
  inputDerivation: Bip32Derivation[] | undefined,
  witnessScript: Buffer,
): Promise<Psbt> {
  const btcNetwork = network === 'Mainnet' ? networks.bitcoin : networks.testnet;
  const psbt = new Psbt({ network: btcNetwork });
  const { address: recipientAddress, amountSats } = recipient;

  const transactionMap = new Map<string, Buffer>();
  for (const utxo of inputUTXOs) {
    const txDataApiUrl = `${
      network === 'Mainnet' ? MAINNET_BROADCAST_URI : TESTNET_BROADCAST_URI
    }/${utxo.txid}/hex`;
    const response = await axios.get(txDataApiUrl);
    transactionMap.set(utxo.txid, Buffer.from(response.data, 'hex'));
  }

  for (const utxo of inputUTXOs) {
    psbt.addInput({
      hash: utxo.txid,
      index: utxo.vout,
      // both nonWitnessUtxo and witnessUtxo are required or the ledger displays warning message
      witnessUtxo: {
        script: witnessScript,
        value: utxo.value,
      },
      nonWitnessUtxo: transactionMap.get(utxo.txid),
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

export function addSignitureToStxTransaction(transaction: string | Buffer, signatureVRS: Buffer) {
  const deserialzedTx = deserializeTransaction(transaction);
  const spendingCondition = createMessageSignature(signatureVRS.toString('hex'));
  (deserialzedTx.auth.spendingCondition as SingleSigSpendingCondition).signature =
    spendingCondition;
  return deserialzedTx;
}

/**
 * This function is used to create a taproot transaction for the ledger
 * @param inputUTXOs - the selected input utxos
 * @param inputDerivation - the derivation data for the sender address
 * @returns the psbt without any signatures
 * */
export async function createTaprootPsbt(
  network: NetworkType,
  recipient: Recipient,
  changeAddress: string,
  changeValue: BigNumber,
  inputUTXOs: UTXO[],
  inputDerivation: TapBip32Derivation[] | undefined,
  taprootScript: Buffer,
  tapInternalKey: Buffer
): Promise<Psbt> {
  const btcNetwork = network === 'Mainnet' ? networks.bitcoin : networks.testnet;
  const psbt = new Psbt({ network: btcNetwork });
  const { address: recipientAddress, amountSats } = recipient;

  for (const utxo of inputUTXOs) {
    psbt.addInput({
      hash: utxo.txid,
      index: utxo.vout,
      witnessUtxo: {
        script: taprootScript,
        value: utxo.value,
      },
      tapBip32Derivation: inputDerivation,
      tapInternalKey,
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
 * This function is used to create a native segwit transaction for the ledger
 * @param inputUTXOs - the selected input utxos
 * @param inputDerivation - the derivation data for the sender address
 * @returns the psbt without any signatures
 * */
export async function createMixedPsbt(
  network: NetworkType,
  recipient: Recipient,
  changeAddress: string,
  changeValue: BigNumber,
  inputUTXOs: UTXO[],
  inputDerivation: Bip32Derivation[] | undefined,
  witnessScript: Buffer,
  taprootInputDerivation: TapBip32Derivation[] | undefined,
  taprootScript: Buffer,
  tapInternalKey: Buffer,
): Promise<Psbt> {
  const btcNetwork = network === 'Mainnet' ? networks.bitcoin : networks.testnet;
  const psbt = new Psbt({ network: btcNetwork });
  const { address: recipientAddress, amountSats } = recipient;

  const transactionMap = new Map<string, Buffer>();
  for (const utxo of inputUTXOs) {
    const txDataApiUrl = `${
      network === 'Mainnet' ? MAINNET_BROADCAST_URI : TESTNET_BROADCAST_URI
    }/${utxo.txid}/hex`;
    const response = await axios.get(txDataApiUrl);
    transactionMap.set(utxo.txid, Buffer.from(response.data, 'hex'));
  }

  // Adding Taproot input
  psbt.addInput({
    hash: inputUTXOs[0].txid,
    index: inputUTXOs[0].vout,
    witnessUtxo: {
      script: taprootScript,
      value: inputUTXOs[0].value,
    },
    tapBip32Derivation: taprootInputDerivation,
    tapInternalKey,
  });
  
  // Adding Segwit input
  psbt.addInput({
    hash: inputUTXOs[1].txid,
    index: inputUTXOs[1].vout,
    // both nonWitnessUtxo and witnessUtxo are required or the ledger displays warning message
    witnessUtxo: {
      script: witnessScript,
      value: inputUTXOs[1].value,
    },
    nonWitnessUtxo: transactionMap.get(inputUTXOs[1].txid),
    bip32Derivation: inputDerivation,
  });

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
