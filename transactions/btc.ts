import { ECPair, payments, networks, Psbt, Payment } from 'bitcoinjs-lib';
import BigNumber from 'bignumber.js';
import { BtcUtxoDataResponse, NetworkType } from 'types';
import { fetchBtcFeeRate } from '../api/xverse';
import { getBtcPrivateKey  } from '../wallet';
import { fetchBtcAddressUnspent } from '../api/btc';
import { btcToSats } from '../currency';

export interface UnspentOutput extends BtcUtxoDataResponse {}

export async function estimateBtcTransaction(
  privateKey: string,
  senderAddress: string,
  recipientAddress: string,
  amountSats: BigNumber,
  selectedNetwork: NetworkType,
  feeMode?: string
): Promise<BigNumber> {
  const keyPair = ECPair.fromPrivateKey(Buffer.from(privateKey, 'hex'));
  const network = selectedNetwork === 'Mainnet' ? networks.bitcoin : networks.testnet;

  const p2wpkh = payments.p2wpkh({ pubkey: keyPair.publicKey, network });
  const p2sh = payments.p2sh({ redeem: p2wpkh, network });

  const utxos = await fetchBtcAddressUnspent(senderAddress, selectedNetwork);

  const psbt = new Psbt({ network });
  const selectedUnspentOutputs = selectUnspentOutputs(amountSats, utxos);
  const sumValue = sumUnspentOutputs(selectedUnspentOutputs);
  const changeSats = sumValue.minus(amountSats);

  if (sumValue.isLessThan(amountSats)) {
    throw new Error('Insufficient balance');
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
  const network = selectedNetwork === 'Mainnet' ? networks.bitcoin : networks.testnet;

  const p2wpkh = payments.p2wpkh({ pubkey: keyPair.publicKey, network });
  const p2sh = payments.p2sh({ redeem: p2wpkh, network });
  const utxos = await fetchBtcAddressUnspent(senderAddress, selectedNetwork);

  const totalAmountSats = amountSats.plus(fee);
  const psbt = new Psbt({ network });
  const selectedUnspentOutputs = selectUnspentOutputs(totalAmountSats, utxos);
  const sumValue = sumUnspentOutputs(selectedUnspentOutputs);
  const changeSats = sumValue.minus(totalAmountSats);

  if (sumValue.isLessThan(totalAmountSats)) {
     throw new Error('Insufficient balance when including transaction fees');
   }

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

export function addInputs(psbt: Psbt, unspentOutputs: Array<UnspentOutput> , p2sh: Payment) {
  unspentOutputs.forEach((output) => {
    psbt.addInput({
      hash: output.tx_hash,
      index: output.tx_output_n,
      witnessUtxo: {
        script: p2sh.output ? p2sh.output :  Buffer.alloc(0),
        value: output.value,
      },
      redeemScript: p2sh.redeem!.output ? p2sh.redeem!.output : Buffer.alloc(0) ,
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
  fee?: BigNumber;
  seedPhrase: string;
  network: NetworkType;
}): Promise<SignedBtcTxResponse> {
  const parsedAmountSats = btcToSats(new BigNumber(amount));
  const privateKey = await getBtcPrivateKey({seedPhrase,index: BigInt(index), network});
  let btcFee: BigNumber;
  if (!fee) {
    btcFee = await getBtcFees(
      recipientAddress,
      btcAddress,
      amount,
      index,
      network,
      seedPhrase,
    );
  } else {
    btcFee = fee;
  }
  try {
    const signedTx = await generateSignedBtcTransaction(
      privateKey,
      btcAddress,
      recipientAddress,
      parsedAmountSats,
      btcFee,
      network
    );

    const total = parsedAmountSats.plus(btcFee);

    const signedBtcTx: SignedBtcTxResponse = {
      signedTx: signedTx,
      fee: btcFee,
      total: total,
    };
    return Promise.resolve(signedBtcTx);
  } catch (error : any) {
    return Promise.reject(error.toString());
  }
}

export async function getBtcFees(
  recipientAddress: string,
  btcAddress: string,
  amount: string,
  index: number,
  network: NetworkType,
  seedPhrase: string,
  feeMode?: string,
): Promise<BigNumber> {
  const parsedAmountSats = btcToSats(new BigNumber(amount));
  const privateKey = await getBtcPrivateKey({seedPhrase, index: BigInt(index), network});

  try {
    const fee = await estimateBtcTransaction(
      privateKey,
      btcAddress,
      recipientAddress,
      parsedAmountSats,
      network,
      feeMode
    );
    return fee;
  } catch (error : any) {
    return Promise.reject(error.toString());
  }
}
