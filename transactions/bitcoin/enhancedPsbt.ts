import { base64, hex } from '@scure/base';
import * as btc from '@scure/btc-signer';

import { ExtendedUtxo, TransactionContext } from './context';
import {
  EnhancedInput,
  EnhancedOutput,
  PSBTCompilationOptions,
  TransactionFeeOutput,
  TransactionOutput,
  TransactionScriptOutput,
} from './types';
import { extractOutputInscriptionsAndSatributes } from './utils';

export class EnhancedPsbt {
  private readonly _context!: TransactionContext;

  private readonly _psbt!: Uint8Array;

  constructor(context: TransactionContext, psbtBase64: string) {
    this._context = context;
    this._psbt = base64.decode(psbtBase64);
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

    let isSigHashAll = false;
    let hasSigHashNone = false;

    let inputTotal = 0;

    for (let inputIndex = 0; inputIndex < transaction.inputsLength; inputIndex++) {
      const inputRaw = transaction.getInput(inputIndex);
      const inputTxid = hex.encode(inputRaw.txid!);

      const input = await this._context.getUtxoFallbackToExternal(`${inputTxid}:${inputRaw.index}`);

      if (!input?.extendedUtxo) {
        throw new Error(`Could not parse input ${inputIndex}}`);
      }

      const sigHash = inputRaw.sighashType;
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

    return {
      inputs,
      outputs,
      feeOutput,
      hasSigHashNone,
    };
  }

  async getSignedPsbtBase64(options: PSBTCompilationOptions = {}): Promise<string> {
    const transaction = btc.Transaction.fromPSBT(this._psbt);
    await this._context.signTransaction(transaction, options);

    if (options.finalize) {
      transaction.finalize();
    }

    return base64.encode(transaction.toPSBT(transaction.opts.PSBTVersion));
  }
}
