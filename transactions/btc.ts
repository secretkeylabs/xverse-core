// import { payments, networks, Psbt, Payment, Transaction } from 'bitcoinjs-lib';
// import { ECPairFactory } from 'ecpair';
import BigNumber from 'bignumber.js';
import { BtcUtxoDataResponse, ErrorCodes, NetworkType, ResponseError } from '../types';
import { fetchBtcFeeRate } from '../api/xverse';
import { getBtcPrivateKey } from '../wallet';
import { fetchBtcAddressUnspent } from '../api/btc';
import * as btc from 'micro-btc-signer';
import { hex } from '@scure/base';
import * as secp256k1 from '@noble/secp256k1'
import { BitcoinNetwork, getBtcNetwork } from './btcNetwork';

const MINIMUM_CHANGE_OUTPUT_SATS = 1000;

export interface UnspentOutput extends BtcUtxoDataResponse {}

export interface Recipient {
  address: string;
  amountSats: BigNumber;
}

export interface SignedBtcTx {
  signedTx: string;
  fee: BigNumber;
  total: BigNumber;
}

export async function isCustomFeesAllowed(customFees: string) {
  const feeRate = await fetchBtcFeeRate();
  return Number(customFees) >= feeRate?.limits?.min ? true : false;
}

export function selectUnspentOutputs(
  amountSats: BigNumber,
  unspentOutputs: Array<UnspentOutput>
): Array<UnspentOutput> {
  const inputs: Array<UnspentOutput> = [];
  var sumValue = 0;
  unspentOutputs.forEach((unspentOutput) => {
    if (amountSats.toNumber() > sumValue) {
      inputs.push(unspentOutput);
      sumValue += unspentOutput.value;
    }
  });
  return inputs;
}

export function addInputs(
  tx: btc.Transaction, 
  unspentOutputs: Array<UnspentOutput>, 
  p2sh: any
) {
  unspentOutputs.forEach((output) => {
    tx.addInput({
      txid: output.tx_hash,
      index: output.tx_output_n,
      witnessUtxo: {
        script: p2sh.script ? p2sh.script : Buffer.alloc(0),
        amount: BigInt(output.value),
      },
      redeemScript: p2sh.redeemScript ? p2sh.redeemScript : Buffer.alloc(0),
    })
  });
}

export function addOutput(
  tx: btc.Transaction,
  recipientAddress: string,
  amountSats: BigNumber,
  network: BitcoinNetwork,
) {
  tx.addOutputAddress(recipientAddress, BigInt(amountSats.toNumber()), network);
}

export function sumUnspentOutputs(unspentOutputs: Array<UnspentOutput>): BigNumber {
  var sumValue = new BigNumber(0);
  unspentOutputs.forEach((output) => {
    sumValue = sumValue.plus(output.value);
  });
  return sumValue;
}

export async function generateSignedBtcTransaction(
  privateKey: string,
  senderAddress: string,
  recipients: Array<Recipient>,
  feeSats: BigNumber,
  selectedNetwork: NetworkType
): Promise<btc.Transaction> {
  const privKey = hex.decode(privateKey);
  const tx = new btc.Transaction();
  const btcNetwork = getBtcNetwork(selectedNetwork);
  const p2wph = btc.p2wpkh(secp256k1.getPublicKey(privKey, true), btcNetwork);
  const p2sh = btc.p2sh(p2wph, btcNetwork);
  const utxos = await fetchBtcAddressUnspent(senderAddress, selectedNetwork);

  var totalSats = feeSats;
  recipients.forEach((recipient) => {
    totalSats = totalSats.plus(recipient.amountSats);
  });

  const selectedUnspentOutputs = selectUnspentOutputs(totalSats, utxos);
  const sumValue = sumUnspentOutputs(selectedUnspentOutputs);
  const changeSats = sumValue.minus(totalSats);

  if (sumValue.isLessThan(totalSats)) {
    throw new ResponseError(ErrorCodes.InSufficientBalanceWithTxFee).statusCode;
  }

  addInputs(tx, selectedUnspentOutputs, p2sh)

  recipients.forEach((recipient) => {
    addOutput(tx, recipient.address, recipient.amountSats, btcNetwork);
  });

  if (changeSats.gt(new BigNumber(MINIMUM_CHANGE_OUTPUT_SATS))) {
    addOutput(tx, senderAddress, changeSats, btcNetwork);
  }

  tx.sign(privKey);
  tx.finalize();
  return tx;
}

export async function estimateBtcTransaction(
  senderAddress: string,
  recipients: Array<Recipient>,
  selectedNetwork: NetworkType,
  feeMode?: string
): Promise<BigNumber> {
  const dummyPrivateKey = '0000000000000000000000000000000000000000000000000000000000000001';
  const tx = await generateSignedBtcTransaction(
    dummyPrivateKey,
    senderAddress,
    recipients,
    new BigNumber(0),
    selectedNetwork
  );
  const txSize = tx.vsize;
  const feeRate = await fetchBtcFeeRate();

  const fee =
    feeMode === 'high'
      ? new BigNumber(feeRate?.priority).multipliedBy(txSize)
      : new BigNumber(feeRate?.regular).multipliedBy(txSize);

  return fee;
}

export async function getBtcFees(
  recipients: Array<Recipient>,
  btcAddress: string,
  network: NetworkType,
  feeMode?: string
): Promise<BigNumber> {
  try {
    const fee = await estimateBtcTransaction(btcAddress, recipients, network, feeMode);
    return fee;
  } catch (error) {
    return Promise.reject(error.toString());
  }
}

export async function signBtcTransaction(
  recipients: Array<Recipient>,
  btcAddress: string,
  index: number,
  seedPhrase: string,
  network: NetworkType,
  fee?: BigNumber
): Promise<SignedBtcTx> {
  let btcFee: BigNumber;
  const privateKey = await getBtcPrivateKey({ seedPhrase, index: BigInt(index), network });
  if (!fee) {
    btcFee = await getBtcFees(recipients, btcAddress, network);
  } else {
    btcFee = fee;
  }
  try {
    const signedTx = await generateSignedBtcTransaction(
      privateKey,
      btcAddress,
      recipients,
      btcFee,
      network
    );

    var totalSats = btcFee;
    recipients.forEach((recipient) => {
      totalSats = totalSats.plus(recipient.amountSats);
    });

    const signedBtcTx: SignedBtcTx = {
      signedTx: signedTx.hex,
      fee: btcFee,
      total: totalSats,
    };
    return Promise.resolve(signedBtcTx);
  } catch (error) {
    return Promise.reject(error.toString());
  }

}
