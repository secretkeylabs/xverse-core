import { Transaction } from '@scure/btc-signer';
import { UTXO } from '../../types';
import { AddressContext, TransactionContext } from './context';
import { Action, ActionMap, ActionType } from './types';

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

export const getSortedAvailablePaymentUtxos = async (context: TransactionContext, excludeOutpointList: Set<string>) => {
  const unusedPaymentUtxosRaw = (await context.paymentAddress.getUtxos()).filter(
    (utxoData) => !excludeOutpointList.has(utxoData.outpoint),
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

  return unusedPaymentUtxosWithState.map((u) => u.extendedUtxo);
};

export const getTransactionTotals = async (transaction: Transaction) => {
  let inputValue = 0n;
  let outputValue = 0n;

  const inputCount = transaction.inputsLength;
  for (let i = 0; i < inputCount; i++) {
    const input = transaction.getInput(i);

    if (!input.witnessUtxo?.amount) {
      throw new Error(`Invalid input found on transaction at index ${i}`);
    }

    inputValue += input.witnessUtxo.amount;
  }

  const outputCount = transaction.outputsLength;
  for (let i = 0; i < outputCount; i++) {
    const output = transaction.getOutput(i);

    if (!output.amount) {
      throw new Error(`Invalid output found on transaction at index ${i}`);
    }

    outputValue += output.amount;
  }

  return { inputValue, outputValue };
};

export const getTransactionVSize = async (
  context: TransactionContext,
  transaction: Transaction,
  changeAddress = '',
  change = 546n,
) => {
  try {
    const transactionCopy = transaction.clone();

    if (changeAddress) {
      context.addOutputAddress(transactionCopy, changeAddress, change);
    }

    await context.dummySignTransaction(transactionCopy);

    transactionCopy.finalize();

    return transactionCopy.vsize;
  } catch (e) {
    if (e.message === 'Outputs spends more than inputs amount') {
      return undefined;
    }
    throw e;
  }
};

export const getVbytesForIO = async (context: TransactionContext, addressContext: AddressContext) => {
  const dummyNativeSegwitAddress =
    context.network === 'Mainnet'
      ? 'bc1q2dj92g3pvkkvxf9x5xw4036vrnnsd3njud62r6'
      : 'tb1q8dq9ql8p7lvh9m5w5njqa2x424fqydw64fxxen';

  const dummyTransaction = new Transaction();

  const addressUtxos = await addressContext.getUtxos();

  if (!addressUtxos.length) {
    throw new Error(`No UTXOs found for address: ${addressContext.address}`);
  }

  const emptySize = await getTransactionVSize(context, dummyTransaction);

  const utxo = addressUtxos[0];
  await addressContext.addInput(dummyTransaction, utxo);

  const vsizeWithInput = await getTransactionVSize(context, dummyTransaction);

  context.addOutputAddress(dummyTransaction, dummyNativeSegwitAddress, BigInt(Math.floor(utxo.utxo.value / 2)));

  const vsizeWithOutput = await getTransactionVSize(context, dummyTransaction);

  if (!emptySize || !vsizeWithInput || !vsizeWithOutput) {
    throw new Error('Could not get vsize for transaction');
  }

  const outputSize = vsizeWithOutput - vsizeWithInput;
  const inputSize = vsizeWithInput - emptySize;

  return { inputSize, outputSize };
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
