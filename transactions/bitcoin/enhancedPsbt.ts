import { sha256 } from '@noble/hashes/sha256';
import { base64, hex } from '@scure/base';
import * as btc from '@scure/btc-signer';
import { utils } from 'micro-packed';

import { TransactionInput } from '@scure/btc-signer/psbt';
import { getRunesClient } from '../../api';
import { PAY_TO_ANCHOR_SCRIPT_HEX } from '../../constant';
import { UTXO } from '../../types';
import { getBtcNetworkDefinition, isInscriptionsAndRunesCompatible } from '../btcNetwork';
import { InputToSign, TransactionContext } from './context';
import { ExtendedDummyUtxo, ExtendedUtxo } from './extendedUtxo';
import {
  EnhancedInput,
  EnhancedOutput,
  GetPSBTSummaryOptions,
  IOInscription,
  IOSatribute,
  InputMetadata,
  PSBTCompilationOptions,
  PsbtSummary,
  TransactionFeeOutput,
} from './types';
import { extractOutputInscriptionsAndSatributes, getTransactionTotals, mapInputToEnhancedInput } from './utils';
import { classifySighash, isFullyBoundSighashFlags, mergeSighashFlags, type SighashFlags } from './utils/sighashFlags';
import { estimateVSize } from './utils/transactionVsizeEstimator';

type ParsedOutputMetadata = { script: string[]; scriptHex: string } & (
  | { address: string; type?: undefined }
  | { address?: undefined; type?: undefined }
  | {
      address?: undefined;
      pubKeys: string[];
      type: 'ms' | 'tr_ms' | 'tr_ns' | 'pk' | 'p2a';
      m: number;
    }
);

export class EnhancedPsbt {
  private readonly _context!: TransactionContext;

  private readonly _psbt!: Uint8Array;

  private readonly _inputsToSign?: InputToSign[];

  // TODO: Try and make this non-nullable by computing it in the constructor
  private readonly _inputsToSignMap?: Record<number, { address: string }[]>;

  private readonly _isSigHashAll?: boolean;

  private readonly _hasSigHashNone?: boolean;

  private readonly _hasSigHashSingle?: boolean;

  private readonly _hasAnyoneCanPay?: boolean;

  constructor(context: TransactionContext, psbtBase64: string, inputsToSign?: InputToSign[]) {
    this._context = context;
    this._psbt = base64.decode(psbtBase64);

    this._inputsToSign = inputsToSign;
    const txn = btc.Transaction.fromPSBT(this._psbt);

    if (inputsToSign) {
      this._inputsToSignMap = {};
      let flags: SighashFlags = {
        isSigHashAll: false,
        hasSigHashNone: false,
        hasSigHashSingle: false,
        hasAnyoneCanPay: false,
      };

      for (const input of inputsToSign) {
        for (const inputIndex of input.signingIndexes) {
          if (!this._inputsToSignMap[inputIndex]) {
            this._inputsToSignMap[inputIndex] = [];
          }

          this._inputsToSignMap[inputIndex].push({ address: input.address });

          const txnInput = txn.getInput(inputIndex);
          // Match prior behavior: missing sighash on the input defaults to DEFAULT for pre-scan.
          flags = mergeSighashFlags(flags, classifySighash(txnInput.sighashType ?? btc.SigHash.DEFAULT));
        }
      }

      this._isSigHashAll = flags.isSigHashAll;
      this._hasSigHashNone = flags.hasSigHashNone;
      this._hasSigHashSingle = flags.hasSigHashSingle;
      this._hasAnyoneCanPay = flags.hasAnyoneCanPay;
    }
  }

  private parseAddressFromOutput(transaction: btc.Transaction, outputIndex: number): ParsedOutputMetadata {
    const output = transaction.getOutput(outputIndex);

    if (!output?.script) {
      throw new Error('Output with no script detected in PSBT');
    }

    const outputScript = btc.OutScript.decode(output.script);

    const btcNetwork = getBtcNetworkDefinition(this._context.network);

    if (outputScript.type === 'unknown') {
      //for script outputs
      return {
        script: btc.Script.decode(outputScript.script).map((i) => (i instanceof Uint8Array ? hex.encode(i) : `${i}`)),
        scriptHex: hex.encode(outputScript.script),
      };
    }

    const script = btc.Script.decode(output.script).map((i) => (i instanceof Uint8Array ? hex.encode(i) : `${i}`));
    const scriptHex = hex.encode(output.script);

    if (outputScript.type === 'pk') {
      //for script outputs
      return {
        type: 'pk',
        pubKeys: [hex.encode(outputScript.pubkey)],
        script,
        scriptHex,
        m: 1,
      };
    }

    if (outputScript.type === 'ms' || outputScript.type === 'tr_ms') {
      return {
        type: outputScript.type,
        pubKeys: outputScript.pubkeys.map((pk) => hex.encode(pk)),
        script,
        scriptHex,
        m: outputScript.m,
      };
    }

    if (outputScript.type === 'tr_ns') {
      return {
        type: outputScript.type,
        pubKeys: outputScript.pubkeys.map((pk) => hex.encode(pk)),
        script,
        scriptHex,
        m: outputScript.pubkeys.length,
      };
    }

    if (outputScript.type === 'p2a') {
      return {
        type: outputScript.type,
        pubKeys: [],
        script,
        scriptHex,
        m: 0,
      };
    }

    return {
      address: btc.Address(btcNetwork).encode(outputScript),
      script,
      scriptHex,
    };
  }

