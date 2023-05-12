import { Script, Transaction, p2tr } from '@scure/btc-signer';
import * as bip39 from 'bip39';
import { bip32 } from 'bitcoinjs-lib';
import * as secp256k1 from '@noble/secp256k1';
import BigNumber from 'bignumber.js';
import { getSigningDerivationPath } from './psbt';
import {  Account } from '../types';
import BitcoinEsploraApiProvider from 'api/esplora/esploraAPiProvider';
import { getBtcFeeRate, getFee, selectUnspentOutputs, sumUnspentOutputs } from './btc';

export enum SupportedTypes {
  TEXT = '"text/plain;charset=utf-8"',
  IMAGE = 'image/jpeg',
}

interface InscriptionTxArguments {
  data: Uint8Array;
  dataType: SupportedTypes;
  creatorAccount: Account;
  accountsList: Account[];
  seedPhrase: string;
}

export const toUint8 = (buf: Buffer): Uint8Array => {
  const uin = new Uint8Array(buf.length);
  return uin.map((a, index, arr) => (arr[index] = buf[index]));
};

const createInscriptionEnvelope = (pk: Uint8Array, data: Uint8Array, dataType: SupportedTypes) => {
  const mimetype = toUint8(Buffer.from(dataType));
  const marker = toUint8(Buffer.from('ord'));
  return Script.encode([
    pk,
    'CHECKSIG',
    'OP_0',
    'IF',
    marker,
    'OP_1',
    mimetype,
    'OP_0',
    data,
    'ENDIF',
  ]);
};

const btcClient = new BitcoinEsploraApiProvider({
  network: 'Mainnet',
});

const inscriptionAmount = new BigNumber(5500);

export const createInscriptionTx = async (options: InscriptionTxArguments) => {
  const { seedPhrase, accountsList, creatorAccount, data, dataType } = options;
  // get the user unspent outputs
  const accountUtxos = await btcClient.getUnspentUtxos(creatorAccount.btcAddress);
  // calculate the user balance and select utxos to spend
  const feeRate = await getBtcFeeRate();
  let selectedUnspentOutputs = selectUnspentOutputs(inscriptionAmount, accountUtxos);
  const sumSelectedOutputs = sumUnspentOutputs(selectedUnspentOutputs);
  if (sumSelectedOutputs.isLessThan(inscriptionAmount)) {
    throw new Error('Not enough sats in btc payment address');
  }
  const recipients = [
    {
      address: creatorAccount.ordinalsAddress,
      amountSats: inscriptionAmount,
    },
  ];
  const changeAddress = creatorAccount.btcAddress;
  // Calculate transaction fee
  let calculatedFee: BigNumber = new BigNumber(0);
  const { newSelectedUnspentOutputs, fee } = await getFee(
    selectedUnspentOutputs,
    selectedUnspentOutputs,
    sumSelectedOutputs,
    inscriptionAmount,
    recipients,
    feeRate,
    changeAddress,
    'Mainnet'
  );
  calculatedFee = fee;
  selectedUnspentOutputs = newSelectedUnspentOutputs;
  const satsToSend = inscriptionAmount.plus(calculatedFee);

  // derive user private keys to sign the tx input
  const seed = await bip39.mnemonicToSeed(seedPhrase);
  const master = bip32.fromSeed(seed);
  const signingDerivationPath = getSigningDerivationPath(
    accountsList,
    creatorAccount.ordinalsAddress,
    'Mainnet'
  );
  const child = master.derivePath(signingDerivationPath);

  // create Inscription tx
  if (child.privateKey) {
    const pk = secp256k1.schnorr.getPublicKey(child.privateKey);
    const tabLeaf = createInscriptionEnvelope(pk, data, dataType);
    const scriptPk = p2tr(pk);
    const inscribeTx = new Transaction();
    inscribeTx.addInput({
      witnessUtxo: {
        script: scriptPk.script,
        amount: BigInt(satsToSend.toNumber()),
      },
    });
    inscribeTx.addOutput({
      amount: BigInt(99000),
      script: scriptPk.script,
    });

    return inscribeTx;
  }
  throw new Error('Invalid key');
};

export const signInscriptionTx = () => {};
