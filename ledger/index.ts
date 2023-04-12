import BigNumber from 'bignumber.js';
import { AppClient, DefaultWalletPolicy } from 'ledger-bitcoin';
import {
  defaultFeeRate,
  getFee,
  Recipient,
  selectUnspentOutputs,
  sumUnspentOutputs,
} from '../transactions/btc';
import {
  BtcFeeResponse,
  BtcUtxoDataResponse,
  ErrorCodes,
  NetworkType,
  ResponseError,
} from '../types';
import { getNestedSegwitAccountDataFromXpub, getPublicKeyFromXpubAtIndex } from './helper';
import { Bip32Derivation, Transport } from './types';
import { fetchBtcAddressUnspent } from '../api/btc';
import { fetchBtcFeeRate } from '../api';
import { networks, Psbt } from 'bitcoinjs-lib';
import axios from 'axios';

/**
 * This function is used to get the nested segwit account data from the ledger
 * @param showAddress - show address on the wallet's screen
 * @returns the address and the public key in compressed format
 * */
export async function importNestedSegwitAccountFromLedger(
  transport: Transport,
  network: NetworkType,
  accountIndex: number = 0,
  addressIndex: number = 0,
  showAddress: boolean = false
): Promise<{ address: string; publicKey: string }> {
  const app = new AppClient(transport);

  const btcNetwork = network === 'Mainnet' ? 0 : 1;
  const masterFingerPrint = await app.getMasterFingerprint();
  const extendedPublicKey = await app.getExtendedPubkey(`m/49'/${btcNetwork}'/${accountIndex}'`);
  const accountPolicy = new DefaultWalletPolicy(
    'sh(wpkh(@0/**))',
    `[${masterFingerPrint}/49'/${btcNetwork}'/${accountIndex}']${extendedPublicKey}`
  );
  const address = await app.getWalletAddress(accountPolicy, null, 0, addressIndex, showAddress);
  const publicKey = getPublicKeyFromXpubAtIndex(extendedPublicKey, addressIndex, network);

  return { address, publicKey: publicKey.toString('hex') };
}

/**
 * This function is used to get the taproot account data from the ledger
 * @param showAddress - show address on the wallet's screen
 * @returns the address and the public key in compressed format
 * */
export async function importTaprootAccountFromLedger(
  transport: Transport,
  network: NetworkType,
  accountIndex: number = 0,
  addressIndex: number = 0,
  showAddress: boolean = false
): Promise<{ address: string; publicKey: string }> {
  const app = new AppClient(transport);

  const btcNetwork = network === 'Mainnet' ? 0 : 1;
  const masterFingerPrint = await app.getMasterFingerprint();
  const extendedPublicKey = await app.getExtendedPubkey(`m/86'/${btcNetwork}'/${accountIndex}'`);
  const accountPolicy = new DefaultWalletPolicy(
    'tr(@0/**)',
    `[${masterFingerPrint}/86'/${btcNetwork}'/${accountIndex}']${extendedPublicKey}`
  );
  const address = await app.getWalletAddress(accountPolicy, null, 0, addressIndex, showAddress);
  const publicKey = getPublicKeyFromXpubAtIndex(extendedPublicKey, addressIndex, network);

  return { address, publicKey: publicKey.toString('hex') };
}

/**
 * This function is used to get the transaction data for the ledger psbt
 * @returns the selected utxos, the change value and the fee
 * */
async function getTransactionData(
  network: NetworkType,
  senderAddress: string,
  recipient: Recipient
) {
  let feeRate: BtcFeeResponse = defaultFeeRate;
  const { amountSats } = recipient;

  const allUTXOs = await fetchBtcAddressUnspent(senderAddress, network);
  let selectedUTXOs = selectUnspentOutputs(amountSats, allUTXOs);
  let sumOfSelectedUTXOs = sumUnspentOutputs(selectedUTXOs);

  if (sumOfSelectedUTXOs.isLessThan(amountSats)) {
    throw new ResponseError(ErrorCodes.InSufficientBalanceWithTxFee).statusCode;
  }

  feeRate = await fetchBtcFeeRate();
  const { newSelectedUnspentOutputs, fee } = await getFee(
    allUTXOs,
    selectedUTXOs,
    sumOfSelectedUTXOs,
    amountSats,
    [recipient],
    feeRate,
    senderAddress,
    network
  );

  // Recalculate the sum of selected UTXOs if new UTXOs were selected
  if (newSelectedUnspentOutputs.length !== selectedUTXOs.length) {
    selectedUTXOs = newSelectedUnspentOutputs;
    sumOfSelectedUTXOs = sumUnspentOutputs(newSelectedUnspentOutputs);

    if (sumOfSelectedUTXOs.isLessThan(amountSats.plus(fee))) {
      throw new ResponseError(ErrorCodes.InSufficientBalanceWithTxFee).statusCode;
    }
  }

  const changeValue = sumOfSelectedUTXOs.minus(amountSats).minus(fee);

  return { selectedUTXOs, changeValue, fee };
}

