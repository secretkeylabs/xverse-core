import { Transaction } from '@scure/btc-signer';

import { UTXO } from '../../types';

import { hex } from '@scure/base';
import { ExtendedUtxo, TransactionContext } from './context';
import {
  Action,
  ActionMap,
  ActionType,
  CompilationOptions,
  SendBtcAction,
  SendUtxoAction,
  SplitUtxoAction,
  TransactionOutput,
} from './types';
// these are conservative estimates
const ESTIMATED_VBYTES_PER_OUTPUT = 45; // actually around 50
const ESTIMATED_VBYTES_PER_INPUT = 85; // actually around 89 or 90

const DUST_VALUE = 546;
const dummyPrivateKey = '0000000000000000000000000000000000000000000000000000000000000001';

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

export const dummySignTransaction = async (context: TransactionContext, transaction: Transaction) => {
  const dummyPrivateKeyBuffer = hex.decode(dummyPrivateKey);
  await context.paymentAddress.toDummyInputs(transaction, dummyPrivateKeyBuffer);
  await context.ordinalsAddress.toDummyInputs(transaction, dummyPrivateKeyBuffer);
  transaction.sign(dummyPrivateKeyBuffer);
};

const getTransactionVSize = async (context: TransactionContext, transaction: Transaction, withChange = false) => {
  try {
    const transactionCopy = Transaction.fromPSBT(transaction.toPSBT(), transaction.opts);

    if (withChange) {
      context.addOutputAddress(transactionCopy, context.changeAddress, 546n);
    }

    await dummySignTransaction(context, transactionCopy);

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
  const usedOutpoints = extractUsedOutpoints(transaction);

  const inputs: ExtendedUtxo[] = [];
  const outputs: Omit<TransactionOutput, 'inscriptions' | 'satributes'>[] = [];

  const actionMap = actions.reduce((acc, action) => {
    const { toAddress } = action;
    if (!acc[toAddress]) {
      acc[toAddress] = [[], []];
    }
    const [singular, combinable] = acc[toAddress];
    if (action.combinable) {
      acc[toAddress] = [singular, [...combinable, action]];
    } else {
      acc[toAddress] = [[...singular, action], combinable];
    }
    return acc;
  }, {} as Record<string, [SendUtxoAction[], SendUtxoAction[]]>);

  for (const [toAddress, [singular, combinable]] of Object.entries(actionMap)) {
    const actionGroups = [...singular.map((action) => [action]), combinable];

    for (const actionGroup of actionGroups) {
      let outputAmount = 0;

      for (const action of actionGroup) {
        const { extendedUtxo, addressContext } = await context.getUtxo(action.outpoint);

        if (!extendedUtxo || !addressContext) {
          throw new Error(`UTXO not found: ${action.outpoint}`);
        }

        if (usedOutpoints.has(action.outpoint)) {
          throw new Error(`UTXO already used: ${action.outpoint}`);
        }

        await addressContext.addInput(transaction, extendedUtxo, options);
        inputs.push(extendedUtxo);

        if (!action.spendable) {
          // we have a validator to ensure that if an action is spendable, then all must be spendable
          // and are to the same address (for UTXO consolidation or max send)
          // so, any funds would go to the address as change at the end, so no need for an output
          // so, we only add an output for non-spendable actions
          outputAmount += extendedUtxo.utxo.value;
        }
      }

      // if output value is 0, then all actions are spendable, so we can skip this
      if (outputAmount > 0) {
        context.addOutputAddress(transaction, toAddress, BigInt(outputAmount));
        outputs.push({ amount: outputAmount, address: toAddress });
      }
    }
  }

  return {
    inputs,
    outputs,
  };
};

export const applySplitUtxoActions = async (
  context: TransactionContext,
  options: CompilationOptions,
  transaction: Transaction,
  actions: SplitUtxoAction[],
) => {
  const usedOutpoints = extractUsedOutpoints(transaction);

  const inputs: ExtendedUtxo[] = [];
  const outputs: Omit<TransactionOutput, 'inscriptions' | 'satributes'>[] = [];

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

  const outpointActionList = Object.entries(outpointActionMap);
  // sort internal actions from smallest offset to biggest
  outpointActionList.forEach(([, outpointActions]) => {
    outpointActions.sort((a, b) => getOffsetFromLocation(a.location) - getOffsetFromLocation(b.location));
  });
  // place spendable actions last
  outpointActionList.sort(([, outpointActionsA], [, outpointActionsB]) => {
    const aIsSpendable = outpointActionsA[outpointActionsA.length - 1];
    const bIsSpendable = outpointActionsB[outpointActionsA.length - 1];

    if (aIsSpendable && !bIsSpendable) {
      return 1;
    }

    if (bIsSpendable && !aIsSpendable) {
      return -1;
    }

    return 0;
  });

  // Process actions for each outpoint
  for (let oi = 0; oi < outpointActionList.length; oi++) {
    const [outpoint, outpointActions] = outpointActionList[oi];

    const { extendedUtxo, addressContext } = await context.getUtxo(outpoint);

    if (!extendedUtxo || !addressContext) {
      throw new Error(`UTXO for outpoint not found: ${outpoint}`);
    }

    await addressContext.addInput(transaction, extendedUtxo, options);
    inputs.push(extendedUtxo);

    for (let i = 0; i < outpointActions.length; i++) {
      const action = outpointActions[i];
      const { location } = action;
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
        outputs.push({ amount: offset, address: extendedUtxo.utxo.address });
      }

      const nextAction = outpointActions[i + 1];
      const isLastActionOfLastSplitActions = !nextAction && !outpointActionList[oi + 1];

      if (!isLastActionOfLastSplitActions || !action.spendable) {
        const outputEndOffset = nextAction ? getOffsetFromLocation(nextAction.location) : extendedUtxo.utxo.value;

        // validate there are enough sats
        if (outputEndOffset - offset < DUST_VALUE) {
          throw new Error(`Cannot split offset ${offset} on  ${extendedUtxo.outpoint} as there are not enough sats`);
        }

        // if a split action is spendable but is not the last output, then we need to return the value to the
        // payment to the originating address
        const toAddress = action.spendable ? extendedUtxo.utxo.address : action.toAddress;
        context.addOutputAddress(transaction, toAddress, BigInt(outputEndOffset - offset));
        outputs.push({ amount: outputEndOffset - offset, address: toAddress });
      }
    }
  }

  return { inputs, outputs };
};

