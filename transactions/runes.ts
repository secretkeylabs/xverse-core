import { hex } from '@scure/base';
import { BigNumber } from 'bignumber.js';
import { getRunesClient } from '../api';
import { DEFAULT_DUST_VALUE } from '../constant';
import { Edict } from '../types';
import { normalizeRuneName } from '../utils';
import { processPromisesBatch } from '../utils/promises';
import { ActionType, EnhancedTransaction, ExtendedUtxo, TransactionContext, TransactionOptions } from './bitcoin';
import { Action } from './bitcoin/types';

const getUtxosWithRuneBalance = async (extendedUtxos: ExtendedUtxo[], runeName: string, utxosToSkip: Set<string>) => {
  const filteredUtxos = extendedUtxos.filter((utxo) => !utxosToSkip.has(utxo.outpoint));

  const runeUtxosRaw = await processPromisesBatch(filteredUtxos, 20, async (utxo) => {
    const balance = await utxo.getRuneBalance(runeName);
    return {
      utxo,
      balance,
    };
  });

  // get only utxos with positive balance of desired rune
  const runeUtxos = runeUtxosRaw.reduce((acc, utxo) => {
    if (!!utxo.balance && utxo.balance.gt(0)) {
      acc.push(utxo as { utxo: ExtendedUtxo; balance: BigNumber });
    }
    return acc;
  }, [] as { utxo: ExtendedUtxo; balance: BigNumber }[]);

  return runeUtxos;
};

type RuneRecipient = {
  runeName: string;
  toAddress: string;
  /* Amount should be in coin units without divisibility applied, hence the bigint */
  amount: bigint;
};
export const sendManyRunes = async (
  context: TransactionContext,
  recipients: RuneRecipient[],
  feeRate: number,
  options?: Omit<TransactionOptions, 'forceIncludeOutpointList' | 'allowUnknownOutputs'>,
) => {
  if (recipients.some((r) => r.amount <= 0)) {
    throw new Error('Amount must be positive');
  }

  const runeTotalsToSend = recipients.reduce((acc, { runeName, amount }) => {
    const normalizedRuneName = normalizeRuneName(runeName);
    acc[normalizedRuneName] = BigNumber(acc[normalizedRuneName] ?? 0).plus(amount.toString());
    return acc;
  }, {} as Record<string, BigNumber>);

  const allocatedRunes: Record<string, BigNumber> = {};

  const ordinalsUtxos = await context.ordinalsAddress.getUtxos();
  const selectedOutpoints = new Set<string>();

  for (const [runeName, totalToSend] of Object.entries(runeTotalsToSend)) {
    // get only utxos with positive balance of desired rune
    const runeUtxos = await getUtxosWithRuneBalance(ordinalsUtxos, runeName, selectedOutpoints);

    // sort in desc order of balance
    runeUtxos.sort((a, b) => {
      const diff = b.balance.minus(a.balance);
      if (diff.gt(0)) return 1;
      if (diff.lt(0)) return -1;
      return 0;
    });

    for (const { utxo } of runeUtxos) {
      const utxoBundle = await utxo.getBundleData();

      for (const [rune, runeDetails] of utxoBundle?.runes ?? []) {
        const normalizedRuneName = normalizeRuneName(rune);
        allocatedRunes[normalizedRuneName] = BigNumber(allocatedRunes[normalizedRuneName] ?? 0).plus(
          runeDetails.amount,
        );
      }

      selectedOutpoints.add(utxo.outpoint);

      if (allocatedRunes[runeName]?.gte(totalToSend)) {
        break;
      }
    }

    if (!allocatedRunes[runeName] || allocatedRunes[runeName].lt(totalToSend)) {
      throw new Error(`Not enough runes to send for ${runeName}`);
    }
  }

  // calculate if there is change
  // There will be change if there are other ticker balances on the input UTXOs or if the balance of the ticker
  // is greater than the amount being sent
  const numberOfRuneTickersInUtxos = Object.keys(allocatedRunes).length;
  const numberOfRunesToSend = Object.keys(runeTotalsToSend).length;
  const tickerBalanceGreaterThanSendAmount = Object.entries(runeTotalsToSend).some(([runeName, amountToSend]) =>
    allocatedRunes[runeName].gt(amountToSend),
  );
  const hasChange = numberOfRuneTickersInUtxos > numberOfRunesToSend || tickerBalanceGreaterThanSendAmount;

  const runesApi = getRunesClient(context.network);

  // create txn with required rune utxos as input
  const sendActions: Action[] = [];
  const edicts: Edict[] = [];

  for (const recipient of recipients) {
    const runeMetadata = await runesApi.getRuneInfo(recipient.runeName);

    if (!runeMetadata) {
      throw new Error('Rune not found');
    }

    sendActions.push({
      type: ActionType.SEND_BTC,
      toAddress: recipient.toAddress,
      amount: DEFAULT_DUST_VALUE,
      combinable: false,
    });
    edicts.push({
      id: runeMetadata.id,
      amount: BigNumber(recipient.amount.toString()),
      output: BigNumber(sendActions.length),
    });
  }

  const transferScript = await runesApi.getEncodedScriptHex({
    edicts,
    pointer: hasChange ? sendActions.length + 1 : undefined,
  });

  const actions: Action[] = [
    {
      type: ActionType.SCRIPT,
      script: hex.decode(transferScript),
    },
    ...sendActions,
  ];

  if (hasChange) {
    actions.push({
      type: ActionType.SEND_BTC,
      toAddress: context.ordinalsAddress.address,
      amount: DEFAULT_DUST_VALUE,
      combinable: false,
    });
  }

  const transaction = new EnhancedTransaction(context, actions, feeRate, {
    ...options,
    forceIncludeOutpointList: [...selectedOutpoints],
    allowUnknownOutputs: true,
  });

  return transaction;
};

/** @deprecated - use sendManyRunes with single recipient instead */
export const sendRunes = async (
  context: TransactionContext,
  runeName: string,
  toAddress: string,
  amount: bigint,
  feeRate: number,
  options?: Omit<TransactionOptions, 'forceIncludeOutpointList' | 'allowUnknownOutputs'>,
) => {
  return sendManyRunes(context, [{ runeName, toAddress, amount }], feeRate, options);
};

export const recoverRunes = async (
  context: TransactionContext,
  feeRate: number,
  options?: Omit<TransactionOptions, 'forceIncludeOutpointList' | 'allowUnknownOutputs'>,
) => {
  const runesApi = getRunesClient(context.network);

  const [paymentUtxos, runeScriptHex] = await Promise.all([
    context.paymentAddress.getUtxos(),
    runesApi.getEncodedScriptHex({ edicts: [], pointer: 1 }),
  ]);

  const runeUtxos: ExtendedUtxo[] = [];

  for (const utxo of paymentUtxos) {
    if (await utxo.hasRunes()) {
      runeUtxos.push(utxo);
    }
  }

  if (runeUtxos.length === 0) {
    throw new Error('No runes to recover');
  }

  const runeBalanceOutpoints = runeUtxos.map((utxo) => utxo.outpoint);

  const transaction = new EnhancedTransaction(
    context,
    [
      {
        type: ActionType.SCRIPT,
        script: hex.decode(runeScriptHex),
      },
      {
        type: ActionType.SEND_BTC,
        toAddress: context.ordinalsAddress.address,
        amount: DEFAULT_DUST_VALUE,
        combinable: false,
      },
    ],
    feeRate,
    {
      ...options,
      forceIncludeOutpointList: runeBalanceOutpoints,
      allowUnknownOutputs: true,
    },
  );

  return transaction;
};
