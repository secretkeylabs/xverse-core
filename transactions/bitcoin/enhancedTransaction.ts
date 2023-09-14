import { Transaction } from '@scure/btc-signer';
import BigNumber from 'bignumber.js';

import EsploraClient from '../../api/esplora/esploraAPiProvider';

import { TransactionContext } from './context';
import { Action, ActionMap, ActionType, CompilationOptions } from './types';
import { applySendBtcActionsAndFee, applySendUtxoActions, applySplitUtxoActions, extractActionMap } from './utils';

const defaultOptions: CompilationOptions = {
  rbfEnabled: false,
};

const getOptionsWithDefaults = (options: CompilationOptions): CompilationOptions => {
  return { ...defaultOptions, ...options };
};

export class EnhancedTransaction {
  private _context!: TransactionContext;

  private _actions!: ActionMap;

  private _feeRate!: number;

  get feeRate(): number {
    return this._feeRate;
  }

  set feeRate(feeRate: number) {
    if (feeRate < 1) {
      throw new Error('Fee rate must be a natural number');
    }
    this._feeRate = feeRate;
  }

  constructor(context: TransactionContext, actions: Action[], feeRate: number) {
    this._context = context;
    this._feeRate = feeRate;

    this._actions = extractActionMap(actions);
  }

  private async compile(options: CompilationOptions) {
    if (Object.values(this._actions).flat().length === 0) {
      throw new Error('No actions to compile');
    }

    // order actions by type. Send Utxos first, then Ordinal extraction, then payment
    const transaction = new Transaction();

    const spendableSendUtxos = this._actions[ActionType.SEND_UTXO].filter((action) => action.spendable);
    const allSpendableSendUtxosToSameAddress = spendableSendUtxos.every(
      (action) => action.toAddress === spendableSendUtxos[0].toAddress,
    );

    if (spendableSendUtxos.length > 0) {
      // Spendable send utxo actions are designed for recovery purposes, and must be the only actions in the transaction
      // Otherwise things get complicated, and we don't want to support that
      if (this._actions[ActionType.SEND_UTXO].length !== spendableSendUtxos.length) {
        throw new Error('Send Utxo actions must either all be spendable or only none-spendable');
      } else if (this._actions[ActionType.SPLIT_UTXO].length > 0 || this._actions[ActionType.SEND_BTC].length > 0) {
        throw new Error('Send Utxo actions must be the only actions if they are spendable');
      } else if (!allSpendableSendUtxosToSameAddress) {
        throw new Error('Send Utxo actions must all be to the payment address if spendable');
      }
    }

    const {
      signActionList: sendUtxoSignActions,
      spentInscriptionUtxos: sendUtxoSpentInscriptionUtxos,
      spentUnconfirmedUtxos: sendUtxoSpentUnconfirmedUtxos,
    } = await applySendUtxoActions(this._context, options, transaction, this._actions[ActionType.SEND_UTXO]);

    const {
      signActionList: splitSignActions,
      spentInscriptionUtxos: splitSpentInscriptionUtxos,
      spentUnconfirmedUtxos: splitSpentUnconfirmedUtxos,
    } = await applySplitUtxoActions(this._context, options, transaction, this._actions[ActionType.SPLIT_UTXO]);

    const {
      actualFee,
      signActions: sendBtcSignActions,
      spentInscriptionUtxos: sendBtcSpentInscriptionUtxos,
      spentUnconfirmedUtxos: sendBtcSpentUnconfirmedUtxos,
    } = await applySendBtcActionsAndFee(
      this._context,
      options,
      transaction,
      this._actions[ActionType.SEND_BTC],
      this._feeRate,
      [...sendUtxoSignActions, ...splitSignActions],
    );

    // now that the transaction is built, we can sign it
    for (const executeSign of [...sendUtxoSignActions, ...splitSignActions, ...sendBtcSignActions]) {
      await executeSign(transaction);
    }

    transaction.finalize();

    return {
      actualFee,
      transaction,
      spentInscriptionUtxos: [
        ...sendUtxoSpentInscriptionUtxos,
        ...splitSpentInscriptionUtxos,
        ...sendBtcSpentInscriptionUtxos,
      ],
      spentUnconfirmedUtxos: [
        ...sendUtxoSpentUnconfirmedUtxos,
        ...splitSpentUnconfirmedUtxos,
        ...sendBtcSpentUnconfirmedUtxos,
      ],
    };
  }

  async getFeeSummary(options: CompilationOptions = {}) {
    const { actualFee, transaction, spentInscriptionUtxos, spentUnconfirmedUtxos } = await this.compile(
      getOptionsWithDefaults(options),
    );

    const vsize = transaction.vsize;

    const feeSummary = {
      fee: actualFee,
      feeRate: new BigNumber(actualFee.toString()).dividedBy(vsize).toNumber(),
      vsize,
      spentInscriptionUtxos,
      spentUnconfirmedUtxos,
    };

    return feeSummary;
  }

  async getTransactionHexAndId(options: CompilationOptions = {}) {
    const { transaction } = await this.compile(getOptionsWithDefaults(options));

    return { hex: transaction.hex, id: transaction.id };
  }

  async broadcast(options: CompilationOptions = {}) {
    const { transaction } = await this.compile(getOptionsWithDefaults(options));

    const transactionHex = transaction.hex;

    const esploraClient = new EsploraClient({ network: this._context.network });

    await esploraClient.sendRawTransaction(transactionHex);

    return transaction.id;
  }
}
