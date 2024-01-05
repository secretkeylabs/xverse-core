import * as secp256k1 from '@noble/secp256k1';
import { base64, hex } from '@scure/base';
import * as btc from '@scure/btc-signer';
import * as bip39 from 'bip39';
import EsploraProvider from '../api/esplora/esploraAPiProvider';
import { signLedgerPSBT } from '../ledger/psbt';
import { Transport } from '../ledger/types';
import { AccountType, BtcTransactionData, NetworkType, RecommendedFeeResponse, UTXO } from '../types';
import { bip32 } from '../utils/bip32';
import { getBitcoinDerivationPath, getTaprootDerivationPath } from '../wallet';

// TODO: A lot of the below can be done much more easily with the consolidation logic
// TODO: so we should refactor this file to use that once merged

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
  getSeedPhrase: () => string | Promise<string>;
  accountId: number;
  network: NetworkType;
  accountType: AccountType;
  esploraProvider: EsploraProvider;
};

type TierFees = {
  enoughFunds: boolean;
  fee?: number;
  feeRate: number;
};

type CompileOptions = {
  feeRate: number;
  ledgerTransport?: Transport;
};

type RbfRecommendedFees = {
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

  private p2tr!: btc.P2TROut;

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
    } else {
      throw new Error('Unrecognised account type');
    }

    const publicKeyBuffTr = hex.decode(options.ordinalsPublicKey);
    const schnorrPublicKeyBuff = publicKeyBuffTr.length === 33 ? publicKeyBuffTr.slice(1) : publicKeyBuffTr;
    const p2tr = btc.p2tr(schnorrPublicKeyBuff, undefined, network);

    const tx = new btc.Transaction({ PSBTVersion: 0 });

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
    }));

    // we'll keep the same outputs as the original transaction
    // and we assume that any change that would have been returned was going to the payments address if the last
    // output is not the payments address, we'll add it as a normal output, assuming that there was no change
    while (outputs.length > 1 || (outputs[0] && outputs[0].address !== options.btcAddress)) {
      const [prevOutput] = outputs.splice(0, 1);

      if (!prevOutput.address) {
        throw new Error('Output address not found');
      }

      tx.addOutputAddress(prevOutput.address, BigInt(prevOutput.value), network);
      outputsTotal += prevOutput.value;
    }

    this.options = options;
    this.baseTx = tx;
    this.initialInputTotal = inputsTotal;
    this.initialOutputTotal = outputsTotal;
    this.transaction = transaction;
    this.network = network;
    this.p2btc = p2btc;
    this.p2tr = p2tr;
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

    return this._paymentUtxos;
  };

  private getBip32Master = async () => {
    // keep this method short so seed phrase is as short lived as possible
    const seedPhrase = await this.options.getSeedPhrase();
    const seed = await bip39.mnemonicToSeed(seedPhrase);
    return bip32.fromSeed(seed);
  };

  private signTxSoftware = async (transaction: btc.Transaction): Promise<btc.Transaction> => {
    const tx = btc.Transaction.fromPSBT(transaction.toPSBT(0));
    const master = await this.getBip32Master();

    const btcDerivationPath = getBitcoinDerivationPath({
      index: BigInt(this.options.accountId),
      network: this.options.network,
    });
    const btcChild = master.derivePath(btcDerivationPath);
    const btcpk = hex.decode(btcChild.privateKey!.toString('hex'));

    const trDerivationPath = getTaprootDerivationPath({
      index: BigInt(this.options.accountId),
      network: this.options.network,
    });
    const trChild = master.derivePath(trDerivationPath);
    let trpk = hex.decode(trChild.privateKey!.toString('hex'));
    if (trpk.length === 33) {
      trpk = trpk.slice(1);
    }

    for (let i = 0; i < tx.inputsLength; i++) {
      const input = tx.getInput(i);

      if (areByteArraysEqual(input.witnessUtxo?.script, this.p2tr.script)) {
        tx.signIdx(trpk, i);
      } else if (areByteArraysEqual(input.witnessUtxo?.script, this.p2btc.script)) {
        tx.signIdx(btcpk, i);
      } else {
        throw new Error(`Cannot sign input at index ${i}`);
      }
    }

    return tx;
  };

  private signTxLedger = async (transaction: btc.Transaction, options?: CompileOptions): Promise<btc.Transaction> => {
    if (!options?.ledgerTransport) {
      throw new Error('Options are required for non-dummy transactions');
    }

    const txnPsbt = transaction.toPSBT(0);
    const signedPsbtBase64 = await signLedgerPSBT({
      addressIndex: this.options.accountId,
      finalize: false,
      nativeSegwitPubKey: this.options.btcPublicKey,
      esploraProvider: this.options.esploraProvider,
      network: this.options.network,
      psbtInputBase64: base64.encode(txnPsbt),
      taprootPubKey: this.options.ordinalsPublicKey,
      transport: options.ledgerTransport,
    });

    const signedTransaction = btc.Transaction.fromPSBT(base64.decode(signedPsbtBase64));

    return signedTransaction;
  };

  private dummySignTransaction = async (transaction: btc.Transaction): Promise<btc.Transaction> => {
    const dummyPrivateKey = hex.decode('0000000000000000000000000000000000000000000000000000000000000001');
    const publicKey = secp256k1.getPublicKey(dummyPrivateKey, true);
    const p2wpkh = btc.p2wpkh(publicKey, this.network);
    const p2sh = btc.p2sh(p2wpkh, this.network);

    const schnorrPublicKeyBuff = publicKey.length === 33 ? publicKey.slice(1) : publicKey;
    const p2tr = btc.p2tr(schnorrPublicKeyBuff, undefined, this.network);

    const tx = btc.Transaction.fromPSBT(transaction.toPSBT(0));

    for (let i = 0; i < tx.inputsLength; i++) {
      const input = tx.getInput(i);
      if (input.tapInternalKey) {
        tx.updateInput(i, {
          witnessUtxo: {
            script: p2tr.script,
            amount: input.witnessUtxo!.amount,
          },
          tapInternalKey: p2tr.tapInternalKey,
        });
      } else if (input.redeemScript) {
        tx.updateInput(i, {
          witnessUtxo: {
            script: p2sh.script,
            amount: input.witnessUtxo!.amount,
          },
          redeemScript: p2sh.redeemScript,
          witnessScript: p2sh.witnessScript,
        });
      } else {
        tx.updateInput(i, {
          witnessUtxo: {
            script: p2wpkh.script,
            amount: input.witnessUtxo!.amount,
          },
        });
      }
    }

    tx.sign(dummyPrivateKey);

    return tx;
  };

  private signTx = async (
    tx: btc.Transaction,
    isDummy: boolean,
    options?: CompileOptions,
  ): Promise<btc.Transaction> => {
    if (isDummy) {
      return this.dummySignTransaction(tx);
    }

    if (this.options.accountType === 'ledger') {
      return this.signTxLedger(tx, options);
    }

    return this.signTxSoftware(tx);
  };

  private getTxSize = async (tx: btc.Transaction) => {
    const txCopy = btc.Transaction.fromPSBT(tx.toPSBT(0));
    const signedTxCopy = await this.signTx(txCopy, true);
    signedTxCopy.finalize();
    return signedTxCopy.vsize;
  };

  private compileTransaction = async (desiredFeeRate: number, isDummy: boolean, options?: CompileOptions) => {
    if (!isDummy && !options) {
      throw new Error('Options are required for non-dummy transactions');
    }

    const tx = btc.Transaction.fromPSBT(this.baseTx.toPSBT(0));

    const paymentUtxos = await this.getPaymentUtxos();

    let done = false;
    let actualFee = 0;
    let inputsTotal = this.initialInputTotal;
    let outputsTotal = this.initialOutputTotal;
    // ensure inputs can cover new fee rate
    while (!done) {
      const size = await this.getTxSize(tx);

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
        const sizeWithChange = await this.getTxSize(txWithChange);
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

    const signedTransaction = await this.signTx(tx, isDummy, options);
    signedTransaction.finalize();

    return {
      transaction: signedTransaction,
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
      const tx = await this.compileTransaction(feeRate, true);

      return {
        fee: tx.fee,
        feeRate: Math.ceil(tx.fee / tx.transaction.vsize),
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
    const { transaction, fee } = await this.compileTransaction(options.feeRate, false, options);
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
