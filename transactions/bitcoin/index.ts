import { TransactionContext } from './context';
import { EnhancedTransaction } from './enhancedTransaction';
import { Action, ActionType, SendBtcAction, SendUtxoAction, SplitUtxoAction } from './types';

const compileTransaction = async (context: TransactionContext, actions: Action[], feeRate: number) => {
  const txn = new EnhancedTransaction(context, actions, feeRate);

  return txn;
};

/**
 * send bitcoin
 * send bitcoin to multiple recipients
 */
export const sendBtc = async (
  context: TransactionContext,
  recipients: { toAddress: string; amount: bigint }[],
  feeRate: number,
) => {
  const actions = recipients.map<SendBtcAction>(({ toAddress, amount }) => ({
    type: ActionType.SEND_BTC,
    toAddress,
    amount,
    combinable: false,
  }));
  const transaction = await compileTransaction(context, actions, feeRate);
  return transaction;
};

/**
 * send inscription
 * send multiple inscription to 1 recipient
 * send multiple inscription to multiple recipients
 * send sat
 * send multiple sats to 1 recipient
 * send multiple sats to multiple recipients
 */
export const sendOrdinal = async (
  context: TransactionContext,
  recipients: {
    toAddress: string;
    location: string;
    minOutputSatsAmount: number;
    maxOutputSatsAmount: number;
    moveToZeroOffset?: boolean;
  }[],
  feeRate: number,
) => {
  const actions = recipients.map<SplitUtxoAction>(
    ({ toAddress, location, minOutputSatsAmount, maxOutputSatsAmount, moveToZeroOffset }) => ({
      type: ActionType.SPLIT_UTXO,
      toAddress,
      location,
      minOutputSatsAmount,
      maxOutputSatsAmount,
      moveToZeroOffset: moveToZeroOffset ?? true,
    }),
  );
  const transaction = await compileTransaction(context, actions, feeRate);
  return transaction;
};

export const recoverBitcoin = async (
  context: TransactionContext,
  toAddress: string,
  feeRate: number,
  fromAddress?: string,
  outpoint?: string,
) => {
  if (outpoint) {
    const transaction = await compileTransaction(
      context,
      [
        {
          type: ActionType.SEND_UTXO,
          toAddress,
          outpoint,
          combinable: true,
          spendable: true,
        },
      ],
      feeRate,
    );
    return transaction;
  } else if (fromAddress) {
    const nonOrdinalUtxos = await context.getAddressContext(fromAddress)?.getNonOrdinalUtxos();

    if (!nonOrdinalUtxos || nonOrdinalUtxos.length === 0) {
      throw new Error('No non-ordinal utxos found to recover');
    }

    const actions = nonOrdinalUtxos.map<SendUtxoAction>((utxo) => ({
      type: ActionType.SEND_UTXO,
      toAddress,
      outpoint: utxo.outpoint,
      combinable: true,
      spendable: true,
    }));
    const transaction = await compileTransaction(context, actions, feeRate);
    return transaction;
  } else {
    throw new Error('Must provide either fromAddress or outpoint');
  }
};

export const recoverOrdinal = async (
  context: TransactionContext,
  toAddress: string,
  feeRate: number,
  fromAddress?: string,
  outpoint?: string,
) => {
  if (outpoint) {
    const transaction = await compileTransaction(
      context,
      [
        {
          type: ActionType.SEND_UTXO,
          toAddress,
          outpoint,
          combinable: false,
          spendable: false,
        },
      ],
      feeRate,
    );
    return transaction;
  } else if (fromAddress) {
    const ordinalUtxos = await context.getAddressContext(fromAddress)?.getNonOrdinalUtxos();

    if (!ordinalUtxos || ordinalUtxos.length === 0) {
      throw new Error('No ordinal utxos found to recover');
    }

    const actions = ordinalUtxos.map<SendUtxoAction>((utxo) => ({
      type: ActionType.SEND_UTXO,
      toAddress,
      outpoint: utxo.outpoint,
      combinable: false,
      spendable: false,
    }));
    const transaction = await compileTransaction(context, actions, feeRate);
    return transaction;
  } else {
    throw new Error('Must provide either fromAddress or outpoint');
  }
};

export const extractOrdinal = async (
  context: TransactionContext,
  sats: { location: string; satsAmount: number }[],
  toAddress: string,
  feeRate: number,
) => {
  const recipients = sats.map(({ location, satsAmount }) => ({
    location,
    minOutputSatsAmount: satsAmount,
    maxOutputSatsAmount: satsAmount,
    toAddress,
    moveToZeroOffset: true,
  }));
  return sendOrdinal(context, recipients, feeRate);
};