export const applySendBtcActionsAndFee = async (
  context: TransactionContext,
  options: CompilationOptions,
  transaction: Transaction,
  actions: SendBtcAction[],
  feeRate: number,
  /**
   * This overrides the change address from the default payments address. It is used with the transfer action to
   * send all funds to the destination address (with spendable and combinable set to true)
   * */
  overrideChangeAddress?: string,
) => {
  const usedOutpoints = extractUsedOutpoints(transaction);

  const inputs: ExtendedUtxo[] = [];
  const outputs: Omit<TransactionOutput, 'inscriptions' | 'satributes'>[] = [];

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
  const unusedPaymentUtxosRaw = (await context.paymentAddress.getUtxos()).filter(
    (utxoData) => !usedOutpoints.has(utxoData.outpoint),
  );

  const unusedPaymentUtxosWithState = await Promise.all(
    unusedPaymentUtxosRaw.map(async (extendedUtxo) => {
      const isEmbellished = await extendedUtxo.isEmbellished();
      return { extendedUtxo, isEmbellished };
    }),
  );

  // sort smallest to biggest as we'll be popping off the end
  // also, unconfirmed and inscribed UTXOs are de-prioritized
  unusedPaymentUtxosWithState.sort((a, b) => {
    if (a.isEmbellished && !b.isEmbellished && b.isEmbellished !== undefined) {
      return -1;
    }
    if (b.isEmbellished && !a.isEmbellished && a.isEmbellished !== undefined) {
      return 1;
    }
    if (a.extendedUtxo.utxo.status.confirmed && !b.extendedUtxo.utxo.status.confirmed) {
      return 1;
    }
    if (b.extendedUtxo.utxo.status.confirmed && !a.extendedUtxo.utxo.status.confirmed) {
      return -1;
    }
    const diff = a.extendedUtxo.utxo.value - b.extendedUtxo.utxo.value;
    if (diff !== 0) {
      return diff;
    }
    // this is just for consistent sorting
    return a.extendedUtxo.outpoint.localeCompare(b.extendedUtxo.outpoint);
  });

  const unusedPaymentUtxos = unusedPaymentUtxosWithState.map((u) => u.extendedUtxo);

  // add inputs and outputs for the required actions
  let { inputValue: totalInputs, outputValue: totalOutputs } = await getTransactionTotals(context, transaction);

  for (const [toAddress, { combinableAmount, individualAmounts }] of Object.entries(addressSendMap)) {
    totalOutputs += combinableAmount;

    for (const amount of individualAmounts) {
      totalOutputs += amount;
    }

    while (totalOutputs > totalInputs) {
      const utxoToUse = unusedPaymentUtxos.pop();

      if (!utxoToUse) {
        throw new Error('No more UTXOs to use. Insufficient funds for this transaction');
      }

      await context.paymentAddress.addInput(transaction, utxoToUse, options);
      inputs.push(utxoToUse);

      totalInputs += BigInt(utxoToUse.utxo.value);
    }

    for (const amount of [combinableAmount, ...individualAmounts]) {
      if (amount === 0n) {
        continue;
      }

      context.addOutputAddress(transaction, toAddress, amount);
      outputs.push({ amount: Number(amount), address: toAddress });
    }
  }

  // ensure inputs cover the fee at desired fee rate
  let complete = false;
  let actualFee = 0n;

  while (!complete) {
    const currentChange = totalInputs - totalOutputs;

    // use this to get a conservative estimate of the fees so we don't compile too many transactions below
    const totalEstimatedFee =
      (transaction.inputsLength * ESTIMATED_VBYTES_PER_INPUT +
        transaction.outputsLength * ESTIMATED_VBYTES_PER_OUTPUT) *
      feeRate;

    if (totalEstimatedFee < currentChange) {
      const vSizeWithChange = await getTransactionVSize(context, transaction, true);

      if (vSizeWithChange) {
        const feeWithChange = BigInt(vSizeWithChange * feeRate);

        if (feeWithChange < currentChange && currentChange - feeWithChange > DUST_VALUE) {
          actualFee = feeWithChange;
          const change = currentChange - feeWithChange;
          context.addOutputAddress(transaction, overrideChangeAddress ?? context.changeAddress, change);
          outputs.push({ amount: Number(change), address: overrideChangeAddress ?? context.changeAddress });

          complete = true;
          break;
        }
      }

      const vSizeNoChange = await getTransactionVSize(context, transaction);

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

    totalInputs += BigInt(utxoToUse.utxo.value);
    await context.paymentAddress.addInput(transaction, utxoToUse, options);
    inputs.push(utxoToUse);
  }

  return {
    actualFee,
    inputs,
    outputs,
  };
};
