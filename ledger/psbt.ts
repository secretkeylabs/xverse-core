import { base64, hex } from '@scure/base';
import * as btc from '@scure/btc-signer';
import { AppClient, DefaultWalletPolicy } from 'ledger-bitcoin';
import { BTC_SEGWIT_PATH_PURPOSE, BTC_TAPROOT_PATH_PURPOSE } from '../constant';
import { NetworkType } from '../types';
import { getCoinType } from './helper';
import { Transport } from './types';

const areByteArraysEqual = (a?: Uint8Array, b?: Uint8Array): boolean => {
  if (!a || !b || a.length !== b.length) {
    return false;
  }

  return a.every((v, i) => v === b[i]);
};

const embellishNativeSegwitInputs = (
  transaction: btc.Transaction,
  publicKey: string,
  network: NetworkType,
  addressIndex: number,
  masterFingerPrint: string,
): boolean => {
  const coinType = getCoinType(network);
  const inputDerivation = [
    hex.decode(publicKey),
    {
      path: btc.bip32Path(`${BTC_SEGWIT_PATH_PURPOSE}${coinType}'/0'/0/${addressIndex}`),
      fingerprint: parseInt(masterFingerPrint, 16),
    },
  ] as [Uint8Array, { path: number[]; fingerprint: number }];

  const publicKeyBuff = hex.decode(publicKey);
  const p2wpkh = btc.p2wpkh(publicKeyBuff, network === 'Mainnet' ? btc.NETWORK : btc.TEST_NETWORK);

  let hasNativeSegwitInputs = false;
  for (let i = 0; i < transaction.inputsLength; i++) {
    const input = transaction.getInput(i);
    if (areByteArraysEqual(input.witnessUtxo?.script, p2wpkh.script)) {
      transaction.updateInput(i, {
        bip32Derivation: [inputDerivation],
      });
      hasNativeSegwitInputs = true;
    }
  }

  return hasNativeSegwitInputs;
};

const embellishTaprootInputs = (
  transaction: btc.Transaction,
  publicKey: string,
  network: NetworkType,
  addressIndex: number,
  masterFingerPrint: string,
): boolean => {
  const coinType = getCoinType(network);
  const publicKeyBuff = hex.decode(publicKey);
  const inputDerivation = [
    publicKeyBuff,
    {
      path: btc.bip32Path(`${BTC_TAPROOT_PATH_PURPOSE}${coinType}'/0'/0/${addressIndex}`),
      fingerprint: parseInt(masterFingerPrint, 16),
    },
  ] as [Uint8Array, { path: number[]; fingerprint: number }];

  const schnorrPublicKey = publicKeyBuff.length === 32 ? publicKeyBuff : publicKeyBuff.slice(1);
  const p2tr = btc.p2tr(schnorrPublicKey, undefined, network === 'Mainnet' ? btc.NETWORK : btc.TEST_NETWORK);

  let hasTaprootInputs = false;
  for (let i = 0; i < transaction.inputsLength; i++) {
    const input = transaction.getInput(i);
    if (areByteArraysEqual(input.witnessUtxo?.script, p2tr.script)) {
      transaction.updateInput(i, {
        bip32Derivation: [inputDerivation],
      });
      hasTaprootInputs = true;
    }
  }

  return hasTaprootInputs;
};

const getIoTotals = (txn: btc.Transaction) => {
  let inputTotal = 0n;
  let outputTotal = 0n;

  for (let i = 0; i < txn.inputsLength; i++) {
    inputTotal += txn.getInput(i).witnessUtxo?.amount || 0n;
  }

  for (let i = 0; i < txn.outputsLength; i++) {
    outputTotal += txn.getOutput(i).amount || 0n;
  }

  return { inputTotal, outputTotal };
};

export async function signLedgerPSBT({
  transport,
  network,
  addressIndex,
  psbtInputBase64,
  finalize,
  taprootPubKey,
  nativeSegwitPubKey,
}: {
  transport: Transport;
  network: NetworkType;
  addressIndex: number;
  psbtInputBase64: string;
  finalize: boolean;
  taprootPubKey: string;
  nativeSegwitPubKey: string;
}): Promise<string> {
  const txn = btc.Transaction.fromPSBT(Buffer.from(psbtInputBase64, 'base64'));

  const coinType = getCoinType(network);
  const app = new AppClient(transport);

  // Get account details from ledger to not rely on state
  const masterFingerPrint = await app.getMasterFingerprint();

  const { inputTotal, outputTotal } = getIoTotals(txn);

  if (inputTotal < outputTotal) {
    // There is a bug in Ledger that if the inputs are greater than the outputs, then it will fail to sign
    // Their workaround is to add a dummy input that is not related to the Ledger addresses
    txn.addInput({
      txid: '0000000000000000000000000000000000000000000000000000000000000000',
      index: 0,
      witnessUtxo: {
        script: Buffer.alloc(0),
        amount: outputTotal,
      },
    });
  }

  if (embellishNativeSegwitInputs(txn, nativeSegwitPubKey, network, addressIndex, masterFingerPrint)) {
    const psbt = txn.toPSBT(0);
    const psbtBase64 = base64.encode(psbt);

    const extendedPublicKey = await app.getExtendedPubkey(`${BTC_SEGWIT_PATH_PURPOSE}${coinType}'/0'`);
    const accountPolicy = new DefaultWalletPolicy(
      'wpkh(@0/**)',
      `[${masterFingerPrint}/84'/${coinType}'/0']${extendedPublicKey}`,
    );

    const signatures = await app.signPsbt(psbtBase64, accountPolicy, null);

    for (const signature of signatures) {
      txn.updateInput(signature[0], {
        partialSig: [[signature[1].pubkey, signature[1].signature]],
      });
    }
  }

  if (embellishTaprootInputs(txn, taprootPubKey, network, addressIndex, masterFingerPrint)) {
    const psbt = txn.toPSBT(0);
    const psbtBase64 = base64.encode(psbt);

    const extendedPublicKey = await app.getExtendedPubkey(`${BTC_TAPROOT_PATH_PURPOSE}${coinType}'/0'`);
    const accountPolicy = new DefaultWalletPolicy(
      'tr(@0/**)',
      `[${masterFingerPrint}/86'/${coinType}'/0']${extendedPublicKey}`,
    );

    const signatures = await app.signPsbt(psbtBase64, accountPolicy, null, () => {
      console.log('Input signed');
    });

    for (const signature of signatures) {
      txn.updateInput(signature[0], {
        tapKeySig: signature[1].signature,
      });
    }
  }

  if (finalize) {
    txn.finalize();
  }

  const signedPsbt = txn.toPSBT();

  return base64.encode(signedPsbt);
}
