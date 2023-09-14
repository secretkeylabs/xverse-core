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
 *
 * !Note: this uses split UTXO action. In some cases, we'll probably want to use send UTXO action instead
 * !Note: We use the split UTXO action to cater for the following scenarios:
 * - multiple inscriptions exist in 1 UTXO at different offsets
 * - An inscription exists in a large UTXO (e.g. 10k sats) and we want to use those extra sats as fees or as change
 * - We want to move an inscription to offset of 0
 */
// TODO: revisit
export const sendOrdinal = async (
  context: TransactionContext,
  recipients: {
    toAddress: string;
    location: string;
  }[],
  feeRate: number,
) => {
  const actions = recipients.map<SplitUtxoAction>(({ toAddress, location }) => ({
    type: ActionType.SPLIT_UTXO,
    toAddress,
    location,
  }));
  const transaction = await compileTransaction(context, actions, feeRate);
  return transaction;
};

export const recoverBitcoin = async (context: TransactionContext, feeRate: number, outpoint?: string) => {
  if (context.paymentAddress.address === context.ordinalsAddress.address) {
    throw new Error('Cannot recover bitcoin to same address');
  }

  if (outpoint) {
    const utxo = await context.ordinalsAddress.getUtxo(outpoint);

    if (!utxo) {
      throw new Error('No utxo in ordinals address found to recover');
    }

    const transaction = await compileTransaction(
      context,
      [
        {
          type: ActionType.SEND_UTXO,
          toAddress: context.paymentAddress.address,
          outpoint,
          combinable: true,
          spendable: true,
        },
      ],
      feeRate,
    );
    return transaction;
  } else {
    const nonOrdinalUtxos = await context.ordinalsAddress.getNonOrdinalUtxos();

    if (nonOrdinalUtxos.length === 0) {
      throw new Error('No non-ordinal utxos found to recover');
    }

    const actions = nonOrdinalUtxos.map<SendUtxoAction>((utxo) => ({
      type: ActionType.SEND_UTXO,
      toAddress: context.paymentAddress.address,
      outpoint: utxo.outpoint,
      combinable: true,
      spendable: true,
    }));
    const transaction = await compileTransaction(context, actions, feeRate);
    return transaction;
  }
};

export const recoverOrdinal = async (
  context: TransactionContext,
  feeRate: number,
  fromAddress?: string,
  outpoint?: string,
) => {
  if (context.paymentAddress.address === context.ordinalsAddress.address) {
    throw new Error('Cannot recover ordinals to same address');
  }

  if (outpoint) {
    const utxo = await context.paymentAddress.getUtxo(outpoint);

    if (!utxo) {
      throw new Error('No utxo in payments address found to recover');
    }

    const transaction = await compileTransaction(
      context,
      [
        {
          type: ActionType.SEND_UTXO,
          toAddress: context.ordinalsAddress.address,
          outpoint,
          combinable: false,
          spendable: false,
        },
      ],
      feeRate,
    );
    return transaction;
  } else if (fromAddress) {
    const ordinalUtxos = await context.paymentAddress.getOrdinalUtxos();

    if (ordinalUtxos.length === 0) {
      throw new Error('No ordinal utxos found to recover');
    }

    const actions = ordinalUtxos.map<SendUtxoAction>((utxo) => ({
      type: ActionType.SEND_UTXO,
      toAddress: context.ordinalsAddress.address,
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

// TODO: revisit
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
