import { SigHash, Transaction } from '@scure/btc-signer';

import EsploraClient from '../../api/esplora/esploraAPiProvider';

import { applySendBtcActionsAndFee, applySendUtxoActions, applySplitUtxoActions } from './actionProcessors';
import { TransactionContext } from './context';
import {
  Action,
  ActionMap,
  ActionType,
  CompilationOptions,
  EnhancedInput,
  TransactionFeeOutput,
  TransactionOptions,
  TransactionOutput,
  TransactionSummary,
} from './types';
import { extractActionMap, extractOutputInscriptionsAndSatributes, mapInputToEnhancedInput } from './utils';

const defaultCompilationOptions: CompilationOptions = {
  rbfEnabled: false,
};

const getOptionsWithDefaults = (options: CompilationOptions): CompilationOptions => {
  return { ...defaultCompilationOptions, ...options };
};

const defaultTransactionOptions: TransactionOptions = {
  excludeOutpointList: [],
  useEffectiveFeeRate: false,
  allowUnconfirmedInput: true,
};

export class EnhancedTransaction {
  private readonly _context!: TransactionContext;

  private readonly _actions!: ActionMap;

  private readonly _feeRate!: number;

  private readonly _overrideChangeAddress?: string;

  private readonly _options!: TransactionOptions;

  get overrideChangeAddress(): string | undefined {
    return this._overrideChangeAddress;
  }

  get feeRate(): number {
    return this._feeRate;
  }

  get options(): TransactionOptions {
    return { ...this._options, excludeOutpointList: [...(this._options.excludeOutpointList ?? [])] };
  }

  constructor(context: TransactionContext, actions: Action[], feeRate: number, options?: TransactionOptions) {
    this._context = context;
    this._feeRate = feeRate;
    this._options = { ...defaultTransactionOptions, ...options };

    if (!actions.length) {
      throw new Error('No actions provided for transaction context');
    }

    this._actions = extractActionMap(actions);

    const spendableSendUtxos = this._actions[ActionType.SEND_UTXO].filter((action) => action.spendable);
    const allSpendableSendUtxosToSameAddress = spendableSendUtxos.every(
      (action) => action.toAddress === spendableSendUtxos[0].toAddress,
    );

    if (spendableSendUtxos.length > 0) {
      // Spendable send utxo actions are designed for recovery purposes, and must be the only actions in the transaction
      // Otherwise things get complicated, and we don't want to support that
      if (this._actions[ActionType.SEND_UTXO].length !== spendableSendUtxos.length) {
        throw new Error('Send Utxo actions must either all be spendable or only non-spendable');
      } else if (this._actions[ActionType.SPLIT_UTXO].length > 0 || this._actions[ActionType.SEND_BTC].length > 0) {
        throw new Error('Send Utxo actions must be the only actions if they are spendable');
      } else if (!allSpendableSendUtxosToSameAddress) {
        throw new Error('Send Utxo actions must all be to the same address if spendable');
      }

      this._overrideChangeAddress = spendableSendUtxos[0].toAddress;
    }
  }

  private async compile(options: CompilationOptions, dummySign: boolean) {
    // order actions by type. Send Utxos first, then Ordinal extraction, then payment
    const transaction = new Transaction({ PSBTVersion: 0 });

    const { inputs: sendInputs, outputs: sendOutputs } = await applySendUtxoActions(
      this._context,
      options,
      transaction,
      this._options,
      this._actions[ActionType.SEND_UTXO],
    );

    const { inputs: splitInputs, outputs: splitOutputs } = await applySplitUtxoActions(
      this._context,
      options,
      transaction,
      this._options,
      this._actions[ActionType.SPLIT_UTXO],
    );

    const {
      actualFee,
      actualFeeRate,
      effectiveFeeRate,
      inputs: sendBtcInputs,
      outputs: sendBtcOutputs,
      dustValue,
    } = await applySendBtcActionsAndFee(
      this._context,
      options,
      transaction,
      this._options,
      this._actions[ActionType.SEND_BTC],
      this._feeRate,
      this._overrideChangeAddress,
    );

    const inputs = [...sendInputs, ...splitInputs, ...sendBtcInputs];
    const outputsRaw: Omit<TransactionOutput, 'inscriptions' | 'satributes'>[] = [
      ...sendOutputs,
      ...splitOutputs,
      ...sendBtcOutputs,
      // we add a dummy output to track the fee
      {
        address: '',
        amount: Number(actualFee),
      },
    ];
    const outputs: TransactionOutput[] = [];

    let currentOffset = 0;
    for (const outputRaw of outputsRaw) {
      const amount = outputRaw.amount;
      const { inscriptions, satributes } = await extractOutputInscriptionsAndSatributes(inputs, currentOffset, amount);

      const output: TransactionOutput = { ...outputRaw, inscriptions, satributes };
      outputs.push(output);

      currentOffset += Number(amount);
    }

    // we know there is at least the dummy fee output which we added above
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const { address, ...feeOutput } = outputs.pop()!;

    // now that the transaction is built, we can sign it
    if (dummySign) {
      await this._context.dummySignTransaction(transaction);
    } else {
      await this._context.signTransaction(transaction, options);
    }

    transaction.finalize();

    const enhancedInputs: EnhancedInput[] = await Promise.all(
      inputs.map((i) => mapInputToEnhancedInput(i, SigHash.ALL)),
    );

    return {
      actualFee,
      actualFeeRate,
      effectiveFeeRate,
      transaction,
      inputs: enhancedInputs,
      outputs,
      feeOutput: feeOutput as TransactionFeeOutput,
      dustValue,
    };
  }

  async getSummary(options: CompilationOptions = {}): Promise<TransactionSummary> {
    const { actualFee, actualFeeRate, effectiveFeeRate, transaction, inputs, outputs, feeOutput, dustValue } =
      await this.compile(getOptionsWithDefaults(options), true);

    const vsize = transaction.vsize;

    const feeSummary = {
      fee: actualFee,
      feeRate: actualFeeRate,
      effectiveFeeRate,
      vsize,
      inputs,
      outputs,
      feeOutput,
      dustValue,
    };

    return feeSummary;
  }

  async getTransactionHexAndId(options: CompilationOptions = {}) {
    const { transaction } = await this.compile(getOptionsWithDefaults(options), false);

    return { hex: transaction.hex, id: transaction.id };
  }

  async broadcast(options: CompilationOptions = {}) {
    const { hex: transactionHex, id } = await this.getTransactionHexAndId(options);

    const esploraClient = new EsploraClient({ network: this._context.network });
    await esploraClient.sendRawTransaction(transactionHex);

    return id;
  }
}
