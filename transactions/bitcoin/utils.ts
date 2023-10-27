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
// these are conservative estimates
const ESTIMATED_VBYTES_PER_OUTPUT = 45; // actually around 50
const ESTIMATED_VBYTES_PER_INPUT = 85; // actually around 89 or 90

const DUST_VALUE = 546;

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

const extractUsedOutpoints = (transaction: Transaction): Set<string> => {
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

const getTransactionTotals = async (context: TransactionContext, transaction: Transaction) => {
  let inputValue = 0n;
  let outputValue = 0n;

  const inputCount = transaction.inputsLength;
  for (let i = 0; i < inputCount; i++) {
    const input = transaction.getInput(i);

    if (!input.txid || (!input.index && input.index !== 0)) {
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
  const returnedInscriptionIds: string[] = [];
  const sentInscriptionIds: string[] = [];
  const spentUnconfirmedUtxos: ExtendedUtxo[] = [];

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
      // we have a validator to ensure that if an action is spendable, then all must be spendable
      // and are to the payment address (for UTXO consolidation)
      // so, any funds would go to the payment address as change at the end, so no need for an output
      // so, we only add an output for non-spendable actions
      context.addOutputAddress(transaction, action.toAddress, BigInt(extendedUtxo.utxo.value));
    }

    if (extendedUtxo.hasInscriptions) {
      if (context.paymentAddress.address === action.toAddress || context.ordinalsAddress.address === action.toAddress) {
        returnedInscriptionIds.push(...extendedUtxo.inscriptions.map((i) => i.id));
      } else {
        sentInscriptionIds.push(...extendedUtxo.inscriptions.map((i) => i.id));
      }
    }
    if (extendedUtxo.utxo.status.confirmed === false) {
      spentUnconfirmedUtxos.push(extendedUtxo);
    }

    const inputIndex = transaction.inputsLength - 1;
    signActionList.push((txn) => addressContext.signInput(txn, inputIndex));
  }

  return {
    signActionList,
    returnedInscriptionIds,
    sentInscriptionIds,
    spentUnconfirmedUtxos,
  };
};

export const applySplitUtxoActions = async (
  context: TransactionContext,
  options: CompilationOptions,
  transaction: Transaction,
  actions: SplitUtxoAction[],
) => {
  const signActionList: SignActions = [];
  const usedOutpoints = extractUsedOutpoints(transaction);
  const returnedInscriptionIds: string[] = [];
  const sentInscriptionIds: string[] = [];
  const spentUnconfirmedUtxos: ExtendedUtxo[] = [];

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

    if (extendedUtxo.utxo.status.confirmed === false) {
      spentUnconfirmedUtxos.push(extendedUtxo);
    }

    addressContext.addInput(transaction, extendedUtxo, options);

    // TODO: use data from UTXO cache here
    // TODO: add rare sats to the outputs
    // TODO: add sattributes to the outputs
    // sort from smallest to biggest
    outpointActions.sort((a, b) => getOffsetFromLocation(a.location) - getOffsetFromLocation(b.location));

    const utxoInscriptionOffsets = (
      await Promise.all(extendedUtxo.inscriptions.map((inscriptionItem) => inscriptionItem.inscription))
    ).map<[string, number]>((inscription) => [inscription.id, +inscription.offset]);

    for (let i = 0; i < outpointActions.length; i++) {
      const action = outpointActions[i];
      const { location, toAddress } = action;
      const offset = getOffsetFromLocation(location);

      if (offset < 0) {
        throw new Error(`Cannot split offset ${offset} on  ${extendedUtxo.outpoint} as it is negative`);
      }

      if (i === 0 && offset > 0) {
        // if first offset is not 0, then we need to add an output for the remainder from the beginning of the UTXO
        // This will return to the address where the UTXO is from
        if (offset < DUST_VALUE) {
          throw new Error(
            `Cannot split offset ${offset} on  ${extendedUtxo.outpoint} as it the first output would be below dust`,
          );
        }
        context.addOutputAddress(transaction, extendedUtxo.utxo.address, BigInt(offset));

        returnedInscriptionIds.push(
          ...utxoInscriptionOffsets.filter(([, inscriptionOffset]) => inscriptionOffset < offset).map(([id]) => id),
        );
      }

      const nextAction = outpointActions[i + 1];
      const outputEndOffset = nextAction ? getOffsetFromLocation(nextAction.location) : extendedUtxo.utxo.value;

      // validate there are enough sats
      if (outputEndOffset - offset < DUST_VALUE) {
        throw new Error(`Cannot split offset ${offset} on  ${extendedUtxo.outpoint} as there are not enough sats`);
      }
      context.addOutputAddress(transaction, toAddress, BigInt(outputEndOffset - offset));

      // check which inscriptions are being sent and where
      const affectedInscriptionIds = utxoInscriptionOffsets
        .filter(([, inscriptionOffset]) => offset <= inscriptionOffset && inscriptionOffset < outputEndOffset)
        .map(([id]) => id);
      if (context.paymentAddress.address === toAddress || context.ordinalsAddress.address === toAddress) {
        returnedInscriptionIds.push(...affectedInscriptionIds);
      } else {
        sentInscriptionIds.push(...affectedInscriptionIds);
      }
    }

    // add input signing
    const inputIndex = transaction.inputsLength - 1;
    signActionList.push((txn) => addressContext.signInput(txn, inputIndex));
  }

  return { signActionList, returnedInscriptionIds, sentInscriptionIds, spentUnconfirmedUtxos };
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
  const returnedInscriptionIds: string[] = [];
  const sentInscriptionIds: string[] = [];
  const feeInscriptionIds: string[] = [];
  const spentUnconfirmedUtxos: ExtendedUtxo[] = [];
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
  const unusedPaymentUtxos = (await context.paymentAddress.getNonOrdinalUtxos()).filter(
    (utxoData) => !usedOutpoints.has(utxoData.outpoint),
  );

  // sort smallest to biggest as we'll be popping off the end
  // also, unconfirmed and inscribed UTXOs are de-prioritized
  unusedPaymentUtxos.sort((a, b) => {
    if (a.hasInscriptions && !b.hasInscriptions) {
      return -1;
    }
    if (b.hasInscriptions && !a.hasInscriptions) {
      return 1;
    }
    if (a.utxo.status.confirmed && !b.utxo.status.confirmed) {
      return 1;
    }
    if (b.utxo.status.confirmed && !a.utxo.status.confirmed) {
      return -1;
    }
    const diff = a.utxo.value - b.utxo.value;
    if (diff !== 0) {
      return diff;
    }
    // this is just for consistent sorting
    return a.outpoint.localeCompare(b.outpoint);
  });

  // add inputs and outputs for the required actions
  let { inputValue: totalToSend, outputValue: totalSent } = await getTransactionTotals(context, transaction);

  let hangingInscriptionIds: string[] = [];
  for (const [toAddress, { combinableAmount, individualAmounts }] of Object.entries(addressSendMap)) {
    if (context.paymentAddress.address === toAddress || context.ordinalsAddress.address === toAddress) {
      returnedInscriptionIds.push(...hangingInscriptionIds);
    } else {
      sentInscriptionIds.push(...hangingInscriptionIds);
    }

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

      context.paymentAddress.addInput(transaction, utxoToUse, options);

      totalSent += BigInt(utxoToUse.utxo.value);

      // figure out which inscriptions are being sent and where
      const amountLeftFromUtxo = totalSent > totalToSend ? totalSent - totalToSend : 0n;
      const amountUsedFromUtxo = BigInt(utxoToUse.utxo.value) - amountLeftFromUtxo;

      const utxoInscriptions = await Promise.all(
        utxoToUse.inscriptions.map((inscriptionItem) => inscriptionItem.inscription),
      );
      const usedInscriptionIds = utxoInscriptions.filter((i) => +i.offset < amountUsedFromUtxo).map((i) => i.id);
      hangingInscriptionIds = utxoInscriptions.filter((i) => +i.offset >= amountUsedFromUtxo).map((i) => i.id);

      if (context.paymentAddress.address === toAddress || context.ordinalsAddress.address === toAddress) {
        returnedInscriptionIds.push(...usedInscriptionIds);
      } else {
        sentInscriptionIds.push(...usedInscriptionIds);
      }

      if (utxoToUse.utxo.status.confirmed === false) {
        spentUnconfirmedUtxos.push(utxoToUse);
      }

      // add input signing actions
      const inputIndex = transaction.inputsLength - 1;
      signActionList.push((txn) => context.paymentAddress.signInput(txn, inputIndex));
    }
  }

  feeInscriptionIds.push(...hangingInscriptionIds);

  // ensure inputs cover the fee at desired fee rate
  let complete = false;
  let actualFee = 0n;

  while (!complete) {
    const currentChange = totalSent - totalToSend;

    // use this to get a conservative estimate of the fees so we don't compile too many transactions below
    const totalEstimatedFee =
      (transaction.inputsLength * ESTIMATED_VBYTES_PER_INPUT +
        transaction.outputsLength * ESTIMATED_VBYTES_PER_OUTPUT) *
      feeRate;

    if (totalEstimatedFee < currentChange) {
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
    }

    let utxoToUse = unusedPaymentUtxos.pop();

    // ensure UTXO is not dust at selected fee rate
    while (utxoToUse && ESTIMATED_VBYTES_PER_INPUT * feeRate > utxoToUse.utxo.value) {
      utxoToUse = unusedPaymentUtxos.pop();
    }

    if (!utxoToUse) {
      throw new Error('No more UTXOs to use. Insufficient funds for this transaction');
    }

    totalSent += BigInt(utxoToUse.utxo.value);
    context.paymentAddress.addInput(transaction, utxoToUse, options);

    if (utxoToUse.hasInscriptions) {
      feeInscriptionIds.push(...utxoToUse.inscriptions.map((i) => i.id));
    }
    if (utxoToUse.utxo.status.confirmed === false) {
      spentUnconfirmedUtxos.push(utxoToUse);
    }

    const inputIndex = transaction.inputsLength - 1;
    signActionList.push((txn) => context.paymentAddress.signInput(txn, inputIndex));
  }

  return {
    actualFee,
    signActions: signActionList,
    returnedInscriptionIds,
    sentInscriptionIds,
    feeInscriptionIds,
    spentUnconfirmedUtxos,
  };
};
