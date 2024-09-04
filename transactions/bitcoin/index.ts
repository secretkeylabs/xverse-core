import { TransactionContext } from './context';
import { createTransactionContext } from './contextFactory';
import { EnhancedPsbt } from './enhancedPsbt';
import { EnhancedTransaction } from './enhancedTransaction';
import { ExtendedUtxo } from './extendedUtxo';
import {
  ActionType,
  EnhancedInput,
  EnhancedOutput,
  IOInscription,
  IOSatribute,
  PsbtSummary,
  SendBtcAction,
  SendUtxoAction,
  SplitUtxoAction,
  TransactionFeeOutput,
  TransactionOptions,
  TransactionOutput,
  TransactionPubKeyOutput,
  TransactionScriptOutput,
  TransactionSummary,
} from './types';

// Note: OG ordinals collections like OMB are inscribed on 10k sat utxos,
// and we prefer to preserve these.
const SPLIT_UTXO_MIN_SIZE = 10000; // threshold to determine if we split the UTXO at all
const SPLIT_UTXO_MIN_VALUE = 1500; // the minimum value for a sat range to be split

const DUST_VALUE = 546; // the value of an inscription we prefer to use

export { ActionType, EnhancedPsbt, EnhancedTransaction, ExtendedUtxo, TransactionContext, createTransactionContext };
export type {
  EnhancedInput,
  EnhancedOutput,
  IOInscription,
  IOSatribute,
  PsbtSummary,
  SendBtcAction,
  SendUtxoAction,
  SplitUtxoAction,
  TransactionFeeOutput,
  TransactionOptions,
  TransactionOutput,
  TransactionPubKeyOutput,
  TransactionScriptOutput,
  TransactionSummary,
};

/**
 * send max bitcoin
 */
export const sendMaxBtc = async (
  context: TransactionContext,
  toAddress: string,
  feeRate: number,
  skipDust = true,
  options?: Omit<TransactionOptions, 'forceIncludeOutpointList' | 'overrideChangeAddress'>,
) => {
  let paymentUtxos = await context.paymentAddress.getUtxos();
  let dustFiltered = false;

  if (paymentUtxos.length === 0) {
    throw new Error('No utxos found');
  }

  if (skipDust) {
    const testTransaction = new EnhancedTransaction(context, [], feeRate, {
      ...options,
      forceIncludeOutpointList: [paymentUtxos[0].outpoint],
    });

    const { dustValue } = await testTransaction.getSummary();

    const filteredPaymentUtxos = paymentUtxos.filter((utxo) => utxo.utxo.value > dustValue);
    dustFiltered = filteredPaymentUtxos.length !== paymentUtxos.length;
    paymentUtxos = filteredPaymentUtxos;

    if (paymentUtxos.length === 0) {
      throw new Error('All UTXOs are dust');
    }
  }

  const outpoints = paymentUtxos.map((utxo) => utxo.outpoint);

  const transaction = new EnhancedTransaction(context, [], feeRate, {
    ...options,
    forceIncludeOutpointList: outpoints,
    overrideChangeAddress: toAddress,
  });
  return { transaction, dustFiltered };
};

/**
 * consolidate specific utxos
 */
export const combineUtxos = async (
  context: TransactionContext,
  outpoints: string[],
  toAddress: string,
  feeRate: number,
  options?: Omit<TransactionOptions, 'forceIncludeOutpointList' | 'overrideChangeAddress'>,
) => {
  const actions = outpoints.map<SendUtxoAction>((outpoint) => ({
    type: ActionType.SEND_UTXO,
    combinable: true,
    outpoint,
    toAddress,
  }));
  const transaction = new EnhancedTransaction(context, actions, feeRate, options);
  return transaction;
};

/**
 * send bitcoin
 * send bitcoin to multiple recipients
 */
