import { hex } from '@scure/base';
import { BigNumber } from 'bignumber.js';
import { getRunesClient } from '../api';
import { DEFAULT_DUST_VALUE } from '../constant';
import { processPromisesBatch } from '../utils/promises';
import { ActionType, EnhancedTransaction, ExtendedUtxo, TransactionContext, TransactionOptions } from './bitcoin';
import { Action } from './bitcoin/types';

const getUtxosWithRuneBalance = async (extendedUtxos: ExtendedUtxo[], runeName: string) => {
  const runeUtxosRaw = await processPromisesBatch(extendedUtxos, 20, async (utxo) => {
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

export const sendRunes = async (
  context: TransactionContext,
  runeName: string,
  toAddress: string,
  amount: bigint,
  feeRate: number,
  options?: Omit<TransactionOptions, 'forceIncludeOutpointList' | 'allowUnknownOutputs'>,
) => {
  if (amount <= 0) {
    throw new Error('Amount must be positive');
  }

  // we use bigint for the amount type to make it explicit that this function requires the individual coin units
  // rather than the decimal amount
  const amountBigNumber = BigNumber(amount.toString());

  const runesApi = getRunesClient(context.network);

  const ordinalsUtxos = await context.ordinalsAddress.getUtxos();

  // get only utxos with positive balance of desired rune
  const runeUtxos = await getUtxosWithRuneBalance(ordinalsUtxos, runeName);

  // sort in desc order of balance
  runeUtxos.sort((a, b) => {
    const diff = b.balance.minus(a.balance);
    if (diff.gt(0)) return 1;
    if (diff.lt(0)) return -1;
    return 0;
  });

  // get enough utxos to cover the amount
  const totalBalances: Record<string, BigNumber> = {};
  const selectedOutpoints: string[] = [];

  for (const { utxo } of runeUtxos) {
    const utxoBundle = await utxo.getBundleData();

    for (const [rune, runeDetails] of utxoBundle?.runes ?? []) {
      totalBalances[rune] = BigNumber(totalBalances[rune] ?? 0).plus(runeDetails.amount);
    }

    selectedOutpoints.push(utxo.outpoint);

    if (totalBalances[runeName].gte(amountBigNumber)) {
      break;
    }
  }

  if (totalBalances[runeName].lt(amountBigNumber)) {
    throw new Error('Not enough runes to send');
  }

  // calculate if there is change
  // There will be change if there are other ticker balances on the input UTXOs or if the balance of the ticker
  // is greater than the amount being sent
  const numberOfRuneTickersInUtxos = Object.keys(totalBalances).length;
  const tickerBalanceGreaterThanSendAmount = totalBalances[runeName].gt(amountBigNumber);
  const hasChange = numberOfRuneTickersInUtxos > 1 || tickerBalanceGreaterThanSendAmount;

  // create txn with required rune utxos as input
  const runeMetadata = await runesApi.getRuneInfo(runeName);

  if (!runeMetadata) {
    throw new Error('Rune not found');
  }

  const transferScript = await runesApi.getEncodedScriptHex({
    edicts: [{ id: runeMetadata.id, amount: amountBigNumber, output: BigNumber(1) }],
    pointer: hasChange ? 2 : undefined,
  });

  const actions: Action[] = [
    {
      type: ActionType.SCRIPT,
      script: hex.decode(transferScript),
    },
    {
      type: ActionType.SEND_BTC,
      toAddress: toAddress,
      amount: DEFAULT_DUST_VALUE,
      combinable: false,
    },
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
    forceIncludeOutpointList: selectedOutpoints,
    allowUnknownOutputs: true,
  });

  return transaction;
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
