import { TransactionContext } from './context';
import { EnhancedTransaction } from './enhancedTransaction';
import { ActionType, SendBtcAction, SendUtxoAction, SplitUtxoAction } from './types';

const SPLIT_UTXO_MIN_VALUE = 1500; // the minimum value for a UTXO to be split
const DUST_VALUE = 546; // the value of an inscription we prefer to use

/**
 * send max bitcoin
 */
export const sendMaxBtc = async (context: TransactionContext, toAddress: string, feeRate: number) => {
  const paymentUtxos = await context.paymentAddress.getUtxos();
  const actions = paymentUtxos.map<SendUtxoAction>((utxo) => ({
    type: ActionType.SEND_UTXO,
    combinable: true,
    spendable: true,
    outpoint: utxo.outpoint,
    toAddress,
  }));
  const transaction = new EnhancedTransaction(context, actions, feeRate);
  return transaction;
};

/**
 * consolidate specific utxos
 */
export const combineUtxos = async (
  context: TransactionContext,
  outpoints: string[],
  toAddress: string,
  feeRate: number,
  spendable?: boolean,
) => {
  const actions = outpoints.map<SendUtxoAction>((outpoint) => ({
    type: ActionType.SEND_UTXO,
    combinable: true,
    spendable: spendable ?? false,
    outpoint,
    toAddress,
  }));
  const transaction = new EnhancedTransaction(context, actions, feeRate);
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
) => {
  const actions = recipients.map<SendBtcAction>(({ toAddress, amount }) => ({
    type: ActionType.SEND_BTC,
    toAddress,
    amount,
    combinable: false,
  }));
  const transaction = new EnhancedTransaction(context, actions, feeRate);
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
 * !Note: We use the split UTXO action to cater for the following scenarios:
 * - multiple inscriptions exist in 1 UTXO at different offsets
 * - An inscription exists in a large UTXO (e.g. 10k sats) and we want to use those extra sats as fees or as change
 * - We want to move an inscription to offset of 0
 */
export const sendOrdinals = async (
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

    // If there is only 1 special sat range in the utxo and it's value is less than the minimum value for a split utxo
    // then we can just send the utxo
    if (
      utxoBundleData?.sat_ranges &&
      utxoBundleData?.sat_ranges.length <= 1 &&
      recipientCollection.length === 1 &&
      extendedUtxo.utxo.value <= SPLIT_UTXO_MIN_VALUE + DUST_VALUE
    ) {
      actions.push({
        type: ActionType.SEND_UTXO,
        toAddress: recipientCollection[0].toAddress,
        outpoint,
        combinable: false,
        spendable: false,
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
        }
      } else {
        currentOffset.min = currentOffset.max - DUST_VALUE;

        if (currentOffset.min > previousOffset.max) {
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

  const transaction = new EnhancedTransaction(context, actions, feeRate);
  return transaction;
};

export const extractOrdinalsFromUtxo = async (context: TransactionContext, outpoint: string, feeRate: number) => {
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

  return sendOrdinals(context, recipients, feeRate);
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

    const transaction = new EnhancedTransaction(
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
  }

  const nonOrdinalUtxos = (await context.ordinalsAddress.getCommonUtxos()).filter((u) => u.utxo.status.confirmed);

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
  const transaction = new EnhancedTransaction(context, actions, feeRate);
  return transaction;
};

export const recoverOrdinal = async (context: TransactionContext, feeRate: number, outpoint?: string) => {
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
          combinable: false,
          spendable: false,
        },
      ],
      feeRate,
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

  const transaction = new EnhancedTransaction(context, actions.flat(), feeRate);
  return transaction;
};
