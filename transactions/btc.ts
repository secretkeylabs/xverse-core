import { ECPair, payments, networks, Psbt, Payment } from 'bitcoinjs-lib';
import BigNumber from 'bignumber.js';
import { BtcUtxoDataResponse, NetworkType } from 'types';
import { fetchBtcFeeRate } from 'currency';
import { getBtcPrivateKey } from 'wallet';
import { fetchBtcAddressUnspent } from '../api/btc';

export interface UnspentOutput extends BtcUtxoDataResponse {}

export async function estimateBtcTransaction(
  privateKey: string,
  senderAddress: string,
  recipientAddress: string,
  amountSats: BigNumber,
  selectedNetwork: NetworkType,
  feeMode: 'high' | 'low'
): Promise<BigNumber> {
  const keyPair = ECPair.fromPrivateKey(Buffer.from(privateKey, 'hex'));
  const network = networks.bitcoin;

  const p2wpkh = payments.p2wpkh({ pubkey: keyPair.publicKey, network });
  const p2sh = payments.p2sh({ redeem: p2wpkh, network });

  const utxos = await fetchBtcAddressUnspent(senderAddress, selectedNetwork);

  const psbt = new Psbt({ network });
  const selectedUnspentOutputs = selectUnspentOutputs(amountSats, utxos);
  const sumValue = sumUnspentOutputs(selectedUnspentOutputs);
  const changeSats = sumValue.minus(amountSats);

  if (sumValue.isLessThan(amountSats)) {
    throw new Error('send.errors.insufficient_balance');
  }

  addInputs(psbt, selectedUnspentOutputs, p2sh);
  addOutputs(psbt, senderAddress, recipientAddress, amountSats, changeSats);

  psbt.signAllInputs(keyPair);
  psbt.finalizeAllInputs();
  const tx = psbt.extractTransaction();
  const txSize = tx.virtualSize();
  const feeRate = await fetchBtcFeeRate();

  const fee =
    feeMode === 'high'
      ? new BigNumber(feeRate?.priority).multipliedBy(txSize)
      : new BigNumber(feeRate?.regular).multipliedBy(txSize);

  return fee;
}

export async function isCustomFeesAllowed(customFees: string) {
  const feeRate = await fetchBtcFeeRate();
  return Number(customFees) >= feeRate?.limits?.min ? true : false;
}

export async function generateSignedBtcTransaction(
  privateKey: string,
  senderAddress: string,
  recipientAddress: string,
  amountSats: BigNumber,
  fee: BigNumber,
  selectedNetwork: NetworkType
): Promise<string> {
  const keyPair = ECPair.fromPrivateKey(Buffer.from(privateKey, 'hex'));
  const network = networks.bitcoin;

  const p2wpkh = payments.p2wpkh({ pubkey: keyPair.publicKey, network });
  const p2sh = payments.p2sh({ redeem: p2wpkh, network });

  const utxos = await fetchBtcAddressUnspent(senderAddress, selectedNetwork);

  const psbt = new Psbt({ network });
  const selectedUnspentOutputs = selectUnspentOutputs(amountSats, utxos);
  const sumValue = sumUnspentOutputs(selectedUnspentOutputs);
  const changeSats = sumValue.minus(amountSats).minus(fee);

  // if (sumValue.isLessThan(amountSats.plus(fee))) {
  //   throw new Error('send.errors.insufficient_balance_fees');
  // }

  addInputs(psbt, selectedUnspentOutputs, p2sh);
  addOutputs(psbt, senderAddress, recipientAddress, amountSats, changeSats);

  psbt.signAllInputs(keyPair);
  psbt.finalizeAllInputs();
  const txHex = psbt.extractTransaction().toHex();

  return txHex;
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
        script: p2sh.output!,
        value: output.value,
      },
      redeemScript: p2sh.redeem!.output,
    });
  });
}

export function addOutputs(
  psbt: Psbt,
  changeAddress: string,
  recipientAddress: string,
  amountSats: BigNumber,
  changeSats: BigNumber
) {
  psbt.addOutput({
    address: recipientAddress,
    value: amountSats.toNumber(),
  });
  psbt.addOutput({
    address: changeAddress,
    value: changeSats.toNumber(),
  });
}

export function sumUnspentOutputs(unspentOutputs: Array<UnspentOutput>): BigNumber {
  var sumValue = new BigNumber(0);
  unspentOutputs.forEach((output) => {
    sumValue = sumValue.plus(output.value);
  });
  return sumValue;
}

export interface SignedBtcTxResponse {
  signedTx: string;
  fee: BigNumber;
  total: BigNumber;
}

export async function signBtcTransaction({
  recipientAddress,
  btcAddress,
  amount,
  index,
  fee,
  seedPhrase,
  network,
}: {
  recipientAddress: string;
  btcAddress: string;
  amount: string;
  index: number;
  fee: BigNumber;
  seedPhrase: string;
  network: NetworkType;
}): Promise<SignedBtcTxResponse> {
  const parsedAmountSats = btcToSats(new BigNumber(amount));

  const privateKey = await getBtcPrivateKey(seedPhrase, BigInt(index), network);

  try {
    const signedTx = await generateSignedBtcTransaction(
      privateKey,
      btcAddress,
      recipientAddress,
      parsedAmountSats,
      fee,
      network
    );

    const total = parsedAmountSats.plus(fee);

    const signedBtcTx: SignedBtcTxResponse = {
      signedTx: signedTx,
      fee: fee,
      total: total,
    };
    return Promise.resolve(signedBtcTx);
  } catch (error) {
    return Promise.reject(error.toString());
  }
}

export async function getBtcFees(
  recipientAddress: string,
  btcAddress: string,
  amount: string,
  index: number,
  feeMode?: string
): Promise<BigNumber> {
  const selectedNetwork = await getSelectedNetwork();
  const networkType = selectedNetwork?.name ?? 'Mainnet';
  const parsedAmountSats = btcToSats(new BigNumber(amount));
  const keychainHelper = new WalletKeychainHelper();
  const seedPhrase = await keychainHelper.retrieveSeedPhraseFromKeystore();
  const privateKey = await getBtcPrivateKey(seedPhrase, new BN(index), networkType);

  try {
    const fee = await estimateBtcTransaction(
      privateKey,
      btcAddress,
      recipientAddress,
      parsedAmountSats,
      networkType,
      feeMode
    );
    return fee;
  } catch (error) {
    return Promise.reject(error.toString());
  }
}
