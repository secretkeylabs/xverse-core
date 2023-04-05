import BigNumber from 'bignumber.js';
import { AppClient, DefaultWalletPolicy } from 'ledger-bitcoin';
import {
  defaultFeeRate,
  getFee,
  Recipient,
  selectUnspentOutputs,
  sumUnspentOutputs,
} from '../transactions/btc';
import { BtcFeeResponse, ErrorCodes, NetworkType, ResponseError } from 'types/network';
import { getNestedSegwitAccountDataFromXpub, getPublicKeyFromXpubAtIndex } from './helper';
import { Transport } from './types';
import { fetchBtcAddressUnspent } from 'api/btc';
import { fetchBtcFeeRate } from 'api';
import { networks, Psbt } from 'bitcoinjs-lib';
import axios from 'axios';

/**
 * This function is used to get the nested segwit account data from the ledger
 * @param app - the ledger app client
 * @param network - the network type
 * @param masterFingerPrint - the master finger print
 * @param accountIndex - the account index
 * @param addressIndex - the address index
 * @param showAddress - show address on the wallet's screen
 * @returns the address and the public key in compressed format
 * */
export async function importNestedSegwitAccountFromLedger(
  app: AppClient,
  network: NetworkType,
  masterFingerPrint: string,
  accountIndex: number = 0,
  addressIndex: number = 0,
  showAddress: boolean = false
): Promise<{ address: string; publicKey: string }> {
  const btcNetwork = network === 'Mainnet' ? 0 : 1;
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
 * @param app - the ledger app client
 * @param network - the network type
 * @param masterFingerPrint - the master finger print
 * @param accountIndex - the account index
 * @param addressIndex - the address index
 * @param showAddress - show address on the wallet's screen
 * @returns the address and the public key in compressed format
 * */
export async function importTaprootAccountFromLedger(
  app: AppClient,
  network: NetworkType,
  masterFingerPrint: string,
  accountIndex: number = 0,
  addressIndex: number = 0,
  showAddress: boolean = false
): Promise<{ address: string; publicKey: string }> {
  const btcNetwork = network === 'Mainnet' ? 0 : 1;
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
 * This function is used to sign a Nested Segwit transaction with the ledger
 * @param transport - the transport object with connected ledger device
 * @param network - the network type
 * @param addressIndex - the address index
 * @param recipient - the recipient of the transaction
 * @returns the signed raw transaction in hex format
 * */

export async function signLedgerNestedSegwitBtcTransaction(
  transport: Transport,
  network: NetworkType,
  addressIndex: number,
  recipient: Recipient
): Promise<string> {
  // TODO - Refactor this to sub functions
  let feeRate: BtcFeeResponse = defaultFeeRate;
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
  const { address: recipientAddress, amountSats } = recipient;

  //================================================================================================
  // 2. Get UTXOs
  //================================================================================================
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

  // Recalculate the sum of selected UTXOs
  if (newSelectedUnspentOutputs.length !== selectedUTXOs.length) {
    selectedUTXOs = newSelectedUnspentOutputs;
    sumOfSelectedUTXOs = sumUnspentOutputs(newSelectedUnspentOutputs);

    if (sumOfSelectedUTXOs.isLessThan(amountSats.plus(fee))) {
      throw new ResponseError(ErrorCodes.InSufficientBalanceWithTxFee).statusCode;
    }
  }

  //================================================================================================
  // 3. Create Transaction
  //================================================================================================

  const btcNetwork = network === 'Mainnet' ? networks.bitcoin : networks.testnet;
  const psbt = new Psbt({ network: btcNetwork });

  const transactionMap = new Map<string, Buffer>();
  for (const utxo of newSelectedUnspentOutputs) {
    const txDataApiUrl = `https://blockstream.info/testnet/api/tx/${utxo.tx_hash}/hex`;
    const response = await axios.get(txDataApiUrl);
    transactionMap.set(utxo.tx_hash, Buffer.from(response.data, 'hex'));
  }

  for (const utxo of newSelectedUnspentOutputs) {
    psbt.addInput({
      hash: utxo.tx_hash,
      index: utxo.tx_output_n,
      redeemScript: redeemScript,
      witnessUtxo: {
        script: witnessScript,
        value: utxo.value,
      },
      nonWitnessUtxo: transactionMap.get(utxo.tx_hash),
      bip32Derivation: [
        {
          path: `m/49'/${coinType}'/0'/0/${addressIndex}`,
          pubkey: senderPublicKey,
          masterFingerprint: Buffer.from(masterFingerPrint, 'hex'),
        },
      ],
    });
  }

  psbt.addOutputs([
    {
      address: recipientAddress,
      value: amountSats.toNumber(),
    },
    {
      address: senderAddress,
      value: sumOfSelectedUTXOs.minus(amountSats).minus(fee).toNumber(),
    },
  ]);

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
