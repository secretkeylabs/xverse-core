/**
 * This estimates the virtual size of a transaction. We could create a dummy transaction and sign it with a dummy key
 * to get the exact size, but signing is really slow. This is an estimator that is based of the code
 * in @scure/btc-signer and copies a lot of code from there that isn't exported.
 */

import * as btc from '@scure/btc-signer';
import { TransactionInput, TransactionOutput } from '@scure/btc-signer/psbt';
import { RawOutput, VarBytes } from '@scure/btc-signer/script';
import { equalBytes } from '@scure/btc-signer/utils';
import * as P from 'micro-packed';
import { NetworkType } from '../../../types';
import { getBtcNetworkDefinition } from '../../btcNetwork';

const EMPTY_ARRAY = new Uint8Array();
const SHA256_LEN_BYTES = 64;

type TapLeafScript = TransactionInput['tapLeafScript'];
type TB = Parameters<typeof btc.TaprootControlBlock.encode>[0];
const encodeTapBlock = (item: TB) => btc.TaprootControlBlock.encode(item);

export function getPrevOut(input: TransactionInput): P.UnwrapCoder<typeof RawOutput> {
  if (input.nonWitnessUtxo) {
    if (input.index === undefined) throw new Error('Unknown input index');
    return input.nonWitnessUtxo.outputs[input.index];
  } else if (input.witnessUtxo) return input.witnessUtxo;
  else throw new Error('Cannot find previous output info');
}

function getInputType(input: TransactionInput) {
  let txType = 'legacy';
  let defaultSighash = btc.SigHash.ALL;
  const prevOut = getPrevOut(input);
  const first = btc.OutScript.decode(prevOut.script);
  let type = first.type;
  let cur = first;
  const stack = [first];
  if (first.type === 'tr') {
    defaultSighash = btc.SigHash.DEFAULT;
    return {
      txType: 'taproot',
      type: 'tr',
      last: first,
      lastScript: prevOut.script,
      defaultSighash,
      sighash: input.sighashType || defaultSighash,
    };
  } else {
    if (first.type === 'wpkh' || first.type === 'wsh') txType = 'segwit';
    if (first.type === 'sh') {
      if (!input.redeemScript) throw new Error('inputType: sh without redeemScript');
      const child = btc.OutScript.decode(input.redeemScript);
      if (child.type === 'wpkh' || child.type === 'wsh') txType = 'segwit';
      stack.push(child);
      cur = child;
      type += `-${child.type}`;
    }
    // wsh can be inside sh
    if (cur.type === 'wsh') {
      if (!input.witnessScript) throw new Error('inputType: wsh without witnessScript');
      const child = btc.OutScript.decode(input.witnessScript);
      if (child.type === 'wsh') txType = 'segwit';
      stack.push(child);
      cur = child;
      type += `-${child.type}`;
    }
    const last = stack[stack.length - 1];
    if (last.type === 'sh' || last.type === 'wsh') throw new Error('inputType: sh/wsh cannot be terminal type');
    const lastScript = btc.OutScript.encode(last);
    const res = {
      type,
      txType,
      last,
      lastScript,
      defaultSighash,
      sighash: input.sighashType || defaultSighash,
    };

    return res;
  }
}

function iterLeafs(tapLeafScript: TapLeafScript, sigSize: number) {
  if (!tapLeafScript || !tapLeafScript.length) throw new Error('no leafs');
  const empty = () => new Uint8Array(sigSize);
  // If user want to select specific leaf, which can signed,
  // it is possible to remove all other leafs manually.
  // Sort leafs by control block length.
  const leafs = tapLeafScript.sort((a, b) => encodeTapBlock(a[0]).length - encodeTapBlock(b[0]).length);
  for (const [cb, leafScript] of leafs) {
    // Last byte is version
    const script = leafScript.slice(0, -1);
    const outs = btc.OutScript.decode(script);

    const signatures: P.Bytes[] = [];
    if (outs.type === 'tr_ms') {
      const m = outs.m;
      const n = outs.pubkeys.length - m;
      for (let i = 0; i < m; i++) signatures.push(empty());
      for (let i = 0; i < n; i++) signatures.push(P.EMPTY);
    } else if (outs.type === 'tr_ns') {
      outs.pubkeys.forEach(() => signatures.push(empty()));
    } else {
      throw new Error('Finalize: Unknown tapLeafScript');
    }
    // Witness is stack, so last element will be used first
    return signatures.reverse().concat([script, encodeTapBlock(cb)]);
  }
  throw new Error('there was no witness');
}

