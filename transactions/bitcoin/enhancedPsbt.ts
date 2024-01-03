import { base64, hex } from '@scure/base';
import * as btc from '@scure/btc-signer';

import { InputToSign } from '../psbt';
import { ExtendedUtxo, TransactionContext } from './context';
import {
  EnhancedInput,
  EnhancedOutput,
  PSBTCompilationOptions,
  TransactionFeeOutput,
  TransactionOutput,
  TransactionScriptOutput,
} from './types';
import { extractOutputInscriptionsAndSatributes, getTransactionTotals, mapInputToEnhancedInput } from './utils';

export class EnhancedPsbt {
  private readonly _context!: TransactionContext;

  private readonly _psbt!: Uint8Array;

  private readonly _inputsToSign?: InputToSign[];

  private readonly _inputsToSignMap?: Record<number, { address: string; sigHash?: number }[]>;

  private readonly _isSigHashAll?: boolean;

  private readonly _hasSigHashNone?: boolean;

  constructor(context: TransactionContext, psbtBase64: string, inputsToSign?: InputToSign[]) {
    this._context = context;
    this._psbt = base64.decode(psbtBase64);

    this._inputsToSign = inputsToSign;

    if (inputsToSign) {
      this._inputsToSignMap = {};

      for (const input of inputsToSign) {
        for (const inputIndex of input.signingIndexes) {
          if (!this._inputsToSignMap[inputIndex]) {
            this._inputsToSignMap[inputIndex] = [];
          }

          this._inputsToSignMap[inputIndex].push({ address: input.address, sigHash: input.sigHash });

          if (!input.sigHash || (input.sigHash | btc.SigHash.SINGLE) === btc.SigHash.SINGLE) {
            continue;
          }

          if ((input.sigHash | btc.SigHash.ALL) === btc.SigHash.ALL) {
            this._isSigHashAll = true;
          }

          if ((input.sigHash | btc.SigHash.NONE) === btc.SigHash.NONE) {
            this._hasSigHashNone = true;
          }
        }
      }
    }
  }

  private parseAddressFromOutput(
    transaction: btc.Transaction,
    outputIndex: number,
  ): { address: string; script?: undefined } | { address?: undefined; script: string[] } {
    const output = transaction.getOutput(outputIndex);

    if (!output?.script) {
      throw new Error('Output with no script detected in PSBT');
    }

    const outputScript = btc.OutScript.decode(output.script);

    const btcNetwork = this._context.network === 'Mainnet' ? btc.NETWORK : btc.TEST_NETWORK;

    if (outputScript.type === 'unknown') {
      //for script outputs
      return {
        script: btc.Script.decode(outputScript.script).map((i) => (i instanceof Uint8Array ? hex.encode(i) : `${i}`)),
      };
    }

    return { address: btc.Address(btcNetwork).encode(outputScript) };
  }

  private async _extractInputMetadata(transaction: btc.Transaction) {
    const inputs: { extendedUtxo: ExtendedUtxo; sigHash?: btc.SigHash }[] = [];

    let isSigHashAll = this._isSigHashAll ?? false;
    let hasSigHashNone = this._hasSigHashNone ?? false;

    let inputTotal = 0;

    for (let inputIndex = 0; inputIndex < transaction.inputsLength; inputIndex++) {
      const inputRaw = transaction.getInput(inputIndex);

      if (!inputRaw.txid) {
        throw new Error(`Incomplete input detected at index ${inputIndex}}`);
      }

      const inputTxid = hex.encode(inputRaw.txid);

      const input = await this._context.getUtxoFallbackToExternal(`${inputTxid}:${inputRaw.index}`);

      if (!input?.extendedUtxo) {
        throw new Error(`Could not parse input ${inputIndex}}`);
      }

      const sigHash = inputRaw.sighashType || this._inputsToSignMap?.[inputIndex]?.[0]?.sigHash;
      inputs.push({
        extendedUtxo: input.extendedUtxo,
        sigHash,
      });

      inputTotal += input.extendedUtxo.utxo.value;

      isSigHashAll = isSigHashAll || sigHash === undefined || sigHash === btc.SigHash.ALL;
      hasSigHashNone = hasSigHashNone || (sigHash && sigHash & btc.SigHash.NONE) === btc.SigHash.NONE;
    }

    return { inputs, isSigHashAll, hasSigHashNone, inputTotal };
  }

  async getSummary(): Promise<{
    inputs: EnhancedInput[];
    outputs: EnhancedOutput[];
    feeOutput?: TransactionFeeOutput;
    hasSigHashNone: boolean;
  }> {
    const transaction = btc.Transaction.fromPSBT(this._psbt);

    const { inputs, inputTotal, isSigHashAll, hasSigHashNone } = await this._extractInputMetadata(transaction);
    const outputs: (TransactionOutput | TransactionScriptOutput)[] = [];

    let outputTotal = 0;

    let currentOffset = 0;
    const inputsExtendedUtxos = inputs.map((i) => i.extendedUtxo);
    for (let outputIndex = 0; outputIndex < transaction.outputsLength; outputIndex++) {
      const outputMetadata = this.parseAddressFromOutput(transaction, outputIndex);

      if (outputMetadata.script !== undefined) {
        outputs.push({
          script: outputMetadata.script,
        });
        continue;
      }

      const outputRaw = transaction.getOutput(outputIndex);
      const amount = Number(outputRaw.amount);
      outputTotal += amount;

      if (!isSigHashAll) {
        const output: TransactionOutput = {
          address: outputMetadata.address,
          amount: Number(amount),
          inscriptions: [],
          satributes: [],
        };
        outputs.push(output);
        continue;
      }

      const { inscriptions, satributes } = await extractOutputInscriptionsAndSatributes(
        inputsExtendedUtxos,
        currentOffset,
        amount,
      );
      const output: TransactionOutput = {
        address: outputMetadata.address,
        amount: Number(amount),
        inscriptions,
        satributes,
      };
      outputs.push(output);

      currentOffset += Number(amount);
    }

    const fee = isSigHashAll ? inputTotal - outputTotal : undefined;
    let feeOutput: TransactionFeeOutput | undefined = undefined;

    if (fee) {
      const { inscriptions, satributes } = await extractOutputInscriptionsAndSatributes(
        inputsExtendedUtxos,
        currentOffset,
        fee,
      );

      feeOutput = {
        amount: fee,
        inscriptions,
        satributes,
      };
    }

    const enhancedInputs: EnhancedInput[] = await Promise.all(
      inputs.map((i) => mapInputToEnhancedInput(i.extendedUtxo, i.sigHash)),
    );

    return {
      inputs: enhancedInputs,
      outputs,
      feeOutput,
      hasSigHashNone,
    };
  }

  async getSignedPsbtBase64(options: PSBTCompilationOptions = {}): Promise<string> {
    const transaction = btc.Transaction.fromPSBT(this._psbt);
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
