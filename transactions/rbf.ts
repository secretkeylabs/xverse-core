import { hex } from '@scure/base';
import * as btc from '@scure/btc-signer';
import EsploraProvider from '../api/esplora/esploraAPiProvider';
import { Transport } from '../ledger/types';
import { AccountType, BtcTransactionData, NetworkType, RecommendedFeeResponse, UTXO } from '../types';
import { TransactionContext } from './bitcoin';
import { estimateVSize } from './bitcoin/utils/transactionVsizeEstimator';

const areByteArraysEqual = (a: undefined | Uint8Array, b: undefined | Uint8Array): boolean => {
  if (!a || !b || a.length !== b.length) {
    return false;
  }

  return a.every((v, i) => v === b[i]);
};

const getTransactionChainSizeAndFee = async (esploraProvider: EsploraProvider, txid: string, depth = 1) => {
  if (depth > 30) {
    // This should never happen as bitcoins limit is 25. This is a recursion safety check.
    throw new Error('Too many chained transactions');
  }

  const transaction = await esploraProvider.getTransaction(txid);

  if (!transaction || transaction.status.confirmed) {
    throw new Error('Invalid transaction for RBF detected.');
  }

  const transactionVSize = transaction.weight / 4;
  let totalVSize = transaction.weight / 4;
  let fee = transaction.fee;

  const outspends = await esploraProvider.getTransactionOutspends(txid);

  for (const outspend of outspends) {
    if (!outspend.spent) {
      continue;
    }

    const descendantTxid = outspend.txid;
    const { totalVSize: descendantVsize, fee: descendantFee } = await getTransactionChainSizeAndFee(
      esploraProvider,
      descendantTxid,
      depth + 1,
    );
    totalVSize += descendantVsize;
    fee += descendantFee;
  }

  return { transactionVSize, totalVSize, fee };
};

const getRbfTransactionSummary = async (esploraProvider: EsploraProvider, txid: string) => {
  const { transactionVSize, totalVSize, fee } = await getTransactionChainSizeAndFee(esploraProvider, txid);

  const currentFeeRate = +(fee / totalVSize).toFixed(2);

  const minimumRbfFee = Math.ceil(fee + totalVSize);
  const minimumRbfFeeRate = Math.ceil(+(minimumRbfFee / transactionVSize).toFixed(2));

  return { currentFee: fee, currentFeeRate, minimumRbfFee, minimumRbfFeeRate };
};

const isTransactionRbfEnabled = (transaction: BtcTransactionData, wallet: RBFProps) => {
  if (transaction.confirmed) {
    return false;
  }

  const inputsEnabled = transaction.inputs.some((input) => input.sequence < 0xffffffff - 1);

  if (!inputsEnabled) {
    return false;
  }

  const network = wallet.network === 'Mainnet' ? btc.NETWORK : btc.TEST_NETWORK;

  let p2btc: btc.P2Ret;
  const publicKeyBuff = hex.decode(wallet.btcPublicKey);
  if (wallet.accountType === 'software') {
    const p2wpkh = btc.p2wpkh(publicKeyBuff, network);
    p2btc = btc.p2sh(p2wpkh, network);
  } else if (wallet.accountType === 'ledger') {
    p2btc = btc.p2wpkh(publicKeyBuff, network);
  } else if (wallet.accountType === 'keystone') {
    p2btc = btc.p2wpkh(publicKeyBuff, network);
  } else {
    throw new Error('Unrecognised account type');
  }

  const publicKeyBuffTr = hex.decode(wallet.ordinalsPublicKey);
  const schnorrPublicKeyBuff = publicKeyBuffTr.length === 33 ? publicKeyBuffTr.slice(1) : publicKeyBuffTr;
  const p2tr = btc.p2tr(schnorrPublicKeyBuff, undefined, network);

  return transaction.inputs.every((input) => {
    const witnessUtxoScript = Buffer.from(input.prevout.scriptpubkey, 'hex');
    return areByteArraysEqual(witnessUtxoScript, p2tr.script) || areByteArraysEqual(witnessUtxoScript, p2btc.script);
  });
};

export type RBFProps = {
  btcAddress: string;
  ordinalsAddress: string;
  btcPublicKey: string;
  ordinalsPublicKey: string;
  accountId: number;
  network: NetworkType;
  accountType: AccountType;
  esploraProvider: EsploraProvider;
};

export type TierFees = {
  enoughFunds: boolean;
  fee?: number;
  feeRate: number;
};

type CompileOptions = {
  feeRate: number;
  ledgerTransport?: Transport;
  context: TransactionContext;
};

export type RbfRecommendedFees = {
  medium?: TierFees;
  high?: TierFees;
  higher?: TierFees;
  highest?: TierFees;
};

class RbfTransaction {
  private baseTx: btc.Transaction;

  private initialInputTotal!: number;

  private initialOutputTotal!: number;

  private transaction!: BtcTransactionData;

