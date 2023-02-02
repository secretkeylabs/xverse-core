import { ECPair, payments, networks, Psbt, Payment, Transaction } from 'bitcoinjs-lib';
import BigNumber from 'bignumber.js';
import { BtcUtxoDataResponse, ErrorCodes, NetworkType, ResponseError } from '../types';
import { fetchBtcFeeRate } from '../api/xverse';
import { getBtcPrivateKey } from '../wallet';
import { fetchBtcAddressUnspent } from '../api/btc';

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

export function addInputs(psbt: Psbt, unspentOutputs: Array<UnspentOutput>, p2sh: Payment) {
  unspentOutputs.forEach((output) => {
    psbt.addInput({
      hash: output.tx_hash,
      index: output.tx_output_n,
      witnessUtxo: {
        script: p2sh.output ? p2sh.output : Buffer.alloc(0),
        value: output.value,
      },
      redeemScript: p2sh.redeem!.output ? p2sh.redeem!.output : Buffer.alloc(0),
    });
  });
}

export function addOutput(psbt: Psbt, recipientAddress: string, amountSats: BigNumber) {
  psbt.addOutput({
    address: recipientAddress,
    value: Number(amountSats),
  });
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
): Promise<Transaction> {
  const keyPair = ECPair.fromPrivateKey(Buffer.from(privateKey, 'hex'));
  const network = selectedNetwork === 'Mainnet' ? networks.bitcoin : networks.testnet;

  const p2wpkh = payments.p2wpkh({ pubkey: keyPair.publicKey, network });
  const p2sh = payments.p2sh({ redeem: p2wpkh, network });

  const utxos = await fetchBtcAddressUnspent(senderAddress, selectedNetwork);

  var totalSats = feeSats;
  recipients.forEach((recipient) => {
    totalSats = totalSats.plus(recipient.amountSats);
  });

  const psbt = new Psbt({ network });
  const selectedUnspentOutputs = selectUnspentOutputs(totalSats, utxos);
  const sumValue = sumUnspentOutputs(selectedUnspentOutputs);
  const changeSats = sumValue.minus(totalSats);

  if (sumValue.isLessThan(totalSats)) {
    throw new ResponseError(ErrorCodes.InSufficientBalanceWithTxFee).statusCode;
  }

  addInputs(psbt, selectedUnspentOutputs, p2sh);
  recipients.forEach((recipient) => {
    addOutput(psbt, recipient.address, recipient.amountSats);
  });

  if (changeSats.gt(new BigNumber(MINIMUM_CHANGE_OUTPUT_SATS))) {
    addOutput(psbt, senderAddress, changeSats);
  }

  psbt.signAllInputs(keyPair);
  psbt.finalizeAllInputs();
  return psbt.extractTransaction();
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
  const txSize = tx.virtualSize();
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
      signedTx: signedTx.toHex(),
      fee: btcFee,
      total: totalSats,
    };
    return Promise.resolve(signedBtcTx);
  } catch (error) {
    return Promise.reject(error.toString());
  }
}