/**
 * This function is used to create a nested segwit transaction for the ledger
 * @param inputUTXOs - the selected input utxos
 * @param inputDerivation - the derivation data for the sender address
 * @returns the psbt without any signatures
 * */
async function createNestedSegwitPsbt(
  network: NetworkType,
  recipient: Recipient,
  changeAddress: string,
  changeValue: BigNumber,
  inputUTXOs: BtcUtxoDataResponse[],
  inputDerivation: Bip32Derivation[] | undefined,
  redeemScript: Buffer,
  witnessScript: Buffer
): Promise<Psbt> {
  const btcNetwork = network === 'Mainnet' ? networks.bitcoin : networks.testnet;
  const psbt = new Psbt({ network: btcNetwork });
  const { address: recipientAddress, amountSats } = recipient;

  const transactionMap = new Map<string, Buffer>();
  for (const utxo of inputUTXOs) {
    const txDataApiUrl = `https://blockstream.info/testnet/api/tx/${utxo.tx_hash}/hex`;
    const response = await axios.get(txDataApiUrl);
    transactionMap.set(utxo.tx_hash, Buffer.from(response.data, 'hex'));
  }

  for (const utxo of inputUTXOs) {
    psbt.addInput({
      hash: utxo.tx_hash,
      index: utxo.tx_output_n,
      redeemScript: redeemScript,
      // both nonWitnessUtxo and witnessUtxo are required or the ledger displays warning message
      witnessUtxo: {
        script: witnessScript,
        value: utxo.value,
      },
      nonWitnessUtxo: transactionMap.get(utxo.tx_hash),
      bip32Derivation: inputDerivation,
    });
  }

  psbt.addOutputs([
    {
      address: recipientAddress,
      value: amountSats.toNumber(),
    },
    {
      address: changeAddress,
      value: changeValue.toNumber(),
    },
  ]);

  return psbt;
}

/**
 * This function is used to sign a Nested Segwit transaction with the ledger
 * @param transport - the transport object with connected ledger device
 * @param recipient - the recipient of the transaction
 * @returns the signed raw transaction in hex format
 * */

export async function signLedgerNestedSegwitBtcTransaction(
  transport: Transport,
  network: NetworkType,
  addressIndex: number,
  recipient: Recipient
): Promise<string> {
  const coinType = network === 'Mainnet' ? 0 : 1;
  const app = new AppClient(transport);

  //================================================================================================
  // 1. Get Account Data
  //================================================================================================

  const masterFingerPrint = await app.getMasterFingerprint();
  const extendedPublicKey = await app.getExtendedPubkey(`m/49'/${coinType}'/0'`);
  const accountPolicy = new DefaultWalletPolicy(
    'sh(wpkh(@0/**))',
    `[${masterFingerPrint}/49'/${coinType}'/0']${extendedPublicKey}`
  );

  const {
    publicKey: senderPublicKey,
    address: senderAddress,
    redeemScript,
    witnessScript,
  } = getNestedSegwitAccountDataFromXpub(extendedPublicKey, addressIndex, network);

  //================================================================================================
  // 2. Get UTXOs
  //================================================================================================

  const { selectedUTXOs, changeValue } = await getTransactionData(
    network,
    senderAddress,
    recipient
  );

  //================================================================================================
  // 3. Create Transaction
  //================================================================================================

  const inputDerivation: Bip32Derivation = {
    path: `m/49'/${coinType}'/0'/0/${addressIndex}`,
    pubkey: senderPublicKey,
    masterFingerprint: Buffer.from(masterFingerPrint, 'hex'),
  };
  const psbt = await createNestedSegwitPsbt(
    network,
    recipient,
    senderAddress,
    changeValue,
    selectedUTXOs,
    [inputDerivation],
    redeemScript,
    witnessScript
  );

  //================================================================================================
  // 4. Sign Transaction
  //================================================================================================

  const signatures = await app.signPsbt(psbt.toBase64(), accountPolicy, null);

  for (const signature of signatures) {
    psbt.updateInput(signature[0], {
      partialSig: [signature[1]],
    });
  }

  //================================================================================================
  // 5. Finalize Transaction
  //================================================================================================

  psbt.finalizeAllInputs();
  return psbt.extractTransaction().toHex();
}
