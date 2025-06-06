import { hex } from '@scure/base';
import * as btc from '@scure/btc-signer';
import { Transaction } from '@scure/btc-signer';
import { TransactionContext } from './context';
import { ExtendedUtxo } from './extendedUtxo';
import {
  CompilationOptions,
  ScriptAction,
  SendBtcAction,
  SendUtxoAction,
  SplitUtxoAction,
  TransactionOptions,
  TransactionOutput,
  TransactionScriptOutput,
} from './types';
import {
  extractUsedOutpoints,
  getOffsetFromLocation,
  getOutpointFromLocation,
  getSortedAvailablePaymentUtxos,
  getTransactionTotals,
  getTransactionVSize,
} from './utils';

const DUST_VALUE = 546;

export const applyScriptActions = async (transaction: Transaction, actions: ScriptAction[]) => {
  const outputs: TransactionScriptOutput[] = [];

  for (const action of actions) {
    const { script } = action;
    const amount = 0n;

    const decodedScript = script instanceof Uint8Array ? btc.Script.decode(script) : script;
    const encodedScript = script instanceof Uint8Array ? script : btc.Script.encode(script);

    transaction.addOutput({ script: encodedScript, amount });

    outputs.push({
      type: 'script',
      script: decodedScript.map((i) => (i instanceof Uint8Array ? hex.encode(i) : `${i}`)),
      scriptHex: hex.encode(encodedScript),
      amount: Number(amount),
    });
  }

  return { outputs };
};

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

        outputAmount += extendedUtxo.utxo.value;
      }

      // if output value is 0, then all actions are spendable, so we can skip this
      if (outputAmount > 0) {
        const { script, scriptHex } = context.addOutputAddress(transaction, toAddress, BigInt(outputAmount));

        outputs.push({ type: 'address', amount: outputAmount, address: toAddress, script, scriptHex });
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
        const { script, scriptHex } = context.addOutputAddress(transaction, extendedUtxo.utxo.address, BigInt(offset));
        outputs.push({ type: 'address', amount: offset, address: extendedUtxo.utxo.address, script, scriptHex });
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
        const { script, scriptHex } = context.addOutputAddress(
          transaction,
          toAddress,
          BigInt(outputEndOffset - offset),
        );
        outputs.push({ type: 'address', amount: outputEndOffset - offset, address: toAddress, script, scriptHex });
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
) => {
  /**
   * This overrides the change address from the default payments address. It is used with the transfer action to
   * send all funds to the destination address.
   * */
  const overrideChangeAddress = transactionOptions.overrideChangeAddress;

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

  // add inputs for all pinned utxos
  for (const pinnedOutpoint of transactionOptions.forceIncludeOutpointList ?? []) {
    if (usedOutpoints.has(pinnedOutpoint)) {
      continue;
    }

    const utxo = await context.getUtxo(pinnedOutpoint);

    if (!utxo.addressContext || !utxo.extendedUtxo) {
      throw new Error(`Pinned UTXO not found: ${pinnedOutpoint}`);
    }

    await utxo.addressContext.addInput(transaction, utxo.extendedUtxo, options);
    usedOutpoints.add(pinnedOutpoint);
    inputs.push(utxo.extendedUtxo);
  }

  // first add outputs for the required actions
  for (const [toAddress, { combinableAmount, individualAmounts }] of Object.entries(addressSendMap)) {
    for (const amount of [combinableAmount, ...individualAmounts]) {
      if (amount === 0n) {
        continue;
      }

      const { script, scriptHex } = context.addOutputAddress(transaction, toAddress, amount);
      outputs.push({ type: 'address', amount: Number(amount), address: toAddress, script, scriptHex });
    }
  }

  // now, add inputs to cover the outputs at the desired fee rate
  const { inputValue, outputValue: totalOutputs } = await getTransactionTotals(transaction);
  let totalInputs = inputValue;

  // we get the fee rate for an input of the address (changes per address type)
  const { inputSize } = context.paymentAddress.getIOSizes();
  const inputDustValueAtFeeRate = inputSize * feeRate;

  let complete = false;
  let actualFee = 0n;

  // if we are using effective fee rate, we need to keep track of unconfirmed UTXO details
  let unconfirmedVsize = 0;
  let unconfirmedFee = 0;

  if (transactionOptions.useEffectiveFeeRate) {
    for (const outpoint of usedOutpoints) {
      const utxo = await context.getUtxo(outpoint);
      if (!utxo.extendedUtxo || (utxo.extendedUtxo?.utxo.status.confirmed ?? true)) {
        continue;
      }

      const { totalVsize, totalFee } = await utxo.extendedUtxo.getUnconfirmedUtxoFeeData();
      unconfirmedVsize += totalVsize;
      unconfirmedFee += totalFee;
    }
  }

  let actualFeeRate = feeRate;
  let effectiveFeeRate = feeRate;

  // get available confirmed UTXOs to spend
  let unusedPaymentUtxos = await getSortedAvailablePaymentUtxos(
    context,
    new Set([...(transactionOptions.excludeOutpointList ?? []), ...usedOutpoints]),
    true,
    inputDustValueAtFeeRate,
  );
  let canCoverCostsWithConfirmed = false;

  // check if we can cover the cost with confirmed UTXOs only, otherwise update UTXO list with unconfirmed UTXOs
  if (unusedPaymentUtxos.length) {
    const totalConfirmedInputValue = unusedPaymentUtxos.reduce((acc, utxo) => acc + BigInt(utxo.utxo.value), 0n);
    const totalInputWithConfirmed = totalInputs + totalConfirmedInputValue;

    const dummyTxn = transaction.clone();

    for (const utxo of unusedPaymentUtxos) {
      await context.paymentAddress.addInput(dummyTxn, utxo, options);
    }

    const allConfirmedUtxoTxnVSize = getTransactionVSize(
      context,
      dummyTxn,
      overrideChangeAddress ?? context.changeAddress,
    );

    const totalCostWithConfirmed = totalOutputs + BigInt(allConfirmedUtxoTxnVSize * feeRate);

    canCoverCostsWithConfirmed = totalInputWithConfirmed - totalCostWithConfirmed >= 0n;
  }

  if (!canCoverCostsWithConfirmed && transactionOptions.allowUnconfirmedInput !== false) {
    unusedPaymentUtxos = await getSortedAvailablePaymentUtxos(
      context,
      new Set([...(transactionOptions.excludeOutpointList ?? []), ...usedOutpoints]),
      false,
      inputDustValueAtFeeRate,
    );
  }

  // start adding inputs until we have enough to cover the cost
  const initialTxVSize = getTransactionVSize(context, transaction);
  const initialInputCount = transaction.inputsLength;

  while (!complete) {
    const currentChange = totalInputs - totalOutputs;

    const addedInputs = transaction.inputsLength - initialInputCount;
    const addedVSized = addedInputs * inputSize;

    const currentVSize = initialTxVSize + addedVSized;

    // use this to get a conservative estimate of the fees so we don't estimate too many transactions below
    const totalEstimatedFee = (currentVSize + unconfirmedVsize) * feeRate - unconfirmedFee;

    if (totalEstimatedFee < currentChange) {
      const vSizeWithChange = getTransactionVSize(context, transaction, overrideChangeAddress ?? context.changeAddress);

      if (vSizeWithChange) {
        const feeWithChange = BigInt((vSizeWithChange + unconfirmedVsize) * feeRate - unconfirmedFee);

        if (feeWithChange < currentChange && currentChange - feeWithChange > DUST_VALUE) {
          // we do one last test to ensure that adding close to the actual change won't increase the fees
          const vSizeWithActualChange = getTransactionVSize(
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
            const { script, scriptHex } = context.addOutputAddress(
              transaction,
              overrideChangeAddress ?? context.changeAddress,
              change,
            );
            outputs.push({
              type: 'address',
              amount: Number(change),
              address: overrideChangeAddress ?? context.changeAddress,
              script,
              scriptHex,
            });

            complete = true;
            break;
          }
        }
      }

      // it's possible that we have no outputs at this point as this could be something like a recover btc txn
      // and we'd expect all the funds to be sent as change. In this case, we cannot have a txn with no change,
      // so the below if statement would not be true and we'd try build it again with change.
      if (transaction.outputsLength > 0) {
        const vSizeNoChange = getTransactionVSize(context, transaction);

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
    }

    const utxoToUse = unusedPaymentUtxos.pop();

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
    dustValue: BigInt(inputDustValueAtFeeRate),
  };
};
