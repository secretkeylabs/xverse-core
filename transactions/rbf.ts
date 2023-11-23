import { hex } from '@scure/base';
import * as btc from '@scure/btc-signer';
import * as bip39 from 'bip39';
import EsploraProvider from '../api/esplora/esploraAPiProvider';
import SeedVault from '../seedVault';
import { NetworkType } from '../types';
import { RecommendedFeeResponse, Transaction, UTXO } from '../types/api/esplora';
import { bip32 } from '../utils/bip32';
import { getBitcoinDerivationPath, getTaprootDerivationPath } from '../wallet';

// TODO: A lot of the below can be done much more easily with the consolidation logic
// TODO: so we should refactor this file to use that once merged
// TODO: without it there will also have to be a separate RBF module for ledger, so we can merge them once it's in

const areByteArraysEqual = (a: undefined | Uint8Array, b: undefined | Uint8Array): boolean => {
  if (!a || !b || a.length !== b.length) {
    return false;
  }

  return a.every((v, i) => v === b[i]);
};

const getRbfTransactionSummary = (transaction: Transaction) => {
  const transactionVSize = transaction.weight / 4;

  const currentTransactionInputTotals = transaction.vin.reduce((total, input) => total + input.prevout.value, 0);
  const currentTransactionOutputTotals = transaction.vout.reduce((total, output) => total + output.value, 0);

  const currentFee = currentTransactionInputTotals - currentTransactionOutputTotals;
  const currentFeeRate = Math.ceil(currentFee / transactionVSize);

  const minimumRbfFee = Math.ceil(transaction.fee + transactionVSize);
  const minimumRbfFeeRate = Math.ceil(minimumRbfFee / transactionVSize);

  return { currentFee, currentFeeRate, minimumRbfFee, minimumRbfFeeRate };
};

const isTransactionRbfEnabled = (transaction: Transaction) => {
  if (transaction.status.confirmed) {
    return false;
  }

  return transaction.vin.some((input) => input.sequence < 0xffffffff - 1);
};

type RBFProps = {
  btcAddress: string;
  ordinalsAddress: string;
  btcPublicKey: string;
  ordinalsPublicKey: string;
  seedVault: SeedVault;
  addressIndex: number;
  network: NetworkType;
};

