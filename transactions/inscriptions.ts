import { P2TROut, Script, Transaction, p2tr } from '@scure/btc-signer';
import * as secp256k1 from '@noble/secp256k1';
import BigNumber from 'bignumber.js';
import {  Account, UTXO } from '../types';
import BitcoinEsploraApiProvider from 'api/esplora/esploraAPiProvider';
import { getBtcFeeRate, getFee, selectUnspentOutputs, sumUnspentOutputs } from './btc';
import { getBtcTaprootPrivateKey } from '../wallet';

export enum SupportedTypes {
  TEXT = '"text/plain;charset=utf-8"',
  IMAGE = 'image/jpeg',
}

interface InscriptionTxArguments {
  data: Uint8Array;
  dataType: SupportedTypes;
  creatorAccount: Account;
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


const addInscriptionInputs = (
  inputsToAdd: UTXO[],
  tx: Transaction,
  spend: P2TROut,
  tapInternalKey: Uint8Array,
  ordinalEnvelope: Uint8Array
) => {
  inputsToAdd.map((input) => {
    tx.addInput({
      txid: input.txid,
      index: input.vout,
      witnessUtxo: {
        script: spend.script,
        amount: BigInt(input.value),
      },
      witnessScript: input.vout === 0 ? ordinalEnvelope : undefined,
      tapInternalKey,
    });
  });
};

export const createInscriptionTx = async (options: InscriptionTxArguments) => {
  const { seedPhrase, creatorAccount, data, dataType } = options;
  // get the user unspent outputs
  const accountUtxos = await btcClient.getUnspentUtxos(creatorAccount.ordinalsAddress);
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
  // Calculate transaction fee
  const { newSelectedUnspentOutputs, fee } = await getFee(
    selectedUnspentOutputs,
    selectedUnspentOutputs,
    sumSelectedOutputs,
    inscriptionAmount,
    recipients,
    feeRate,
    creatorAccount.ordinalsAddress,
    'Mainnet'
  );
  selectedUnspentOutputs = newSelectedUnspentOutputs;
  const satsToSend = inscriptionAmount.plus(fee);

  // derive user private keys to sign the tx input
  const taprootPrivateKey = await getBtcTaprootPrivateKey({
    seedPhrase,
    index: BigInt(creatorAccount.id),
    network: 'Mainnet',
  });
  // create Inscription tx
    const pk = secp256k1.schnorr.getPublicKey(taprootPrivateKey);
    const tabLeaf = createInscriptionEnvelope(pk, data, dataType);
    const scriptPk = p2tr(pk);
    const inscribeTx = new Transaction();
    addInscriptionInputs(selectedUnspentOutputs, inscribeTx, scriptPk, pk, tabLeaf);
    inscribeTx.addOutputAddress(
      creatorAccount.ordinalsAddress,
      BigInt(inscriptionAmount.toNumber()),
    );
    inscribeTx.addOutput({
      amount: BigInt(inscriptionAmount.toNumber()),
      script: scriptPk.script,
    });

    return inscribeTx;
};

export const signInscriptionTx = () => {};