export const sendBtc = async (
  context: TransactionContext,
  recipients: { toAddress: string; amount: bigint }[],
  feeRate: number,
  options?: TransactionOptions,
) => {
  const actions = recipients.map<SendBtcAction>(({ toAddress, amount }) => ({
    type: ActionType.SEND_BTC,
    toAddress,
    amount,
    combinable: false,
  }));
  const transaction = new EnhancedTransaction(context, actions, feeRate, options);
  return transaction;
};

/**
 * Send inscriptions or bundles
 * This sends the full UTXO to the recipient, even if there are other satributes or inscriptions in it
 */
export const sendOrdinals = async (
  context: TransactionContext,
  recipients: (
    | {
        toAddress: string;
        outpoint: string;
      }
    | {
        toAddress: string;
        inscriptionId: string;
      }
  )[],
  feeRate: number,
  options?: TransactionOptions,
) => {
  if (recipients.length === 0) {
    throw new Error('Must provide at least 1 recipient');
  }

  const embellishedRecipients = await Promise.all(
    recipients.map(async (recipient) => {
      if ('outpoint' in recipient) {
        return recipient;
      }

      const utxo = await context.getInscriptionUtxo(recipient.inscriptionId);

      if (!utxo.extendedUtxo) {
        throw new Error('No utxo found for inscription');
      }

      return {
        toAddress: recipient.toAddress,
        outpoint: utxo.extendedUtxo.outpoint,
      };
    }),
  );

  const actions = embellishedRecipients.map<SendUtxoAction>(({ toAddress, outpoint }) => ({
    type: ActionType.SEND_UTXO,
    toAddress,
    outpoint,
    combinable: false,
    spendable: false,
  }));

  const transaction = new EnhancedTransaction(context, actions, feeRate, options);
  return transaction;
};

/**
 * Sends specific inscriptions or sats to specific recipients
 * If the UTXO has more sats on it than dust before or after the specified sats to send, then it
 * will split the UTXO and send the specified sats to the recipient and the rest back to the original address
 * send inscription
 * send multiple inscription to 1 recipient
 * send multiple inscription to multiple recipients
 * send sat
 * send multiple sats to 1 recipient
 * send multiple sats to multiple recipients
 *
 * !Note: We use the split UTXO action to cater for the following scenarios:
 * - multiple inscriptions exist in 1 UTXO at different offsets
 * - An inscription exists in a large UTXO (e.g. 10k sats) and we want to use those extra sats as fees or as change
 * - We want to move an inscription to offset of 0
 */
