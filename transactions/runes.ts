import { BigNumber } from 'bignumber.js';
import { RunesApi } from '../api';
import { DEFAULT_DUST_VALUE } from '../constant';
import { processPromisesBatch } from '../utils/promises';
import { ActionType, EnhancedTransaction, ExtendedUtxo, TransactionContext, TransactionOptions } from './bitcoin';
import { Action } from './bitcoin/types';

const runeOp = 'RUNE_TEST';
const runeTags = {
  body: 0,
  defaultOutput: 12, // used to specify which output to send any unallocated balance (change) to
};

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
  // we use bigint for the amount type to make it explicit that this function requires the individual coin units
  // rather than the decimal amount
  const amountBigNumber = BigNumber(amount.toString());

  const runesApi = new RunesApi(context.network);

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

    for (const rune in utxoBundle?.runes) {
      totalBalances[rune] = BigNumber(totalBalances[rune] ?? 0).plus(utxoBundle?.runes[rune] ?? 0);
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
  const runeId = runeMetadata.id;
  const splitChar = runeId.includes('/') ? '/' : ':'; // old xord uses / as separator, new uses :
  const [height, index] = runeId.split(splitChar).map((x) => BigInt(x));
  const runeIdBigInt = (height << 16n) + index;

  const [runeIdVarint, amountVarInt] = await Promise.all([
    runesApi.getRuneVarintFromNum(BigNumber(runeIdBigInt.toString())),
    runesApi.getRuneVarintFromNum(amountBigNumber),
  ]);
  const ops = [];

  if (hasChange) {
    ops.push(
      runeTags.defaultOutput,
      2, // output index
    );
  }

  // body must be last in the script
  ops.push(
    runeTags.body,
    ...runeIdVarint, // rune id
    ...amountVarInt, // amount to send
    1, // index of output getting amount
  );

  const actions: Action[] = [
    {
      type: ActionType.SCRIPT,
      script: ['RETURN', new TextEncoder().encode(runeOp), new Uint8Array(ops)],
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
  const paymentUtxos = await context.paymentAddress.getUtxos();

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
        script: ['RETURN', new TextEncoder().encode(runeOp), new Uint8Array([runeTags.defaultOutput, 1])],
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
