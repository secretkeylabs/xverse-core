import { NetworkType, Account } from '../types';
import * as bitcoin from 'bitcoinjs-lib';
import { getSigningDerivationPath } from '../transactions/psbt';
import { encode } from 'varuint-bitcoin';
import * as btc from '@scure/btc-signer';
import * as secp256k1 from '@noble/secp256k1';
import * as bip39 from 'bip39';
import { bip32 } from 'bitcoinjs-lib';
import { getBtcNetwork } from '../transactions/btcNetwork';
import { hex } from '@scure/base';
/**
 *
 * @param message
 * @returns Bip322 Message Hash
 *
 */
function bip0322Hash(message: string) {
  const { sha256 } = bitcoin.crypto;
  const tag = 'BIP0322-signed-message';
  const tagHash = sha256(Buffer.from(tag));
  const result = sha256(Buffer.concat([tagHash, tagHash, Buffer.from(message)]));
  return result.toString('hex');
}


function encodeVarString(b: any) {
  return Buffer.concat([encode(b.byteLength), b]);
}

interface SignBip322MessageOptions {
  accounts: Account[];
  signatureAddress: string;
  message: string;
  network: NetworkType;
  seedPhrase: string;
}

export const signBip322Message = async (options: SignBip322MessageOptions) => {
  const { accounts, message, network, seedPhrase, signatureAddress } = options;
  const seed = await bip39.mnemonicToSeed(seedPhrase);
  const master = bip32.fromSeed(seed);
  const signingDerivationPath = getSigningDerivationPath(accounts, signatureAddress, network);
  const child = master.derivePath(signingDerivationPath);
  if (child.privateKey) {
    const privateKey = child.privateKey?.toString('hex');
    const taprootInternalPubKey = secp256k1.schnorr.getPublicKey(privateKey);
    const p2tr = btc.p2tr(taprootInternalPubKey, undefined, getBtcNetwork(network));
    const inputHash = Buffer.from(
      '0000000000000000000000000000000000000000000000000000000000000000',
      'hex'
    );
    const txVersion = 0;
    const inputIndex = 4294967295;
    const sequence = 0;
    const scriptSig = Buffer.concat([
      Buffer.from('0020', 'hex'),
      Buffer.from(bip0322Hash(message), 'hex'),
    ]);

    // tx - to-spend
    const txToSpend = new btc.Transaction({
      allowUnknowOutput: true,
      version: txVersion,
    });
    txToSpend.addOutput({
      amount: BigInt(0),
      script: p2tr.script,
    });
    txToSpend.addInput({
      txid: inputHash,
      index: inputIndex,
      sequence,
      finalScriptSig: scriptSig,
    });
    // tx - to-sign
      const psbtToSign = new btc.Transaction({
        allowUnknowOutput: true,
        version: txVersion,
      });
      psbtToSign.addInput({
        txid: txToSpend.hash,
        index: 0,
        sequence: 0,
        tapInternalKey: taprootInternalPubKey,
        witnessUtxo: {
          script: p2tr.script,
          amount: BigInt(0),
        },
      });
      psbtToSign.addOutput({ script: Buffer.from('6a', 'hex'), amount: BigInt(0) });
      console.log(psbtToSign);
      psbtToSign.signIdx(hex.decode(privateKey), 0);
      psbtToSign.finalize();
      const txToSign = psbtToSign.getInput(0);
      if (txToSign.finalScriptWitness?.length) {
        const len = encode(txToSign.finalScriptWitness?.length);
        const result = Buffer.concat([
          len,
          ...txToSign.finalScriptWitness.map((w) => encodeVarString(w)),
        ]);

        const signature = result.toString('base64');
        return signature;
      }

  }
};