  getTxId(): string | undefined {
    const txn = btc.Transaction.fromPSBT(this._psbt);
    if (txn.isFinal) {
      return txn.id;
    }

    // if all inputs are on addresses which have inputs send to the witness field, then we can extract the txn id
    // otherwise, it will change after signing
    for (let i = 0; i < txn.inputsLength; i++) {
      const input = txn.getInput(i);
      if (!input.witnessUtxo) {
        // address is either not segwit or is wrapped segwit, so we can't extract the txn id
        return undefined;
      }
      const outScript = btc.OutScript.decode(input.witnessUtxo.script);

      if (!outScript || !new Set(['wsh', 'wpkh', 'tr', 'tr_ns', 'tr_ms']).has(outScript.type)) {
        return undefined;
      }
    }
    return hex.encode(sha256(sha256(utils.concatBytes(txn.toBytes(false)))).reverse());
  }

  private _getExtendedUtxoForInput = async (
    inputRaw: TransactionInput,
    inputTxid: string,
    knownEmptyTxids?: string[],
  ) => {
    if (!knownEmptyTxids?.includes(inputTxid)) {
      const addressInput = await this._context.getUtxoFallbackToExternal(`${inputTxid}:${inputRaw.index}`);
      if (addressInput && addressInput.extendedUtxo) {
        return addressInput.extendedUtxo;
      }
    }

    // we know this UTXO won't exist, so we create a dummy one
    const utxo: UTXO = {
      txid: inputTxid,
      vout: inputRaw.index!,
      value: Number(inputRaw.witnessUtxo?.amount) || 0,
      status: {
        confirmed: false,
      },
      address: '',
    };

    return new ExtendedDummyUtxo(utxo, '');
  };

  private async _extractInputMetadata(
    transaction: btc.Transaction,
    knownEmptyTxids?: string[],
  ): Promise<InputMetadata> {
    const inputs: { extendedUtxo: ExtendedUtxo | ExtendedDummyUtxo; sigHash?: btc.SigHash; isPayToAnchor: boolean }[] =
      [];

    let flags: SighashFlags = {
      isSigHashAll: this._isSigHashAll ?? false,
      hasSigHashNone: this._hasSigHashNone ?? false,
      hasSigHashSingle: this._hasSigHashSingle ?? false,
      hasAnyoneCanPay: this._hasAnyoneCanPay ?? false,
    };

    let inputTotal = 0;

    for (let inputIndex = 0; inputIndex < transaction.inputsLength; inputIndex++) {
      const inputRaw = transaction.getInput(inputIndex);

      if (!inputRaw.txid) {
        throw new Error(`Incomplete input detected at index ${inputIndex}`);
      }

      const inputTxid = hex.encode(inputRaw.txid);

      const inputExtendedUtxo = await this._getExtendedUtxoForInput(inputRaw, inputTxid, knownEmptyTxids);

      if (!inputExtendedUtxo) {
        throw new Error(`Could not parse input ${inputIndex}`);
      }

      const isPayToAnchor =
        (inputRaw.witnessUtxo?.script && hex.encode(inputRaw.witnessUtxo.script) === PAY_TO_ANCHOR_SCRIPT_HEX) || false;

      const sigHash = inputRaw.sighashType;
      inputs.push({
        extendedUtxo: inputExtendedUtxo,
        sigHash,
        isPayToAnchor,
      });

      inputTotal += inputExtendedUtxo.utxo.value || 0;

      if (!this._inputsToSignMap || inputIndex in this._inputsToSignMap) {
        // undefined sighash is signed as ALL/DEFAULT
        flags = mergeSighashFlags(flags, classifySighash(sigHash));
      }
    }

    return { inputs, ...flags, inputTotal };
  }