export const sendOrdinalsWithSplit = async (
  context: TransactionContext,
  recipients: (
    | {
        toAddress: string;
        location: string;
      }
    | {
        toAddress: string;
        inscriptionId: string;
      }
  )[],
  feeRate: number,
  options?: TransactionOptions,
) => {
  if (recipients.length === 0) {
    throw new Error('Must provide at least 1 recipient');
  }

  const embellishedRecipients = await Promise.all(
    recipients.map(async (recipient) => {
      if ('location' in recipient) {
        return recipient;
      }

      const utxo = await context.getInscriptionUtxo(recipient.inscriptionId);

      if (!utxo.extendedUtxo) {
        throw new Error('No utxo found for inscription');
      }

      const bundle = await utxo.extendedUtxo.getBundleData();

      const inscriptionBundle = bundle?.sat_ranges.find((b) =>
        b.inscriptions.some((i) => i.id === recipient.inscriptionId),
      );

      if (!inscriptionBundle) {
        throw new Error('No inscription found in utxo');
      }

      return {
        toAddress: recipient.toAddress,
        location: `${utxo.extendedUtxo.outpoint}:${inscriptionBundle.offset}`,
      };
    }),
  );

  const utxoToRecipientsMap = embellishedRecipients.reduce((acc, { location, toAddress }) => {
    const [transactionId, vout, offsetStr] = location.split(':');
    const outPoint = `${transactionId}:${vout}`;
    const offset = +offsetStr;

    if (!acc[outPoint]) {
      acc[outPoint] = [];
    }

    acc[outPoint].push({ toAddress, offset, location });
    acc[outPoint].sort((a, b) => a.offset - b.offset);

    return acc;
  }, {} as Record<string, { toAddress: string; offset: number; location: string }[]>);

  const actions: (SplitUtxoAction | SendUtxoAction)[] = [];

  for (const [outpoint, recipientCollection] of Object.entries(utxoToRecipientsMap)) {
    const { extendedUtxo } = await context.getUtxo(outpoint);

    if (!extendedUtxo) {
      throw new Error(`No utxo found for outpoint ${outpoint}`);
    }

    const utxoBundleData = await extendedUtxo.getBundleData();

    // If there is only 1 or no special sat ranges in the utxo and it's value is less than
    // the minimum value for a split utxo then we can just send the utxo
    if (
      (!utxoBundleData?.sat_ranges || utxoBundleData?.sat_ranges.length <= 1) &&
      recipientCollection.length === 1 &&
      extendedUtxo.utxo.value <= SPLIT_UTXO_MIN_SIZE + DUST_VALUE
    ) {
      actions.push({
        type: ActionType.SEND_UTXO,
        toAddress: recipientCollection[0].toAddress,
        outpoint,
      });
      continue;
    }

    recipientCollection.sort((a, b) => a.offset - b.offset);

    // calculate and preprocess action limits
    const recipientCollectionWithLimits = recipientCollection.map((recipient) => ({
      ...recipient,
      min: recipient.offset,
      max: Math.min(extendedUtxo.utxo.value, recipient.offset + DUST_VALUE),
    }));

    for (let i = recipientCollectionWithLimits.length - 1; i >= 0; i--) {
      const currentOffset = recipientCollectionWithLimits[i];
      const previousOffset = i === 0 ? undefined : recipientCollectionWithLimits[i - 1];

      if (currentOffset.max < currentOffset.offset) {
        throw new Error('Cannot split utxo, desired offsets interfere with each other');
      }

      if (!previousOffset) {
        currentOffset.min = currentOffset.max - DUST_VALUE;
        if (currentOffset.min < 0) {
          throw new Error('Cannot split utxo, desired offsets interfere with each other');
        }
        if (currentOffset.min < SPLIT_UTXO_MIN_VALUE) {
          currentOffset.min = 0;
          currentOffset.max = Math.min(currentOffset.max, SPLIT_UTXO_MIN_VALUE);
        }
      } else {
        currentOffset.min = Math.min(currentOffset.max - DUST_VALUE, currentOffset.offset);

        if (currentOffset.min < previousOffset.max) {
          previousOffset.max = currentOffset.min;
        }
      }
    }

    // create actions
    for (let i = 0; i < recipientCollectionWithLimits.length; i++) {
      const { toAddress, min, max } = recipientCollectionWithLimits[i];
      const nextOffset =
        i === recipientCollectionWithLimits.length - 1 ? undefined : recipientCollectionWithLimits[i + 1];

      actions.push({
        type: ActionType.SPLIT_UTXO,
        location: `${outpoint}:${min}`,
        toAddress,
      });

      if (nextOffset) {
        if (nextOffset.min - max > SPLIT_UTXO_MIN_VALUE) {
          actions.push({
            type: ActionType.SPLIT_UTXO,
            location: `${outpoint}:${max}`,
            toAddress: extendedUtxo.utxo.address,
          });
        }
      } else {
        if (extendedUtxo.utxo.value - max > SPLIT_UTXO_MIN_VALUE) {
          actions.push({
            type: ActionType.SPLIT_UTXO,
            location: `${outpoint}:${max}`,
            toAddress: extendedUtxo.utxo.address,
          });
        }
      }
    }
  }

  const transaction = new EnhancedTransaction(context, actions, feeRate, options);
  return transaction;
};

/**
 * @deprecated Not deprecated, but in beta. Needs tests. Do not use until tested.
 **/