  private p2btc!: btc.P2Ret;

  private network!: typeof btc.NETWORK;

  private options!: RBFProps;

  private _paymentUtxos?: UTXO[];

  private _minimumRbfFeeRate?: number;

  constructor(transaction: BtcTransactionData, options: RBFProps) {
    if (transaction.confirmed) {
      throw new Error('Transaction is already confirmed');
    }
    if (!isTransactionRbfEnabled(transaction, options)) {
      throw new Error('Not RBF enabled transaction');
    }

    const network = options.network === 'Mainnet' ? btc.NETWORK : btc.TEST_NETWORK;

    let p2btc: btc.P2Ret;
    const publicKeyBuff = hex.decode(options.btcPublicKey);
    if (options.accountType === 'software') {
      const p2wpkh = btc.p2wpkh(publicKeyBuff, network);
      p2btc = btc.p2sh(p2wpkh, network);
    } else if (options.accountType === 'ledger') {
      p2btc = btc.p2wpkh(publicKeyBuff, network);
    } else if (options.accountType === 'keystone') {
      p2btc = btc.p2wpkh(publicKeyBuff, network);
    } else {
      throw new Error('Unrecognised account type');
    }

    const publicKeyBuffTr = hex.decode(options.ordinalsPublicKey);
    const schnorrPublicKeyBuff = publicKeyBuffTr.length === 33 ? publicKeyBuffTr.slice(1) : publicKeyBuffTr;
    const p2tr = btc.p2tr(schnorrPublicKeyBuff, undefined, network);

    const tx = new btc.Transaction({ PSBTVersion: 0, allowUnknownOutputs: true });

    let inputsTotal = 0;
    let outputsTotal = 0;

    for (const input of transaction.inputs) {
      const witnessUtxoScript = Buffer.from(input.prevout.scriptpubkey, 'hex');

      tx.addInput({
        txid: input.txid,
        index: input.vout,
        witnessUtxo: {
          script: witnessUtxoScript,
          amount: BigInt(input.prevout.value),
        },
        sequence: 0xfffffffd,
      });

      inputsTotal += input.prevout.value;

      if (areByteArraysEqual(witnessUtxoScript, p2tr.script)) {
        // input from ordinals address
        tx.updateInput(tx.inputsLength - 1, {
          tapInternalKey: p2tr.tapInternalKey,
        });
      } else if (areByteArraysEqual(witnessUtxoScript, p2btc.script)) {
        // input from payments address
        // these are undefined for p2wpkh (ledger) addresses
        tx.updateInput(tx.inputsLength - 1, {
          redeemScript: p2btc.redeemScript,
          witnessScript: p2btc.witnessScript,
        });
      } else {
        throw new Error('Input found that is not from wallet. Cannot proceed with RBF.');
      }
    }

    const outputs = transaction.outputs.map((output) => ({
      value: output.value,
      address: output.scriptpubkey_address,
      script: output.scriptpubkey,
    }));

    // we'll keep the same outputs as the original transaction
    // and we assume that any change that would have been returned was going to the payments address if the last
    // output is not the payments address, we'll add it as a normal output, assuming that there was no change
    while (outputs.length > 1 || (outputs[0] && outputs[0].address !== options.btcAddress)) {
      const prevOutput = outputs.shift();

      if (!prevOutput) {
        // this should never happen
        throw new Error('Something went wrong when processing the outputs of the original transaction');
      }

      tx.addOutput({ script: prevOutput.script, amount: BigInt(prevOutput.value) });
      outputsTotal += prevOutput.value;
    }

    this.options = options;
    this.baseTx = tx;
    this.initialInputTotal = inputsTotal;
    this.initialOutputTotal = outputsTotal;
    this.transaction = transaction;
    this.network = network;
    this.p2btc = p2btc;
  }

  private getMinimumRbfFeeRate = async () => {
    if (!this._minimumRbfFeeRate) {
      const { minimumRbfFeeRate } = await getRbfTransactionSummary(this.options.esploraProvider, this.transaction.txid);
      this._minimumRbfFeeRate = minimumRbfFeeRate;
    }

    return this._minimumRbfFeeRate;
  };

  private getPaymentUtxos = async () => {
    if (!this._paymentUtxos) {
      this._paymentUtxos = await this.options.esploraProvider.getUnspentUtxos(this.options.btcAddress);

      this._paymentUtxos.sort((a, b) => {
        const aConfirmed = a.status.confirmed;
        const bConfirmed = b.status.confirmed;

        // put confirmed UTXOs first
        if (aConfirmed && !bConfirmed) {
          return -1;
        } else if (!aConfirmed && bConfirmed) {
          return 1;
        }

        return b.value - a.value;
      });
    }

    return [...this._paymentUtxos];
  };

