/**
 * This estimates the virtual size of a transaction. We could create a dummy transaction and sign it with a dummy key
 * to get the exact size, but signing is really slow. This is an estimator that is based of the code
 * in @scure/btc-signer and copies a lot of code from there that isn't exported.
 */

import * as btc from '@scure/btc-signer';
import * as P from 'micro-packed';
import { NetworkType } from '../../../types';

const EMPTY_ARRAY = new Uint8Array();
const SHA256_LEN_BYTES = 64;

function getPrevOut(input: btc.TransactionInput): P.UnwrapCoder<typeof btc.RawOutput> {
  if (input.nonWitnessUtxo) {
    if (input.index === undefined) throw new Error('Unknown input index');
    return input.nonWitnessUtxo.outputs[input.index];
  } else if (input.witnessUtxo) return input.witnessUtxo;
  else throw new Error('Cannot find previous output info');
}

function getInputType(input: btc.TransactionInput) {
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

function estimateInput(input: btc.TransactionInput, opts: Options) {
  let script = EMPTY_ARRAY,
    witness: Uint8Array[] | undefined = undefined;

  const inputType = getInputType(input);

  // schnorr sig is always 64 bytes. except for cases when sighash is not default!
  if (inputType.txType === 'taproot') {
    const SCHNORR_SIG_SIZE = !input.sighashType || input.sighashType === btc.SigHash.DEFAULT ? 64 : 65;

    if (input.tapLeafScript) {
      // If user want to select specific leaf (which can signed, it is possible to remove all other leafs manually);
      // Sort leafs by control block length.
      const leafs = input.tapLeafScript.sort(
        (a, b) => btc.TaprootControlBlock.encode(a[0]).length - btc.TaprootControlBlock.encode(b[0]).length,
      );
      for (const [cb, leafScript] of leafs) {
        // Last byte is version
        const scriptElement = leafScript.slice(0, -1);
        const outScript = btc.OutScript.decode(scriptElement);
        const signatures: Uint8Array[] = [];
        if (outScript.type === 'tr_ms') {
          const m = outScript.m;
          for (let i = 0; i < m; i++) signatures.push(new Uint8Array(SCHNORR_SIG_SIZE));
          const n = outScript.pubkeys.length - m;
          for (let i = 0; i < n; i++) signatures.push(EMPTY_ARRAY);
        } else if (outScript.type === 'tr_ns') {
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          for (const pubkey of outScript.pubkeys) signatures.push(new Uint8Array(SCHNORR_SIG_SIZE));
        } else {
          if (opts.taprootSimpleSign) {
            signatures.push(new Uint8Array(SCHNORR_SIG_SIZE));
          } else {
            // TODO: if custom tap script, then we need to sign it instead of using this estimator. e.g. inscriptions
            throw new Error('Finalize: Unknown tapLeafScript');
          }
        }
        // Witness is stack, so last element will be used first
        witness = signatures.reverse().concat([scriptElement, btc.TaprootControlBlock.encode(cb)]);
        break;
      }
    } else if (input.tapInternalKey && !P.equalBytes(input.tapInternalKey, btc.TAPROOT_UNSPENDABLE_KEY)) {
      witness = [new Uint8Array(SCHNORR_SIG_SIZE)];
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

  let weight = 160 + 4 * btc.VarBytes.encode(script).length;
  let hasWitnesses = false;

  if (witness) {
    weight += btc.RawWitness.encode(witness).length;
    hasWitnesses = true;
  }

  return { weight, hasWitnesses };
}

const getOutputScript = (output: btc.TransactionOutput, options: Options) => {
  const NETWORK = options?.network === 'Mainnet' ? btc.NETWORK : btc.TEST_NETWORK;
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
  const opts = options || {};

  let baseWeight = 32;
  for (let i = 0; i < tx.outputsLength; i++) {
    const output = tx.getOutput(i);
    const script = getOutputScript(output, opts);
    baseWeight += 32 + 4 * btc.VarBytes.encode(script).length;
  }

  baseWeight += 4 * btc.CompactSize.encode(BigInt(tx.outputsLength)).length;

  for (let i = 0; i < tx.inputsLength; i++) {
    const input = tx.getInput(i);

    const { weight, hasWitnesses } = estimateInput(input, opts);
    baseWeight += weight;
    if (hasWitnesses) {
      baseWeight += 2;
    }
  }

  baseWeight += 4 * btc.CompactSize.encode(BigInt(tx.inputsLength)).length;

  return Math.ceil(baseWeight / 4);
};
