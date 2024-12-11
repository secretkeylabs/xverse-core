import { SigHash, Transaction, TxOpts } from '@scure/btc-signer';

import { getRunesClient } from '../../api/runes/provider';
import { isInscriptionsAndRunesCompatible } from '../btcNetwork';

import {
  applyScriptActions,
  applySendBtcActionsAndFee,
  applySendUtxoActions,
  applySplitUtxoActions,
} from './actionProcessors';
import { TransactionContext } from './context';
import {
  Action,
  ActionMap,
  ActionType,
  CompilationOptions,
  EnhancedInput,
  IOInscription,
  IOSatribute,
  TransactionFeeOutput,
  TransactionOptions,
  TransactionOutput,
  TransactionSummary,
} from './types';
import {
  extractActionMap,
  extractOutputInscriptionsAndSatributes,
  getTransactionVSize,
  mapInputToEnhancedInput,
} from './utils';

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

  private readonly _options!: TransactionOptions;

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

    if (!actions.length && !this._options.forceIncludeOutpointList?.length) {
      throw new Error('No actions provided for transaction context');
    }

    this._actions = extractActionMap(actions);
  }

  private async compile(options: CompilationOptions) {
    // order actions by type. Send Utxos first, then Ordinal extraction, then payment
    const txnOpts: TxOpts = { PSBTVersion: 2 };

    if (this._options.allowUnknownInputs) {
      txnOpts.allowUnknownInputs = true;
    }

    if (this._options.allowUnknownOutputs) {
      txnOpts.allowUnknownOutputs = true;
    }

    const transaction = new Transaction(txnOpts);

    const { outputs: scriptOutputs } = await applyScriptActions(transaction, this._actions[ActionType.SCRIPT]);

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
    );

    const inputs = [...sendInputs, ...splitInputs, ...sendBtcInputs];

    // build friendly outputs
    const outputsRaw: Omit<TransactionOutput, 'inscriptions' | 'satributes'>[] = [
      ...sendOutputs,
      ...splitOutputs,
      ...sendBtcOutputs,
      // we add a dummy output to track the fee
      {
        type: 'address',
        address: '',
        script: [],
        scriptHex: '',
        amount: Number(actualFee),
      },
    ];

    const nonScriptOutputs: TransactionOutput[] = [];

    let currentOffset = 0;
    for (const outputRaw of outputsRaw) {
      const amount = outputRaw.amount;

      let inscriptions: IOInscription[] = [];
      let satributes: IOSatribute[] = [];
      if (isInscriptionsAndRunesCompatible(this._context.network)) {
        const result = await extractOutputInscriptionsAndSatributes(inputs, currentOffset, amount);
        inscriptions = result.inscriptions;
        satributes = result.satributes;
      }

      const output: TransactionOutput = { ...outputRaw, inscriptions, satributes };
      nonScriptOutputs.push(output);

      currentOffset += Number(amount);
    }

    // extract rune script data via API if valid runes script exists
    const runesClient = getRunesClient(this._context.network);
    const runeOp = scriptOutputs.length > 0 ? await runesClient.getDecodedRuneScript(transaction.hex) : undefined;

    // we know there is at least the dummy fee output which we added above
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const { address, script, scriptHex, ...feeOutput } = nonScriptOutputs.pop()!;

    const enhancedInputs: EnhancedInput[] = await Promise.all(
      inputs.map((i) => mapInputToEnhancedInput(i, true, SigHash.ALL)),
    );

    return {
      actualFee,
      actualFeeRate,
      effectiveFeeRate,
      transaction,
      inputs: enhancedInputs,
      outputs: [...scriptOutputs, ...nonScriptOutputs],
      feeOutput: { ...feeOutput, type: 'fee' } as TransactionFeeOutput,
      runeOp,
      dustValue,
    };
  }

  async getSummary(options: CompilationOptions = {}): Promise<TransactionSummary> {
    const { actualFee, actualFeeRate, effectiveFeeRate, transaction, inputs, outputs, feeOutput, runeOp, dustValue } =
      await this.compile(getOptionsWithDefaults(options));

    const vsize = getTransactionVSize(this._context, transaction);

    const feeSummary = {
      fee: actualFee,
      feeRate: actualFeeRate,
      effectiveFeeRate,
      vsize,
      inputs,
      outputs,
      feeOutput,
      runeOp,
      dustValue,
    };

    return feeSummary;
  }

  async getTransactionHexAndId(options: CompilationOptions = {}) {
    const { transaction } = await this.compile(getOptionsWithDefaults(options));

    await this._context.signTransaction(transaction, options);
    transaction.finalize();

    return { hex: transaction.hex, id: transaction.id };
  }

  async broadcast(options: CompilationOptions = {}) {
    const { hex: transactionHex, id } = await this.getTransactionHexAndId(options);

    await this._context.btcClient.sendRawTransaction(transactionHex);

    return id;
  }
}