  private compileTransaction = async (desiredFeeRate: number, sign: boolean, options?: CompileOptions) => {
    if (sign && !options) {
      throw new Error('Options are required for signing RBF transactions');
    }

    const tx = btc.Transaction.fromPSBT(this.baseTx.toPSBT(0));

    const paymentUtxos = await this.getPaymentUtxos();

    let done = false;
    let actualFee = 0;
    let inputsTotal = this.initialInputTotal;
    let outputsTotal = this.initialOutputTotal;
    // ensure inputs can cover new fee rate
    while (!done) {
      const size = estimateVSize(tx, { network: this.options.network });

      const change = inputsTotal - outputsTotal;
      const newFee = Math.max(size * desiredFeeRate, this.transaction.fees + size);
      if (newFee > change) {
        const utxo = paymentUtxos.shift();

        if (!utxo) {
          throw new Error('Not enough funds');
        }

        tx.addInput({
          txid: utxo.txid,
          index: utxo.vout,
          witnessUtxo: {
            script: this.p2btc.script,
            amount: BigInt(utxo.value),
          },
          redeemScript: this.p2btc.redeemScript,
          witnessScript: this.p2btc.witnessScript,
          sequence: 0xfffffffd,
        });
        inputsTotal += utxo.value;
      } else {
        // check if we can add change output
        const txWithChange = btc.Transaction.fromPSBT(tx.toPSBT(0));
        actualFee = change;
        txWithChange.addOutputAddress(this.options.btcAddress, BigInt(change), this.network);
        const sizeWithChange = estimateVSize(txWithChange, { network: this.options.network });
        const newFeeWithChange = Math.max(sizeWithChange * desiredFeeRate, this.transaction.fees + sizeWithChange);

        if (newFeeWithChange + 1000 < change) {
          // add change output
          actualFee = Math.ceil(newFeeWithChange);
          const actualChange = change - actualFee;
          tx.addOutputAddress(this.options.btcAddress, BigInt(actualChange), this.network);
          outputsTotal += actualChange;
        }

        done = true;
      }
    }

    if (sign) {
      if (!options) {
        throw new Error('Options are required for signing RBF transactions');
      }

      await options.context.signTransaction(tx, options);
      tx.finalize();
    }

    return {
      transaction: tx,
      fee: actualFee,
    };
  };

  private constructRecommendedFees = async (
    lowerName: keyof RbfRecommendedFees,
    lowerFeeRate: number,
    higherName: keyof RbfRecommendedFees,
    higherFeeRate: number,
  ): Promise<RbfRecommendedFees> => {
    const [lowerTx, higherTx] = await Promise.all([
      this.getRbfFeeSummary(lowerFeeRate),
      this.getRbfFeeSummary(higherFeeRate),
    ]);
    return {
      [lowerName]: lowerTx,
      [higherName]: higherTx,
    };
  };

  getRbfFeeSummary = async (feeRateRaw: number): Promise<TierFees> => {
    const feeRate = Math.ceil(feeRateRaw);
    const minimumRbfFeeRate = await this.getMinimumRbfFeeRate();

    if (feeRate < minimumRbfFeeRate) {
      throw new Error('Fee rate is below RBF minimum fee rate');
    }

    try {
      const tx = await this.compileTransaction(feeRate, false);

      const vSize = estimateVSize(tx.transaction, { network: this.options.network });

      return {
        fee: tx.fee,
        feeRate: Math.ceil(tx.fee / vSize),
        enoughFunds: true,
      };
    } catch (e) {
      if (!e.message.includes('Not enough funds')) {
        throw e;
      }

      return {
        fee: undefined,
        feeRate,
        enoughFunds: false,
      };
    }
  };

  getRbfRecommendedFees = async (mempoolFees: RecommendedFeeResponse): Promise<RbfRecommendedFees> => {
    const minimumRbfFeeRate = await this.getMinimumRbfFeeRate();
    const { halfHourFee, fastestFee } = mempoolFees;

    // For testnet, medium and high are the same
    const medium = halfHourFee;
    const high = Math.max(fastestFee, medium + 1);

    if (minimumRbfFeeRate <= medium) {
      return this.constructRecommendedFees('medium', medium, 'high', high);
    }

    if (minimumRbfFeeRate <= high) {
      const higher = Math.max(high + 1, Math.ceil(high * 1.2));
      return this.constructRecommendedFees('high', high, 'higher', higher);
    }

    const higher = minimumRbfFeeRate * 1.1;
    const highest = Math.max(higher + 1, minimumRbfFeeRate * 1.2);

    return this.constructRecommendedFees('higher', higher, 'highest', highest);
  };

  getReplacementTransaction = async (options: CompileOptions) => {
    const { transaction, fee } = await this.compileTransaction(options.feeRate, true, options);
    return {
      transaction,
      hex: transaction.hex,
      fee,
      feeRate: Math.ceil(fee / transaction.vsize),
    };
  };
}

export default {
  RbfTransaction,
  isTransactionRbfEnabled,
  getRbfTransactionSummary,
};
