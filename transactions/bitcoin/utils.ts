import { Transaction } from '@scure/btc-signer';

import { UTXO } from '../../types';

import { ExtendedUtxo, TransactionContext } from './context';
import {
  Action,
  ActionMap,
  ActionType,
  CompilationOptions,
  SendBtcAction,
  SendUtxoAction,
  SplitUtxoAction,
} from './types';

const DUST_VALUE = 1000n;

type SignAction = (transaction: Transaction) => Promise<void>;
type SignActions = SignAction[];

export const getOutpoint = (transactionId: string, vout: string | number) => {
  return `${transactionId}:${vout}`;
};

export const getOutpointFromLocation = (location: string) => {
  const [txid, vout] = location.split(':');
  return getOutpoint(txid, vout);
};

export const getOffsetFromLocation = (location: string) => {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [txid, vout, offset] = location.split(':');
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
  } as ActionMap;
  const reservedUtxos = new Set<string>();

  for (const action of actions) {
    const actionType = action.type;

    if (actionType === ActionType.SEND_UTXO || actionType === ActionType.SPLIT_UTXO) {
      const outpoint = actionType === ActionType.SEND_UTXO ? action.outpoint : getOutpointFromLocation(action.location);

      if (reservedUtxos.has(outpoint)) {
        throw new Error(`duplicate UTXO being spent: ${outpoint}`);
      }

      reservedUtxos.add(outpoint);
    }

    actionMap[actionType].push(action);
  }

  return actionMap;
};

const extractUsedOutpoints = (transaction: Transaction): Set<string> => {
  const usedOutpoints = new Set<string>();

  const inputCount = transaction.inputsLength;
  for (let i = 0; i < inputCount; i++) {
    const input = transaction.getInput(i);

    if (!input.txid || !input.index) {
      throw new Error(`Invalid input found on transaction at index ${i}`);
    }

    const outpoint = getOutpoint(Buffer.from(input.txid).toString('hex'), input.index);
    usedOutpoints.add(outpoint);
  }

  return usedOutpoints;
};

const getTransactionTotals = async (context: TransactionContext, transaction: Transaction) => {
  let inputValue = 0n;
  let outputValue = 0n;

  const inputCount = transaction.inputsLength;
  for (let i = 0; i < inputCount; i++) {
    const input = transaction.getInput(i);

    if (!input.txid || !input.index) {
      throw new Error(`Invalid input found on transaction at index ${i}`);
    }

    const outpoint = getOutpoint(Buffer.from(input.txid).toString('hex'), input.index);
    const { extendedUtxo } = await context.getUtxo(outpoint);

    if (!extendedUtxo) {
      throw new Error(`Transaction input UTXO not found: ${outpoint}`);
    }

    inputValue += BigInt(extendedUtxo.utxo.value);
  }

  const outputCount = transaction.outputsLength;
  for (let i = 0; i < outputCount; i++) {
    const output = transaction.getOutput(i);

    outputValue += output.amount ?? 0n;
  }

  return { inputValue, outputValue };
};

const getTransactionVSize = async (
  context: TransactionContext,
  transaction: Transaction,
  signActionList: SignActions,
  withChange = false,
) => {
  try {
    const transactionCopy = transaction.clone();

    if (withChange) {
      context.addOutputAddress(transactionCopy, context.changeAddress, 546n);
    }

    for (const executeSign of signActionList) {
      await executeSign(transactionCopy);
    }

    transactionCopy.finalize();

    return transactionCopy.vsize;
  } catch (e) {
    if (e.message === 'Outputs spends more than inputs amount') {
      return undefined;
    }
    throw e;
  }
};