type TierFees = {
  enoughFunds: boolean;
  fee?: number;
  feeRate: number;
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

  private transaction!: Transaction;

  private p2sh!: btc.P2Ret;

  private p2tr!: btc.P2TROut;

  private network!: typeof btc.NETWORK;

  private wallet!: RBFProps;

  private paymentUtxos?: UTXO[];

  constructor(transaction: Transaction, wallet: RBFProps) {
    if (transaction.status.confirmed) {
      throw new Error('Transaction is already confirmed');
    }
    if (!isTransactionRbfEnabled(transaction)) {
      throw new Error('Not RBF enabled transaction');
    }

    const network = wallet.network === 'Mainnet' ? btc.NETWORK : btc.TEST_NETWORK;

    const publicKeyBuff = hex.decode(wallet.btcPublicKey);
    const p2wpkh = btc.p2wpkh(publicKeyBuff, network);
    const p2sh = btc.p2sh(p2wpkh, network);

    const publicKeyBuffTr = hex.decode(wallet.ordinalsPublicKey);
    const p2tr = btc.p2tr(publicKeyBuffTr, undefined, network);

    const tx = new btc.Transaction();

    let inputsTotal = 0;
    let outputsTotal = 0;

    for (const input of transaction.vin) {
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
          tapInternalKey: publicKeyBuffTr,
        });
      } else if (areByteArraysEqual(witnessUtxoScript, p2sh.script)) {
        // input from payments address
        // these are undefined for p2wpkh (ledger) addresses
        tx.updateInput(tx.inputsLength - 1, {
          redeemScript: p2sh.redeemScript,
          witnessScript: p2sh.witnessScript,
        });
      } else {
        throw new Error('Input found that is not from wallet. Cannot proceed with RBF.');
      }
    }

    const outputs = transaction.vout.map((output) => ({
      value: output.value,
      address: output.scriptpubkey_address,
    }));

    // we'll keep the same outputs as the original transaction
    // and we assume that any change that would have been returned was going to the payments address if the last
    // output is not the payments address, we'll add it as a normal output, assuming that there was no change
    while (outputs.length > 1 || (outputs[0] && outputs[0].address !== wallet.btcAddress)) {
      const [prevOutput] = outputs.splice(0, 1);

      if (!prevOutput.address) {
        throw new Error('Output address not found');
      }

      tx.addOutputAddress(prevOutput.address, BigInt(prevOutput.value), network);
      outputsTotal += prevOutput.value;
    }

    this.wallet = wallet;
    this.baseTx = tx;
    this.initialInputTotal = inputsTotal;
    this.initialOutputTotal = outputsTotal;
    this.transaction = transaction;
    this.network = network;
    this.p2sh = p2sh;
    this.p2tr = p2tr;
  }

  private getPaymentUtxos = async () => {
    if (!this.paymentUtxos) {
      const esploraProvider = new EsploraProvider({ network: this.wallet.network });
      this.paymentUtxos = await esploraProvider.getUnspentUtxos(this.wallet.btcAddress);

      this.paymentUtxos.sort((a, b) => {
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

    return this.paymentUtxos;
  };

  private getBip32Master = async () => {
    // keep this method short so seed phrase is as short lived as possible
    const seedPhrase = await this.wallet.seedVault.getSeed();
    const seed = await bip39.mnemonicToSeed(seedPhrase);
    return bip32.fromSeed(seed);
  };

  private signTx = async (tx: btc.Transaction) => {
    const master = await this.getBip32Master();

    const btcDerivationPath = getBitcoinDerivationPath({
      index: BigInt(this.wallet.addressIndex),
      network: this.wallet.network,
    });
    const btcChild = master.derivePath(btcDerivationPath);
    const btcpk = hex.decode(btcChild.privateKey!.toString('hex'));

    const trDerivationPath = getTaprootDerivationPath({
      index: BigInt(this.wallet.addressIndex),
      network: this.wallet.network,
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
      } else if (areByteArraysEqual(input.witnessUtxo?.script, this.p2sh.script)) {
        tx.signIdx(btcpk, i);
      } else {
        throw new Error(`Cannot sign input at index ${i}`);
      }
    }
  };

  private getTxSize = async (tx: btc.Transaction) => {
    const txCopy = tx.clone();
    await this.signTx(txCopy);
    txCopy.finalize();
    return txCopy.vsize;
  };

  private compileTransaction = async (desiredFeeRate: number) => {
    const tx = this.baseTx.clone();

    const paymentUtxos = await this.getPaymentUtxos();

    let done = false;
    let actualFee = 0;
    let inputsTotal = this.initialInputTotal;
    let outputsTotal = this.initialOutputTotal;
    // ensure inputs can cover new fee rate
    while (!done) {
      const size = await this.getTxSize(tx);

      const change = inputsTotal - outputsTotal;
      const newFee = Math.max(size * desiredFeeRate, this.transaction.fee + size);
      if (newFee > change) {
        const utxo = paymentUtxos.shift();

        if (!utxo) {
          throw new Error('Not enough funds');
        }

        tx.addInput({
          txid: utxo.txid,
          index: utxo.vout,
          witnessUtxo: {
            script: this.p2sh.script,
            amount: BigInt(utxo.value),
          },
          redeemScript: this.p2sh.redeemScript,
          witnessScript: this.p2sh.witnessScript,
          sequence: 0xfffffffd,
        });
        inputsTotal += utxo.value;
      } else {
        // check if we can add change output
        const txWithChange = tx.clone();
        actualFee = change;
        txWithChange.addOutputAddress(this.wallet.btcAddress, BigInt(Math.floor(change)), this.network);
        const sizeWithChange = await this.getTxSize(txWithChange);
        const newFeeWithChange = Math.max(sizeWithChange * desiredFeeRate, this.transaction.fee + sizeWithChange);

        if (newFeeWithChange + 1000 < change) {
          // add change output
          actualFee = newFeeWithChange;
          const actualChange = change - newFeeWithChange;
          tx.addOutputAddress(this.wallet.btcAddress, BigInt(Math.floor(actualChange)), this.network);
          outputsTotal += actualChange;
        }

        done = true;
      }
    }

    await this.signTx(tx);
    tx.finalize();

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
    const [lowerTx, higherTx] = await Promise.allSettled([
      this.compileTransaction(lowerFeeRate),
      this.compileTransaction(higherFeeRate),
    ]);
    return {
      [lowerName]: {
        fee: lowerTx.status === 'fulfilled' ? lowerTx.value.fee : undefined,
        feeRate: lowerFeeRate,
        enoughFunds: lowerTx.status === 'fulfilled',
      },
      [higherName]: {
        fee: higherTx.status === 'fulfilled' ? higherTx.value.fee : undefined,
        feeRate: higherFeeRate,
        enoughFunds: higherTx.status === 'fulfilled',
      },
    };
  };

  getRbfRecommendedFees = async (mempoolFees: RecommendedFeeResponse): Promise<RbfRecommendedFees> => {
    const { minimumRbfFeeRate } = getRbfTransactionSummary(this.transaction);

    const { halfHourFee: medium, fastestFee: high } = mempoolFees;

    if (minimumRbfFeeRate < medium) {
      return this.constructRecommendedFees('medium', medium, 'high', high);
    }

    if (minimumRbfFeeRate < high) {
      return this.constructRecommendedFees('high', high, 'higher', Math.ceil(high * 1.2));
    }

    return this.constructRecommendedFees(
      'higher',
      Math.ceil(minimumRbfFeeRate * 1.1),
      'highest',
      Math.ceil(minimumRbfFeeRate * 1.2),
    );
  };

  getReplacementTransaction = async (feeRate: number) => {
    const { transaction, fee } = await this.compileTransaction(feeRate);
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
