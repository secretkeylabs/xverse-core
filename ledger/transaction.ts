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
import { createMessageSignature, deserializeTransaction, SingleSigSpendingCondition } from '@stacks/transactions';

/**
 * This function is used to get the transaction data for the ledger psbt
 * @param network - the network type (Mainnet or Testnet)
 * @param senderAddress - the address to send the transaction from
 * @param recipients - an array of recipients of the transaction
 * @param ordinalUtxo - the UTXO to send
 * @returns the selected utxos, the change value and the fee
 * */
export async function getTransactionData(
  network: NetworkType,
  senderAddress: string,
  recipients: Array<Recipient>,
  feeRateInput?: string,
  ordinalUtxo?: UTXO,
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

  const ordinalUtxoInPaymentAddress = filteredUnspentOutputs.length < unspentOutputs.length;

  let feeRate: BtcFeeResponse = defaultFeeRate;

  // Get total sats to send (including custom fee)
  const amountSats = recipients.reduce((acc, value) => acc.plus(value.amountSats), new BigNumber(0));

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
    recipients,
    feeRateInput || feeRate,
    senderAddress,
    network,
    ordinalUtxo,
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
 * @param network - the network type (Mainnet or Testnet)
 * @param recipients - an array of recipients of the transaction
 * @param changeAddress - the change address where the change will be sent to
 * @param changeValue - the value of the remaining balance after the transaction has been completed
 * @param inputUTXOs - the selected input utxos
 * @param inputDerivation - the derivation data for the sender address
 * @returns the psbt without any signatures
 * */
export async function createNativeSegwitPsbt(
  network: NetworkType,
  recipients: Array<Recipient>,
  changeAddress: string,
  changeValue: BigNumber,
  inputUTXOs: UTXO[],
  inputDerivation: Bip32Derivation[] | undefined,
  witnessScript: Buffer,
): Promise<Psbt> {
  const btcNetwork = network === 'Mainnet' ? networks.bitcoin : networks.testnet;
  const psbt = new Psbt({ network: btcNetwork });

  const transactionMap: Record<string, Buffer> = {};

  await Promise.all(
    inputUTXOs.map(async (utxo) => {
      const txDataApiUrl = `${network === 'Mainnet' ? MAINNET_BROADCAST_URI : TESTNET_BROADCAST_URI}/${utxo.txid}/hex`;
      const response = await axios.get(txDataApiUrl);
      transactionMap[utxo.txid] = Buffer.from(response.data, 'hex');
    }),
  );

  for (const utxo of inputUTXOs) {
    psbt.addInput({
      hash: utxo.txid,
      index: utxo.vout,
      // both nonWitnessUtxo and witnessUtxo are required or the ledger displays warning message
      witnessUtxo: {
        script: witnessScript,
        value: utxo.value,
      },
      nonWitnessUtxo: transactionMap[utxo.txid],
      bip32Derivation: inputDerivation,
    });
  }

  psbt.addOutputs(
    recipients.map((value) => ({
      address: value.address,
      value: value.amountSats.toNumber(),
    })),
  );

  if (changeValue.toNumber() > 0) {
    psbt.addOutput({
      address: changeAddress,
      value: changeValue.toNumber(),
    });
  }

  return psbt;
}

export function addSignatureToStxTransaction(transaction: string | Buffer, signatureVRS: Buffer) {
  const deserializedTx = deserializeTransaction(transaction);
  const spendingCondition = createMessageSignature(signatureVRS.toString('hex'));
  (deserializedTx.auth.spendingCondition as SingleSigSpendingCondition).signature = spendingCondition;
  return deserializedTx;
}

/**
 * This function is used to create a taproot transaction for the ledger
 * @param network - the network type (Mainnet or Testnet)
 * @param recipients - an array of recipients of the transaction
 * @param changeAddress - the change address where the change will be sent to
 * @param changeValue - the value of the remaining balance after the transaction has been completed
 * @param inputUTXOs - the selected input utxos
 * @param inputDerivation - the derivation data for the sender address
 * @returns the psbt without any signatures
 * */
export async function createTaprootPsbt(
  network: NetworkType,
  recipients: Array<Recipient>,
  changeAddress: string,
  changeValue: BigNumber,
  inputUTXOs: UTXO[],
  inputDerivation: TapBip32Derivation[] | undefined,
  taprootScript: Buffer,
  tapInternalKey: Buffer,
): Promise<Psbt> {
  const btcNetwork = network === 'Mainnet' ? networks.bitcoin : networks.testnet;
  const psbt = new Psbt({ network: btcNetwork });

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

  psbt.addOutputs(
    recipients.map((value) => ({
      address: value.address,
      value: value.amountSats.toNumber(),
    })),
  );

  if (changeValue.toNumber() > 0) {
    psbt.addOutput({
      address: changeAddress,
      value: changeValue.toNumber(),
    });
  }

  return psbt;
}

/**
 * This function is used to create a mixed transaction for the ledger (native segwit + taproot)
 * @param network - the network type (Mainnet or Testnet)
 * @param recipients - an array of recipients of the transaction
 * @param changeAddress - the change address where the change will be sent to
 * @param changeValue - the value of the remaining balance after the transaction has been completed
 * @param inputUTXOs - the selected input utxos
 * @param inputDerivation - the derivation data for the sender address
 * @returns the psbt without any signatures
 * */
export async function createMixedPsbt(
  network: NetworkType,
  recipients: Array<Recipient>,
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

  const transactionMap: Record<string, Buffer> = {};

  await Promise.all(
    inputUTXOs.map(async (utxo) => {
      const txDataApiUrl = `${network === 'Mainnet' ? MAINNET_BROADCAST_URI : TESTNET_BROADCAST_URI}/${utxo.txid}/hex`;
      const response = await axios.get(txDataApiUrl);
      transactionMap[utxo.txid] = Buffer.from(response.data, 'hex');
    }),
  );

  for (const utxo of inputUTXOs) {
    if (utxo.address === changeAddress) {
      // Adding Segwit input
      psbt.addInput({
        hash: utxo.txid,
        index: utxo.vout,
        // both nonWitnessUtxo and witnessUtxo are required or the ledger displays warning message
        witnessUtxo: {
          script: witnessScript,
          value: utxo.value,
        },
        nonWitnessUtxo: transactionMap[utxo.txid],
        bip32Derivation: inputDerivation,
      });
    } else {
      psbt.addInput({
        hash: utxo.txid,
        index: utxo.vout,
        witnessUtxo: {
          script: taprootScript,
          value: utxo.value,
        },
        tapBip32Derivation: taprootInputDerivation,
        tapInternalKey,
      });
    }
  }

  psbt.addOutputs(
    recipients.map((value) => ({
      address: value.address,
      value: value.amountSats.toNumber(),
    })),
  );

  if (changeValue.toNumber() > 0) {
    psbt.addOutput({
      address: changeAddress,
      value: changeValue.toNumber(),
    });
  }

  return psbt;
}