export const applySendUtxoActions = async (
  context: TransactionContext,
  options: CompilationOptions,
  transaction: Transaction,
  actions: SendUtxoAction[],
) => {
  const signActionList: SignActions = [];
  const usedOutpoints = extractUsedOutpoints(transaction);
  const spentInscriptionUtxos: ExtendedUtxo[] = [];

  for (const action of actions) {
    const { extendedUtxo, addressContext } = await context.getUtxo(action.outpoint);

    if (!extendedUtxo || !addressContext) {
      throw new Error(`UTXO not found: ${action.outpoint}`);
    }

    if (usedOutpoints.has(action.outpoint)) {
      throw new Error(`UTXO already used: ${action.outpoint}`);
    }

    addressContext.addInput(transaction, extendedUtxo, options);

    if (!action.spendable) {
      // if actions are spendable, then we assume all are to the payment address, so
      // any funds would go to the payment address as change at the end, so no need for an output
      context.addOutputAddress(transaction, action.toAddress, BigInt(extendedUtxo.utxo.value));
    }

    if (extendedUtxo.hasInscriptions) {
      spentInscriptionUtxos.push(extendedUtxo);
    }

    const inputIndex = transaction.inputsLength - 1;
    signActionList.push((txn) => addressContext.signInput(txn, inputIndex));
  }

  return { signActionList, spentInscriptionUtxos };
};

// TODO: finish
export const applySplitUtxoActions = async (
  context: TransactionContext,
  options: CompilationOptions,
  transaction: Transaction,
  actions: SplitUtxoAction[],
) => {
  const signActionList: SignActions = [];
  const usedOutpoints = extractUsedOutpoints(transaction);
  const spentInscriptionUtxos: ExtendedUtxo[] = [];

  // group actions by UTXO
  const outpointActionMap = actions.reduce((map, action) => {
    const { location } = action;
    const outpoint = getOutpointFromLocation(location);

    if (usedOutpoints.has(outpoint)) {
      throw new Error(`UTXO already used: ${outpoint}`);
    }

    if (!(outpoint in map)) {
      map[outpoint] = [];
    }

    map[outpoint].push(action);
    return map;
  }, {} as Record<string, SplitUtxoAction[]>);

  // Process actions for each outpoint
  for (const [outpoint, outpointActions] of Object.entries(outpointActionMap)) {
    const { extendedUtxo, addressContext } = await context.getUtxo(outpoint);

    if (!extendedUtxo || !addressContext) {
      throw new Error(`UTXO for outpoint not found: ${outpoint}`);
    }

    if (extendedUtxo.hasInscriptions) {
      spentInscriptionUtxos.push(extendedUtxo);
    }

    addressContext.addInput(transaction, extendedUtxo, options);

    outpointActions.sort((a, b) => getOffsetFromLocation(a.location) - getOffsetFromLocation(b.location));

    // we make a collection of graphs of an action to the next action so we can calculate the distance between them
    const outpointActionGraph = outpointActions.map((action, index) => {
      return [action, outpointActions[index + 1]] as [SplitUtxoAction, SplitUtxoAction | undefined];
    });

    const currentOffset = 0;
    for (const [action, nextAction] of outpointActionGraph) {
      const { location, maxOutputSatsAmount, minOutputSatsAmount, moveToZeroOffset, toAddress } = action;

      const offset = getOffsetFromLocation(location);
      const offsetFromCurrent = offset - currentOffset;

      context.addOutputAddress(transaction, action.toAddress, BigInt(extendedUtxo.utxo.value));
    }

    const inputIndex = transaction.inputsLength - 1;
    signActionList.push((txn) => addressContext.signInput(txn, inputIndex));
  }

  return { signActionList, spentInscriptionUtxos };
};

