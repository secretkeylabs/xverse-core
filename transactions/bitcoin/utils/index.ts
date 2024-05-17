import { SigHash, Transaction } from '@scure/btc-signer';
import { UTXO } from '../../../types';
import { TransactionContext } from '../context';
import { ExtendedDummyUtxo, ExtendedUtxo } from '../extendedUtxo';
import { Action, ActionMap, ActionType, EnhancedInput, IOInscription, IOSatribute, TransactionOutput } from '../types';
import { estimateVSize } from './transactionVsizeEstimator';

export const areByteArraysEqual = (a?: Uint8Array, b?: Uint8Array): boolean => {
  if (!a || !b || a.length !== b.length) {
    return false;
  }

  return a.every((v, i) => v === b[i]);
};

export const getOutpoint = (transactionId: string, vout: string | number) => {
  return `${transactionId}:${vout}`;
};

export const getOutpointFromLocation = (location: string) => {
  const [txid, vout] = location.split(':');
  return getOutpoint(txid, vout);
};

export const getOffsetFromLocation = (location: string) => {
  const [, , offset] = location.split(':');
  return +offset;
};

export const getOutpointFromUtxo = (utxo: UTXO) => {
  return getOutpoint(utxo.txid, utxo.vout);
};

export const extractActionMap = (actions: Action[]): ActionMap => {
  const actionMap = {
    [ActionType.SEND_UTXO]: [],
    [ActionType.SPLIT_UTXO]: [],
    [ActionType.SEND_BTC]: [],
    [ActionType.SCRIPT]: [],
  } as ActionMap;
  for (const action of actions) {
    const actionType = action.type;
    actionMap[actionType].push(action);
  }

  const reservedUtxos = new Set<string>();

  for (const action of actionMap[ActionType.SPLIT_UTXO]) {
    reservedUtxos.add(getOutpointFromLocation(action.location));
  }

  for (const action of actionMap[ActionType.SEND_UTXO]) {
    const outpoint = action.outpoint;
    if (reservedUtxos.has(outpoint)) {
      throw new Error(`duplicate UTXO being spent: ${outpoint}`);
    }
    reservedUtxos.add(outpoint);
  }

  return actionMap;
};

export const getSortedAvailablePaymentUtxos = async (
  context: TransactionContext,
  excludeOutpointList: Set<string>,
  confirmedOnly: boolean,
  dustThreshold = 0,
) => {
  const unusedPaymentUtxos = (await context.paymentAddress.getUtxos()).filter(
    (utxoData) =>
      !excludeOutpointList.has(utxoData.outpoint) &&
      (!confirmedOnly || utxoData.utxo.status.confirmed) &&
      utxoData.utxo.value > dustThreshold,
  );

  // sort smallest to biggest as we'll be popping off the end
  unusedPaymentUtxos.sort((a, b) => {
    const diff = a.utxo.value - b.utxo.value;
    if (diff !== 0) {
      return diff;
    }
    // this is just for consistent sorting
    return a.outpoint.localeCompare(b.outpoint);
  });

  return unusedPaymentUtxos;
};

export const getTransactionTotals = async (transaction: Transaction) => {
  let inputValue = 0n;
  let outputValue = 0n;

  const inputCount = transaction.inputsLength;
  for (let i = 0; i < inputCount; i++) {
    const input = transaction.getInput(i);

    // inputs don't necessarily have amounts, they could be dummy inputs for partial PSBT signing
    if (input.witnessUtxo?.amount) {
      inputValue += input.witnessUtxo.amount;
    }
  }

  const outputCount = transaction.outputsLength;
  for (let i = 0; i < outputCount; i++) {
    const output = transaction.getOutput(i);

    // outputs don't necessarily have amounts, they could be script or dummy outputs
    if (output.amount) {
      outputValue += output.amount;
    }
  }

  return { inputValue, outputValue };
};

export const getTransactionVSize = (
  context: TransactionContext,
  transaction: Transaction,
  changeAddress = '',
  change = 546n,
) => {
  if (transaction.isFinal) {
    return transaction.vsize;
  }

  const transactionCopy = transaction.clone();

  if (changeAddress) {
    context.addOutputAddress(transactionCopy, changeAddress, change);
  }

  return estimateVSize(transactionCopy);
};

export const extractUsedOutpoints = (transaction: Transaction): Set<string> => {
  const usedOutpoints = new Set<string>();

  const inputCount = transaction.inputsLength;
  for (let i = 0; i < inputCount; i++) {
    const input = transaction.getInput(i);

    if (!input.txid || (!input.index && input.index !== 0)) {
      throw new Error(`Invalid input found on transaction at index ${i}`);
    }

    const outpoint = getOutpoint(Buffer.from(input.txid).toString('hex'), input.index);
    usedOutpoints.add(outpoint);
  }

  return usedOutpoints;
};

export const extractOutputInscriptionsAndSatributes = async (
  inputs: (ExtendedUtxo | ExtendedDummyUtxo)[],
  outputOffset: number,
  outputValue: number,
) => {
  const inscriptions: TransactionOutput['inscriptions'] = [];
  const satributes: TransactionOutput['satributes'] = [];

  let runningOffset = 0;
  for (const input of inputs) {
    if (runningOffset + input.utxo.value > outputOffset) {
      const inputBundleData = await input.getBundleData();
      const fromAddress = input.address;

      const outputInscriptions = inputBundleData?.sat_ranges
        .flatMap((s) =>
          s.inscriptions.map((i) => ({
            id: i.id,
            offset: runningOffset + s.offset - outputOffset,
            fromAddress,
            number: i.inscription_number,
            contentType: i.content_type,
          })),
        )
        .filter((i) => i.offset >= 0 && i.offset < outputValue);

      const outputSatributes = inputBundleData?.sat_ranges
        .filter((s) => s.satributes.length > 0)
        .map((s) => {
          const min = Math.max(runningOffset + s.offset - outputOffset, 0);
          const max = Math.min(
            runningOffset + s.offset + Number(BigInt(s.range.end) - BigInt(s.range.start)) - outputOffset,
            outputValue,
          );

          return {
            types: s.satributes,
            amount: max - min,
            offset: min,
            fromAddress,
          };
        })
        .filter((i) => i.offset >= 0 && i.offset < outputValue && i.amount > 0);

      inscriptions.push(...(outputInscriptions || []));
      satributes.push(...(outputSatributes || []));
    }

    runningOffset += input.utxo.value;

    if (runningOffset >= outputOffset + outputValue) {
      break;
    }
  }

  return { inscriptions, satributes };
};

export const mapInputToEnhancedInput = async (
  input: ExtendedUtxo | ExtendedDummyUtxo,
  sigHash?: SigHash,
): Promise<EnhancedInput> => {
  const bundleData = await input.getBundleData();

  const inscriptions: IOInscription[] =
    bundleData?.sat_ranges
      .filter((r) => r.inscriptions.length > 0)
      .flatMap((r) =>
        r.inscriptions.map((i) => ({
          fromAddress: input.address,
          id: i.id,
          offset: r.offset,
          number: i.inscription_number,
          contentType: i.content_type,
        })),
      ) || [];
  const satributes: IOSatribute[] =
    bundleData?.sat_ranges
      .filter((r) => r.satributes.length > 0)
      .map((r) => ({
        fromAddress: input.address,
        offset: r.offset,
        types: r.satributes,
        amount: +r.range.end - +r.range.start,
      })) || [];

  return {
    extendedUtxo: input,
    sigHash: sigHash,
    inscriptions,
    satributes,
  };
};