export const extractOrdinalsFromUtxo = async (
  context: TransactionContext,
  outpoint: string,
  feeRate: number,
  options?: TransactionOptions,
) => {
  const utxo = await context.getUtxo(outpoint);

  if (!utxo?.extendedUtxo) {
    throw new Error('No utxo found for outpoint');
  }

  const bundleData = await utxo.extendedUtxo.getBundleData();

  if (!bundleData) {
    throw new Error('UTXO is not yet indexed');
  }

  const recipients = bundleData?.sat_ranges.map((s) => ({
    toAddress: context.ordinalsAddress.address,
    location: utxo.extendedUtxo?.outpoint + ':' + s.offset,
  }));

  return sendOrdinalsWithSplit(context, recipients, feeRate, options);
};

/**
 * @deprecated Not deprecated, but in beta. Needs tests. Do not use until tested.
 **/
export const recoverBitcoin = async (
  context: TransactionContext,
  feeRate: number,
  outpoint?: string,
  options?: Omit<TransactionOptions, 'forceIncludeOutpointList' | 'overrideChangeAddress'>,
) => {
  if (context.paymentAddress.address === context.ordinalsAddress.address) {
    throw new Error('Cannot recover bitcoin to same address');
  }

  if (outpoint) {
    const utxo = await context.ordinalsAddress.getUtxo(outpoint);

    if (!utxo) {
      throw new Error('No utxo in ordinals address found to recover');
    }

    const transaction = new EnhancedTransaction(context, [], feeRate, {
      ...options,
      forceIncludeOutpointList: [outpoint],
    });
    return transaction;
  }

  const nonOrdinalUtxos = (await context.ordinalsAddress.getCommonUtxos()).filter((u) => u.utxo.status.confirmed);

  if (nonOrdinalUtxos.length === 0) {
    throw new Error('No non-ordinal utxos found to recover');
  }

  const outpoints = nonOrdinalUtxos.map((utxo) => utxo.outpoint);
  const transaction = new EnhancedTransaction(context, [], feeRate, {
    ...options,
    forceIncludeOutpointList: outpoints,
  });
  return transaction;
};

/**
 * @deprecated Not deprecated, but in beta. Needs tests. Do not use until tested.
 **/
export const recoverOrdinal = async (
  context: TransactionContext,
  feeRate: number,
  outpoint?: string,
  options?: TransactionOptions,
) => {
  if (context.paymentAddress.address === context.ordinalsAddress.address) {
    throw new Error('Cannot recover ordinals to same address');
  }

  if (outpoint) {
    const utxo = await context.paymentAddress.getUtxo(outpoint);

    if (!utxo) {
      throw new Error('No utxo in payments address found to recover');
    }

    const transaction = new EnhancedTransaction(
      context,
      [
        {
          type: ActionType.SEND_UTXO,
          toAddress: context.ordinalsAddress.address,
          outpoint,
        },
      ],
      feeRate,
      options,
    );
    return transaction;
  }

  const ordinalUtxos = await context.paymentAddress.getEmbellishedUtxos();

  if (ordinalUtxos.length === 0) {
    throw new Error('No ordinal utxos found to recover');
  }
  const actions = await Promise.all(
    ordinalUtxos.map<Promise<SplitUtxoAction[]>>(async (utxo) => {
      const bundleData = await utxo.getBundleData();

      if (!bundleData?.sat_ranges) {
        return [] as SplitUtxoAction[];
      }

      const splitActions = bundleData.sat_ranges.map<SplitUtxoAction>((s) => ({
        type: ActionType.SPLIT_UTXO,
        location: utxo.outpoint + ':' + s.offset,
        toAddress: context.ordinalsAddress.address,
      }));

      if (bundleData.sat_ranges[bundleData.sat_ranges.length - 1].offset + SPLIT_UTXO_MIN_VALUE < utxo.utxo.value) {
        splitActions.push({
          type: ActionType.SPLIT_UTXO,
          location: utxo.outpoint + ':' + (bundleData.sat_ranges[bundleData.sat_ranges.length - 1].offset + DUST_VALUE),
          spendable: true,
        });
      }

      return splitActions;
    }),
  );

  const transaction = new EnhancedTransaction(context, actions.flat(), feeRate, options);
  return transaction;
};
