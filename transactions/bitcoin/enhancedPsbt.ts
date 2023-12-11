import { base64, hex } from '@scure/base';
import * as btc from '@scure/btc-signer';

import { ExtendedUtxo, TransactionContext } from './context';
import { PSBTCompilationOptions, TransactionOutput, TransactionScriptOutput } from './types';

export class EnhancedPsbt {
  private _context!: TransactionContext;

  private _psbt!: Uint8Array;

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

  async getSummary() {
    const myAddresses = new Set([this._context.paymentAddress.address, this._context.ordinalsAddress.address]);

    const transaction = btc.Transaction.fromPSBT(this._psbt);

    const inputs: { extendedUtxo: ExtendedUtxo; sigHash?: btc.SigHash }[] = [];
    const outputs: (TransactionOutput | TransactionScriptOutput)[] = [];

    let isSigHashAll = false;
    let hasSigHashNone = false;

    let inputTotal = 0;
    let outputTotal = 0;

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

    let currentOffset = 0;
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
      const output: TransactionOutput = {
        address: outputMetadata.address,
        amount: Number(amount),
        inscriptions: [],
        satributes: [],
      };
      outputs.push(output);

      if (!isSigHashAll) {
        continue;
      }

      const { inscriptions, satributes } = output;

      let runningOffset = 0;
      for (const input of inputs) {
        if (runningOffset + input.extendedUtxo.utxo.value > currentOffset) {
          const inputBundleData = await input.extendedUtxo.getBundleData();
          const fromAddress = input.extendedUtxo.address;

          const outputInscriptions = inputBundleData?.sat_ranges
            .flatMap((s) =>
              s.inscriptions.map((i) => ({
                id: i.id,
                offset: runningOffset + s.offset - currentOffset,
                fromAddress,
              })),
            )
            .filter((i) => i.offset >= 0 && i.offset < amount);

          const outputSatributes = inputBundleData?.sat_ranges
            .filter((s) => s.satributes.length > 0)
            .map((s) => {
              const min = Math.max(runningOffset + s.offset - currentOffset, 0);
              const max = Math.min(
                runningOffset + s.offset - currentOffset + Number(BigInt(s.range.end) - BigInt(s.range.start)),
                currentOffset + amount,
              );

              return {
                types: s.satributes,
                amount: max - min,
                offset: min,
                fromAddress,
              };
            });

          inscriptions.push(...(outputInscriptions || []));
          satributes.push(...(outputSatributes || []));
        }

        runningOffset += input.extendedUtxo.utxo.value;

        if (runningOffset >= currentOffset + amount) {
          break;
        }
      }

      currentOffset += Number(amount);
    }

    return {
      fee: isSigHashAll ? inputTotal - outputTotal : undefined,
      inputs,
      outputs,
    };
  }

  async getSignedPsbtBase64(options: PSBTCompilationOptions = {}) {
    const transaction = btc.Transaction.fromPSBT(this._psbt);
    await this._context.signTransaction(transaction, options);

    if (options.finalize) {
      transaction.finalize();
    }

    return base64.encode(transaction.toPSBT(transaction.opts.PSBTVersion));
  }
}