  async getSummary(options?: GetPSBTSummaryOptions): Promise<PsbtSummary> {
    const transaction = btc.Transaction.fromPSBT(this._psbt);

    const { inputs, inputTotal, isSigHashAll, hasSigHashNone, hasSigHashSingle, hasAnyoneCanPay } =
      await this._extractInputMetadata(transaction, options?.knownEmptyTxids);
    const outputs: EnhancedOutput[] = [];

    const isFinal = isFullyBoundSighashFlags({
      isSigHashAll,
      hasSigHashNone,
      hasSigHashSingle,
      hasAnyoneCanPay,
    });

    let hasScriptOutput = false;
    let outputTotal = 0;
    let currentOffset = 0;
    const inputsExtendedUtxos = inputs.map((i) => i.extendedUtxo);
    for (let outputIndex = 0; outputIndex < transaction.outputsLength; outputIndex++) {
      const outputMetadata = this.parseAddressFromOutput(transaction, outputIndex);
      const outputRaw = transaction.getOutput(outputIndex);

      if (outputMetadata.type === undefined && outputMetadata.address === undefined) {
        const amount = outputRaw.amount ? Number(outputRaw.amount) : 0;
        outputs.push({
          type: 'script',
          script: outputMetadata.script,
          scriptHex: outputMetadata.scriptHex,
          amount,
        });
        hasScriptOutput = true;
        outputTotal += amount;
        currentOffset += amount;
        continue;
      }

      const amount = Number(outputRaw.amount);

      let inscriptions: IOInscription[] = [];
      let satributes: IOSatribute[] = [];

      if (isFinal) {
        if (isInscriptionsAndRunesCompatible(this._context.network)) {
          const extractedAssets = await extractOutputInscriptionsAndSatributes(
            inputsExtendedUtxos,
            currentOffset,
            amount,
          );

          inscriptions = extractedAssets.inscriptions;
          satributes = extractedAssets.satributes;
        }
      }

      if (outputMetadata.address !== undefined) {
        outputs.push({
          type: 'address',
          address: outputMetadata.address,
          script: outputMetadata.script,
          scriptHex: outputMetadata.scriptHex,
          amount: Number(amount),
          inscriptions,
          satributes,
        });
      } else {
        outputs.push({
          type: outputMetadata.type,
          script: outputMetadata.script,
          scriptHex: outputMetadata.scriptHex,
          pubKeys: outputMetadata.pubKeys,
          amount: Number(amount),
          inscriptions,
          satributes,
          m: outputMetadata.m,
        });
      }

      outputTotal += amount;
      currentOffset += Number(amount);
    }

    // Fee is only trustworthy when the PSBT is fully bound (no SINGLE/NONE/ACP on signed inputs).
    const fee = isFinal ? inputTotal - outputTotal : undefined;
    let feeOutput: TransactionFeeOutput | undefined = undefined;

    if (fee) {
      const { inscriptions, satributes } = await extractOutputInscriptionsAndSatributes(
        inputsExtendedUtxos,
        currentOffset,
        fee,
      );

      feeOutput = {
        type: 'fee',
        amount: fee,
        inscriptions,
        satributes,
      };
    }

    const enhancedInputs: EnhancedInput[] = await Promise.all(
      inputs.map((input, idx) =>
        mapInputToEnhancedInput(
          input.extendedUtxo,
          !this._inputsToSignMap || idx in this._inputsToSignMap,
          input.isPayToAnchor,
          input.sigHash,
        ),
      ),
    );

    const runesClient = getRunesClient(this._context.network);
    const runeOp = hasScriptOutput ? await runesClient.getDecodedRuneScript(transaction.hex) : undefined;

    let feeRate: number | undefined = undefined;

    if (isFinal && feeOutput) {
      // if the transaction is final, we can calculate the fee rate by estimating the size of the transaction
      try {
        const txnSize = estimateVSize(transaction);
        feeRate = feeOutput.amount / txnSize;
      } catch (e) {
        // if we can't estimate the size, we can't calculate the fee rate, so we just ignore it
      }
    }

    return {
      inputs: enhancedInputs,
      outputs,
      feeOutput,
      hasSigHashNone,
      hasSigHashSingle,
      hasAnyoneCanPay,
      isFinal,
      runeOp,
      feeRate,
    };
  }

  async getSignedPsbtBase64(options: PSBTCompilationOptions = {}): Promise<string> {
    const transaction = btc.Transaction.fromPSBT(this._psbt, { allowUnknownInputs: true, allowUnknownOutputs: true });
    let addedPaddingInput = false;

    if (options.ledgerTransport) {
      // ledger has a bug where it doesn't sign if the inputs spend more than the outputs
      // so we add an extra input to cover the diff and then remove it after signing
      const { inputValue, outputValue } = await getTransactionTotals(transaction);

      if (inputValue < outputValue) {
        // There is a bug in Ledger that if the inputs are greater than the outputs, then it will fail to sign
        // Their workaround is to add a dummy input that is not related to the Ledger addresses
        transaction.addInput({
          txid: '0000000000000000000000000000000000000000000000000000000000000000',
          index: 0,
          witnessUtxo: {
            script: Buffer.alloc(0),
            amount: outputValue - inputValue,
          },
        });
        addedPaddingInput = true;
      }
    }

    await this._context.signTransaction(transaction, { ...options, inputsToSign: this._inputsToSign });

    if (addedPaddingInput) {
      // We inserted a dummy input to get around a Ledger bug, so we need to remove it
      // @ts-expect-error: Expected error as inputs are private, but this is the only way to remove the input
      transaction.inputs.pop();
    }

    if (options.finalize) {
      transaction.finalize();
    }

    return base64.encode(transaction.toPSBT());
  }
}
