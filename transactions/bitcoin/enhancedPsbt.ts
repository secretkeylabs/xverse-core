import { base64, hex } from '@scure/base';
import * as btc from '@scure/btc-signer';

import { getRunesClient } from '../../api';
import { UTXO } from '../../types';
import { InputToSign, TransactionContext } from './context';
import { ExtendedDummyUtxo, ExtendedUtxo } from './extendedUtxo';
import {
  EnhancedInput,
  EnhancedOutput,
  IOInscription,
  IOSatribute,
  InputMetadata,
  PSBTCompilationOptions,
  PsbtSummary,
  TransactionFeeOutput,
} from './types';
import { extractOutputInscriptionsAndSatributes, getTransactionTotals, mapInputToEnhancedInput } from './utils';
import { estimateVSize } from './utils/transactionVsizeEstimator';

type ParsedOutputMetadata = { script: string[]; scriptHex: string } & (
  | { address: string; type?: undefined }
  | { address?: undefined; type?: undefined }
  | {
      address?: undefined;
      pubKeys: string[];
      type: 'ms' | 'tr_ms' | 'tr_ns' | 'pk';
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

  constructor(context: TransactionContext, psbtBase64: string, inputsToSign?: InputToSign[]) {
    this._context = context;
    this._psbt = base64.decode(psbtBase64);

    this._inputsToSign = inputsToSign;
    const txn = btc.Transaction.fromPSBT(this._psbt);

    if (inputsToSign) {
      this._inputsToSignMap = {};
      let hasSigHashNone = false;
      let hasSigHashSingle = false;
      let isSigHashAll = false;

      for (const input of inputsToSign) {
        for (const inputIndex of input.signingIndexes) {
          if (!this._inputsToSignMap[inputIndex]) {
            this._inputsToSignMap[inputIndex] = [];
          }

          this._inputsToSignMap[inputIndex].push({ address: input.address });

          const txnInput = txn.getInput(inputIndex);
          const sigHashToCheck = txnInput.sighashType ?? btc.SigHash.DEFAULT;

          // we need to do check for single first as it's value is 3 while none is 2 and all is 1
          if ((sigHashToCheck & btc.SigHash.SINGLE) === btc.SigHash.SINGLE) {
            hasSigHashSingle = true;
            continue;
          }

          if (sigHashToCheck === btc.SigHash.DEFAULT || (sigHashToCheck & btc.SigHash.ALL) === btc.SigHash.ALL) {
            isSigHashAll = true;
            continue;
          }

          if ((sigHashToCheck & btc.SigHash.NONE) === btc.SigHash.NONE) {
            hasSigHashNone = true;
          }
        }
      }

      this._isSigHashAll = isSigHashAll;
      this._hasSigHashNone = hasSigHashNone;
      this._hasSigHashSingle = hasSigHashSingle;
    }
  }

  private parseAddressFromOutput(transaction: btc.Transaction, outputIndex: number): ParsedOutputMetadata {
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

    return {
      address: btc.Address(btcNetwork).encode(outputScript),
      script,
      scriptHex,
    };
  }

  getExtendedUtxoForInput = async (inputRaw: btc.TransactionInput, inputTxid: string) => {
    const addressInput = await this._context.getUtxoFallbackToExternal(`${inputTxid}:${inputRaw.index}`);
    if (addressInput && addressInput.extendedUtxo) {
      return addressInput.extendedUtxo;
    } else {
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
    }
  };

  private async _extractInputMetadata(transaction: btc.Transaction): Promise<InputMetadata> {
    const inputs: { extendedUtxo: ExtendedUtxo | ExtendedDummyUtxo; sigHash?: btc.SigHash }[] = [];

    let isSigHashAll = this._isSigHashAll ?? false;
    let hasSigHashNone = this._hasSigHashNone ?? false;
    let hasSigHashSingle = this._hasSigHashSingle ?? false;

    let inputTotal = 0;

    for (let inputIndex = 0; inputIndex < transaction.inputsLength; inputIndex++) {
      const inputRaw = transaction.getInput(inputIndex);

      if (!inputRaw.txid) {
        throw new Error(`Incomplete input detected at index ${inputIndex}`);
      }

      const inputTxid = hex.encode(inputRaw.txid);

      const inputExtendedUtxo = await this.getExtendedUtxoForInput(inputRaw, inputTxid);

      if (!inputExtendedUtxo) {
        throw new Error(`Could not parse input ${inputIndex}`);
      }

      const sigHash = inputRaw.sighashType;
      inputs.push({
        extendedUtxo: inputExtendedUtxo,
        sigHash,
      });

      inputTotal += inputExtendedUtxo.utxo.value || 0;

      if (!this._inputsToSignMap || inputIndex in this._inputsToSignMap) {
        // sighash single value is 3 while sighash none is 2 and sighash all is 1, so we need to ensure we
        // don't have a single before we do the bitwise or for all and none
        const isSigHashSingle = (sigHash && sigHash & btc.SigHash.SINGLE) === btc.SigHash.SINGLE;

        isSigHashAll =
          // if already true, we don't need to check again
          isSigHashAll ||
          // if we have a single, we can't have all as their bit-wise values overlap
          (!isSigHashSingle &&
            // if the sigHash is undefined, it will be signed as ALL/DEFAULT, so mark it as ALL
            (sigHash === undefined ||
              // if the sigHash is ALL or DEFAULT(for taproot), we can mark it as ALL
              sigHash === btc.SigHash.DEFAULT ||
              (sigHash & btc.SigHash.ALL) === btc.SigHash.ALL));

        hasSigHashNone =
          hasSigHashNone || (!isSigHashSingle && (sigHash && sigHash & btc.SigHash.NONE) === btc.SigHash.NONE);
        hasSigHashSingle = hasSigHashSingle || isSigHashSingle;
      }
    }

    return { inputs, isSigHashAll, hasSigHashNone, hasSigHashSingle, inputTotal };
  }

  async getSummary(): Promise<PsbtSummary> {
    const transaction = btc.Transaction.fromPSBT(this._psbt);

    const { inputs, inputTotal, isSigHashAll, hasSigHashNone, hasSigHashSingle } = await this._extractInputMetadata(
      transaction,
    );
    const outputs: EnhancedOutput[] = [];

    let hasScriptOutput = false;
    let outputTotal = 0;
    let currentOffset = 0;
    const inputsExtendedUtxos = inputs.map((i) => i.extendedUtxo);
    for (let outputIndex = 0; outputIndex < transaction.outputsLength; outputIndex++) {
      const outputMetadata = this.parseAddressFromOutput(transaction, outputIndex);
      const outputRaw = transaction.getOutput(outputIndex);

      if (outputMetadata.type === undefined && outputMetadata.address === undefined) {
        outputs.push({
          type: 'script',
          script: outputMetadata.script,
          scriptHex: outputMetadata.scriptHex,
          amount: outputRaw.amount ? Number(outputRaw.amount) : 0,
        });
        hasScriptOutput = true;

        continue;
      }

      const amount = Number(outputRaw.amount);
      outputTotal += amount;

      let inscriptions: IOInscription[] = [];
      let satributes: IOSatribute[] = [];

      if (isSigHashAll) {
        const extractedAssets = await extractOutputInscriptionsAndSatributes(
          inputsExtendedUtxos,
          currentOffset,
          amount,
        );

        inscriptions = extractedAssets.inscriptions;
        satributes = extractedAssets.satributes;
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
          input.sigHash,
        ),
      ),
    );

    const runesClient = getRunesClient(this._context.network);
    const runeOp = hasScriptOutput ? await runesClient.getDecodedRuneScript(transaction.hex) : undefined;

    const isFinal = isSigHashAll;
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