export const applySendBtcActionsAndFee = async (
  context: TransactionContext,
  options: CompilationOptions,
  transaction: Transaction,
  actions: SendBtcAction[],
  feeRate: number,
  previousSignActionList: SignActions = [],
) => {
  const signActionList: SignActions = [];
  const spentInscriptionUtxos: ExtendedUtxo[] = [];
  const usedOutpoints = extractUsedOutpoints(transaction);

  // compile amounts to send to each address
  const addressSendMap: { [address: string]: { combinableAmount: bigint; individualAmounts: bigint[] } } = {};
  for (const action of actions) {
    const { amount, combinable, toAddress } = action;

    if (!addressSendMap[toAddress]) {
      addressSendMap[toAddress] = {
        combinableAmount: 0n,
        individualAmounts: [],
      };
    }

    if (combinable) {
      addressSendMap[toAddress].combinableAmount += amount;
    } else {
      addressSendMap[toAddress].individualAmounts.push(amount);
    }
  }

  // get available UTXOs to spend
  const unusedPaymentUtxos = (await context.getSpendableUtxos()).filter(
    (utxoData) => !usedOutpoints.has(utxoData.extendedUtxo.outpoint),
  );

  // sort smallest to biggest as we'll be popping off the end
  // also, inscribed UTXOs are de-prioritized
  unusedPaymentUtxos.sort((a, b) => {
    if (a.extendedUtxo.hasInscriptions && !b.extendedUtxo.hasInscriptions) {
      return -1;
    }
    if (b.extendedUtxo.hasInscriptions && !a.extendedUtxo.hasInscriptions) {
      return 1;
    }
    const diff = a.extendedUtxo.utxo.value - b.extendedUtxo.utxo.value;
    if (diff !== 0) {
      return diff;
    }
    // this is just for consistent sorting
    return a.extendedUtxo.outpoint.localeCompare(b.extendedUtxo.outpoint);
  });

  // add inputs and outputs for the required actions
  let { inputValue: totalToSend, outputValue: totalSent } = await getTransactionTotals(context, transaction);

  for (const [toAddress, { combinableAmount, individualAmounts }] of Object.entries(addressSendMap)) {
    if (combinableAmount > 0) {
      totalToSend += combinableAmount;
      context.addOutputAddress(transaction, toAddress, combinableAmount);
    }

    for (const amount of individualAmounts) {
      totalToSend += amount;
      context.addOutputAddress(transaction, toAddress, amount);
    }

    while (totalSent < totalToSend) {
      const utxoToUse = unusedPaymentUtxos.pop();

      if (!utxoToUse) {
        throw new Error('No more UTXOs to use. Insufficient funds for this transaction');
      }

      totalSent += BigInt(utxoToUse.extendedUtxo.utxo.value);

      utxoToUse.addressContext.addInput(transaction, utxoToUse.extendedUtxo, options);

      if (utxoToUse.extendedUtxo.hasInscriptions) {
        spentInscriptionUtxos.push(utxoToUse.extendedUtxo);
      }

      const inputIndex = transaction.inputsLength - 1;
      signActionList.push((txn) => utxoToUse.addressContext.signInput(txn, inputIndex));
    }
  }

  // ensure inputs cover the fee at desired fee rate
  let complete = false;
  let actualFee = 0n;

  while (!complete) {
    const currentChange = totalSent - totalToSend;

    const vSizeWithChange = await getTransactionVSize(
      context,
      transaction,
      [...previousSignActionList, ...signActionList],
      true,
    );

    if (vSizeWithChange) {
      const feeWithChange = BigInt(vSizeWithChange * feeRate);

      if (feeWithChange < currentChange && currentChange - feeWithChange > DUST_VALUE) {
        actualFee = feeWithChange;
        context.addOutputAddress(transaction, context.changeAddress, currentChange - feeWithChange);
        complete = true;
        break;
      }
    }

    const vSizeNoChange = await getTransactionVSize(context, transaction, [
      ...previousSignActionList,
      ...signActionList,
    ]);

    if (vSizeNoChange) {
      const feeWithoutChange = BigInt(vSizeNoChange * feeRate);

      if (feeWithoutChange < currentChange) {
        actualFee = currentChange;
        complete = true;
        break;
      }
    }

    const utxoToUse = unusedPaymentUtxos.pop();
    if (!utxoToUse) {
      throw new Error('No more UTXOs to use. Insufficient funds for this transaction');
    }

    totalSent += BigInt(utxoToUse.extendedUtxo.utxo.value);
    utxoToUse.addressContext.addInput(transaction, utxoToUse.extendedUtxo, options);

    if (utxoToUse.extendedUtxo.hasInscriptions) {
      spentInscriptionUtxos.push(utxoToUse.extendedUtxo);
    }

    const inputIndex = transaction.inputsLength - 1;
    signActionList.push((txn) => utxoToUse.addressContext.signInput(txn, inputIndex));
  }

  return { actualFee, signActions: signActionList, spentInscriptionUtxos };
};
