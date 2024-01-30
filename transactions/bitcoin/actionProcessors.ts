import { Transaction } from '@scure/btc-signer';
import { TransactionContext } from './context';
import { ExtendedUtxo } from './extendedUtxo';
import {
  CompilationOptions,
  SendBtcAction,
  SendUtxoAction,
  SplitUtxoAction,
  TransactionOptions,
  TransactionOutput,
} from './types';
import {
  extractUsedOutpoints,
  getOffsetFromLocation,
  getOutpointFromLocation,
  getSortedAvailablePaymentUtxos,
  getTransactionTotals,
  getTransactionVSize,
  getVbytesForIO,
} from './utils';

// these are conservative estimates
const ESTIMATED_VBYTES_PER_OUTPUT = 30; // actually around 40
const ESTIMATED_VBYTES_PER_INPUT = 70; // actually from 75 upward

const DUST_VALUE = 546;

export const applySendUtxoActions = async (
  context: TransactionContext,
  options: CompilationOptions,
  transaction: Transaction,
  transactionOptions: TransactionOptions,
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
        if (transactionOptions.excludeOutpointList?.includes(action.outpoint)) {
          throw new Error(`UTXO excluded but used in send UTXO action: ${action.outpoint}`);
        }

        const { extendedUtxo, addressContext } = await context.getUtxo(action.outpoint);

        if (!extendedUtxo || !addressContext) {
          throw new Error(`UTXO not found: ${action.outpoint}`);
        }

        if (usedOutpoints.has(action.outpoint)) {
          throw new Error(`UTXO already used: ${action.outpoint}`);
        }

        await addressContext.addInput(transaction, extendedUtxo, options);
        inputs.push(extendedUtxo);
        usedOutpoints.add(action.outpoint);

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
  transactionOptions: TransactionOptions,
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
    const aIsSpendable = outpointActionsA[outpointActionsA.length - 1].spendable;
    const bIsSpendable = outpointActionsB[outpointActionsB.length - 1].spendable;

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

    if (transactionOptions.excludeOutpointList?.includes(outpoint)) {
      throw new Error(`UTXO excluded but used in split UTXO action: ${outpoint}`);
    }

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
  transactionOptions: TransactionOptions,
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
  const unusedPaymentUtxos = await getSortedAvailablePaymentUtxos(
    context,
    new Set([...(transactionOptions.excludeOutpointList ?? []), ...usedOutpoints]),
  );

  // add inputs and outputs for the required actions
  let { inputValue: totalInputs, outputValue: totalOutputs } = await getTransactionTotals(transaction);

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

  // we get the exact fee rate for an input of the address (changes per address type)
  const { inputSize } = await getVbytesForIO(context, context.paymentAddress);
  const inputDustValueAtFeeRate = BigInt(inputSize * feeRate);

  let unconfirmedVsize = 0;
  let unconfirmedFee = 0;

  let actualFeeRate = feeRate;
  let effectiveFeeRate = feeRate;

  while (!complete) {
    const currentChange = totalInputs - totalOutputs;

    // use this to get a conservative estimate of the fees so we don't compile too many transactions below
    const totalEstimatedFee =
      (transaction.inputsLength * ESTIMATED_VBYTES_PER_INPUT +
        transaction.outputsLength * ESTIMATED_VBYTES_PER_OUTPUT +
        unconfirmedVsize) *
        feeRate -
      unconfirmedFee;

    if (totalEstimatedFee < currentChange) {
      const vSizeWithChange = await getTransactionVSize(
        context,
        transaction,
        overrideChangeAddress ?? context.changeAddress,
      );

      if (vSizeWithChange) {
        const feeWithChange = BigInt((vSizeWithChange + unconfirmedVsize) * feeRate - unconfirmedFee);

        if (feeWithChange < currentChange && currentChange - feeWithChange > DUST_VALUE) {
          // we do one last test to ensure that adding close to the actual change won't increase the fees
          const vSizeWithActualChange = await getTransactionVSize(
            context,
            transaction,
            overrideChangeAddress ?? context.changeAddress,
            currentChange - feeWithChange,
          );

          const finalVSizeWithChange = Math.max(vSizeWithActualChange ?? vSizeWithChange, vSizeWithChange);

          if (finalVSizeWithChange) {
            actualFee = BigInt((finalVSizeWithChange + unconfirmedVsize) * feeRate - unconfirmedFee);
            actualFeeRate = Number(actualFee) / finalVSizeWithChange;
            effectiveFeeRate = (Number(actualFee) + unconfirmedFee) / (finalVSizeWithChange + unconfirmedVsize);

            const change = currentChange - actualFee;
            context.addOutputAddress(transaction, overrideChangeAddress ?? context.changeAddress, change);
            outputs.push({ amount: Number(change), address: overrideChangeAddress ?? context.changeAddress });

            complete = true;
            break;
          }
        }
      }

      const vSizeNoChange = await getTransactionVSize(context, transaction);

      if (vSizeNoChange) {
        const feeWithoutChange = BigInt(vSizeNoChange * feeRate);

        if (feeWithoutChange <= currentChange) {
          actualFee = currentChange;
          actualFeeRate = Number(actualFee) / vSizeNoChange;
          effectiveFeeRate = (Number(actualFee) + unconfirmedFee) / (vSizeNoChange + unconfirmedVsize);
          complete = true;
          break;
        }
      }
    }

    let utxoToUse = unusedPaymentUtxos.pop();

    // ensure UTXO is not dust at selected fee rate and that it is skipped if unconfirmed and not allowed
    while (
      utxoToUse &&
      (inputDustValueAtFeeRate > utxoToUse.utxo.value ||
        (!transactionOptions.allowUnconfirmedInput && !utxoToUse.utxo.status.confirmed))
    ) {
      utxoToUse = unusedPaymentUtxos.pop();
    }

    if (!utxoToUse) {
      throw new Error('No more UTXOs to use. Insufficient funds for this transaction');
    }

    if (transactionOptions.useEffectiveFeeRate) {
      const { totalVsize, totalFee } = await utxoToUse.getUnconfirmedUtxoFeeData();

      unconfirmedVsize += totalVsize;
      unconfirmedFee += totalFee;
    }

    totalInputs += BigInt(utxoToUse.utxo.value);
    await context.paymentAddress.addInput(transaction, utxoToUse, options);
    inputs.push(utxoToUse);
  }

  return {
    actualFeeRate,
    effectiveFeeRate: transactionOptions.useEffectiveFeeRate ? effectiveFeeRate : undefined,
    actualFee,
    inputs,
    outputs,
    dustValue: inputDustValueAtFeeRate,
  };
};