function estimateInput(input: TransactionInput, opts: Options) {
  let script = EMPTY_ARRAY,
    witness: Uint8Array[] | undefined = undefined;

  const inputType = getInputType(input);

  // schnorr sig is always 64 bytes. except for cases when sighash is not default!
  if (inputType.txType === 'taproot') {
    const SCHNORR_SIG_SIZE = !input.sighashType || input.sighashType === btc.SigHash.DEFAULT ? 64 : 65;
    if (
      (input.tapInternalKey && !equalBytes(input.tapInternalKey, btc.TAPROOT_UNSPENDABLE_KEY)) ||
      opts.taprootSimpleSign
    ) {
      witness = [new Uint8Array(SCHNORR_SIG_SIZE)];
    } else if (input.tapLeafScript) {
      witness = iterLeafs(input.tapLeafScript, SCHNORR_SIG_SIZE);
    } else throw new Error('estimateInput/taproot: unknown input');
  } else {
    const SIG_SIZE = 72; // Maximum size of signatures
    const PUB_KEY_SIZE = 33;

    let inputScript = EMPTY_ARRAY;
    let inputWitness: Uint8Array[] = [];
    if (inputType.last.type === 'ms') {
      const m = inputType.last.m;
      const sig: (number | Uint8Array)[] = [0];
      for (let i = 0; i < m; i++) sig.push(new Uint8Array(SIG_SIZE));
      inputScript = btc.Script.encode(sig);
    } else if (inputType.last.type === 'pk') {
      // 71 sig + 1 sighash
      inputScript = btc.Script.encode([new Uint8Array(SIG_SIZE)]);
    } else if (inputType.last.type === 'pkh') {
      inputScript = btc.Script.encode([new Uint8Array(SIG_SIZE), new Uint8Array(PUB_KEY_SIZE)]);
    } else if (inputType.last.type === 'wpkh') {
      inputScript = EMPTY_ARRAY;
      inputWitness = [new Uint8Array(SIG_SIZE), new Uint8Array(PUB_KEY_SIZE)];
    }

    if (inputType.type.includes('wsh-')) {
      // P2WSH
      if (inputScript.length && inputType.lastScript.length) {
        inputWitness = btc.Script.decode(inputScript).map((i) => {
          if (i === 0) return EMPTY_ARRAY;
          if (i instanceof Uint8Array) return i;
          throw new Error(`Wrong witness op=${i}`);
        });
      }
      inputWitness = inputWitness.concat(inputType.lastScript);
    }
    if (inputType.txType === 'segwit') witness = inputWitness;
    if (inputType.type.startsWith('sh-wsh-')) {
      script = btc.Script.encode([btc.Script.encode([0, new Uint8Array(SHA256_LEN_BYTES)])]);
    } else if (inputType.type.startsWith('sh-')) {
      script = btc.Script.encode([...btc.Script.decode(inputScript), inputType.lastScript]);
    } else if (inputType.type.startsWith('wsh-')) {
      // no-op
    } else if (inputType.txType !== 'segwit') script = inputScript;
  }

  let weight =
    32 * 4 + // prev txn id
    4 * 4 + // prev vout
    4 * VarBytes.encode(script).length + // script pubkey size
    4 * 4; // sequence
  let hasWitnesses = false;

  if (witness) {
    const rawWitness = btc.RawWitness.encode(witness);
    weight += rawWitness.length;
    hasWitnesses = true;
  }

  return { weight, hasWitnesses };
}

const getOutputScript = (output: TransactionOutput, options: Options) => {
  const NETWORK = getBtcNetworkDefinition(options?.network);
  let script;
  if ('address' in output && typeof output.address === 'string') {
    script = btc.OutScript.encode(btc.Address(NETWORK).decode(output.address));
  } else if ('script' in output && output.script instanceof Uint8Array) {
    script = output.script;
  } else {
    throw new Error('Output script could not be determined');
  }

  return script;
};

type Options = {
  /** Marks taproot scripts as signing with a vanilla schnorr signature, no special unlock scripts */
  taprootSimpleSign?: boolean;
  network?: NetworkType;
};
export const estimateVSize = (tx: btc.Transaction, options?: Options) => {
  if (tx.isFinal) throw new Error('Transaction must not be finalized');

  const opts = options || {};

  // To see where these values came from, go here
  // https://learnmeabitcoin.com/technical/transaction/
  let baseWeight =
    (4 + // version
      4) * // locktime
    4; // weight is 4 times the size

  // input count
  baseWeight += 4 * btc.CompactSize.encode(BigInt(tx.inputsLength)).length;

  // inputs
  let txnHasWitnesses = false;
  for (let i = 0; i < tx.inputsLength; i++) {
    const input = tx.getInput(i);

    const { weight, hasWitnesses } = estimateInput(input, opts);
    baseWeight += weight;
    txnHasWitnesses = txnHasWitnesses || hasWitnesses;
  }

  if (txnHasWitnesses) {
    // witness marker and flag - these are not multiplied by the weight factor
    baseWeight += 1 + 1;
  }

  // output count
  baseWeight += 4 * btc.CompactSize.encode(BigInt(tx.outputsLength)).length;

  // outputs
  for (let i = 0; i < tx.outputsLength; i++) {
    const output = tx.getOutput(i);
    const script = getOutputScript(output, opts);
    const scriptLength = script.length;
    const scriptLengthLength = btc.CompactSize.encode(BigInt(scriptLength)).length;

    baseWeight +=
      (8 + // amount
        scriptLengthLength + // script pubkey size
        scriptLength) * // script pubkey
      4;
  }

  return Math.ceil(baseWeight / 4);
};
