import { base64 } from '@scure/base';
import BigNumber from 'bignumber.js';
import { NetworkType, UTXO } from 'types';
import { createInscriptionRequest } from '../api';
import BitcoinEsploraApiProvider from '../api/esplora/esploraAPiProvider';
import xverseInscribeApi from '../api/xverseInscribe';
import { calculateFee, generateSignedBtcTransaction } from './btc';

const RECIPIENT_SATS_VALUE = 1000;

const createTransferInscriptionContent = (token: string, amount: string) => ({
  p: 'brc-20',
  op: 'transfer',
  tick: token,
  amt: amount,
});

const btcClient = new BitcoinEsploraApiProvider({
  network: 'Mainnet',
});

// TODO: deprecate
export const createBrc20TransferOrder = async (token: string, amount: string, recipientAddress: string) => {
  const transferInscriptionContent = createTransferInscriptionContent(token, amount);
  const contentB64 = base64.encode(Buffer.from(JSON.stringify(transferInscriptionContent)));
  const contentSize = Buffer.from(JSON.stringify(transferInscriptionContent)).length;
  const feesResponse = await btcClient.getRecommendedFees();
  const inscriptionRequest = await createInscriptionRequest(
    recipientAddress,
    contentSize,
    feesResponse.fastestFee,
    contentB64,
    token,
    amount,
  );

  return {
    inscriptionRequest,
    feesResponse,
  };
};

export const brc20TransferEstimateFees = async (
  selectedUtxos: Array<UTXO>,
  tick: string,
  amount: number,
  revealAddress: string,
  feeRate: number,
) => {
  const finalRecipientUtxoValue = new BigNumber(RECIPIENT_SATS_VALUE);
  const transferFeeEstimate = await calculateFee(
    [{ address: revealAddress, status: { confirmed: false }, txid: '', vout: 0, value: RECIPIENT_SATS_VALUE }],
    finalRecipientUtxoValue,
    [{ address: revealAddress, amountSats: finalRecipientUtxoValue }],
    new BigNumber(feeRate),
    revealAddress,
    'Mainnet',
  );

  const inscriptionValue = finalRecipientUtxoValue.plus(transferFeeEstimate);

  const { chainFee: revealChainFee, serviceFee: revealServiceFee } = await xverseInscribeApi.getBrc20TransferFees(
    tick,
    amount,
    revealAddress,
    feeRate,
    inscriptionValue.toNumber(),
  );

  const commitValue = inscriptionValue.plus(revealChainFee).plus(revealServiceFee);
  const commitChainFees = await calculateFee(
    selectedUtxos,
    commitValue,
    [{ address: revealAddress, amountSats: finalRecipientUtxoValue }],
    new BigNumber(feeRate),
    revealAddress,
    'Mainnet',
  );

  return {
    commitValue: commitValue.plus(commitChainFees).toNumber(),
    valueBreakdown: {
      commitChainFee: commitChainFees.toNumber(),
      revealChainFee,
      revealServiceFee,
      transferChainFee: transferFeeEstimate.toNumber(),
      transferUtxoValue: finalRecipientUtxoValue.toNumber(),
    },
  };
};

export enum ExecuteTransferProgressCodes {
  CreatingInscriptionOrder = 'CreatingInscriptionOrder',
  CreatingCommitTransaction = 'CreatingCommitTransaction',
  ExecutingInscriptionOrder = 'ExecutingInscriptionOrder',
  CreatingTransferTransaction = 'CreatingTransferTransaction',
  Finalizing = 'Finalizing',
}

export async function* Brc20TransferExecute(
  privateKey: string,
  selectedUtxos: Array<UTXO>,
  tick: string,
  amount: number,
  revealAddress: string,
  recipientAddress: string,
  feeRate: BigNumber,
  network: NetworkType,
): AsyncGenerator<ExecuteTransferProgressCodes, string, never> {
  const esploraClient = new BitcoinEsploraApiProvider({ network });

  yield ExecuteTransferProgressCodes.CreatingInscriptionOrder;

  const finalRecipientUtxoValue = new BigNumber(RECIPIENT_SATS_VALUE);
  const transferFeeEstimate = await calculateFee(
    [{ address: revealAddress, status: { confirmed: false }, txid: '', vout: 0, value: RECIPIENT_SATS_VALUE }],
    finalRecipientUtxoValue,
    [{ address: recipientAddress, amountSats: finalRecipientUtxoValue }],
    feeRate,
    revealAddress,
    network,
  );

  const inscriptionValue = finalRecipientUtxoValue.plus(transferFeeEstimate);

  const { commitAddress, commitValue } = await xverseInscribeApi.createBrc20TransferOrder(
    tick,
    amount,
    revealAddress,
    feeRate.toNumber(),
    network,
    inscriptionValue.toNumber(),
  );

  yield ExecuteTransferProgressCodes.CreatingCommitTransaction;

  const commitChainFees = await calculateFee(
    selectedUtxos,
    new BigNumber(commitValue),
    [{ address: recipientAddress, amountSats: finalRecipientUtxoValue }],
    feeRate,
    revealAddress,
    network,
  );

  // This should be:
  // final transfer value that the recipient will receive in their UTXO + final transfer fees
  // + reveal service fees + reveal chain fees
  // + commit chain fees
  const totalCommitValueSats = new BigNumber(commitValue).plus(commitChainFees);

  const commitTransaction = await generateSignedBtcTransaction(
    privateKey,
    selectedUtxos,
    totalCommitValueSats,
    [
      {
        address: commitAddress,
        amountSats: totalCommitValueSats,
      },
    ],
    revealAddress,
    commitChainFees,
    network,
  );

  yield ExecuteTransferProgressCodes.ExecutingInscriptionOrder;

  const { revealTransactionId, revealUTXOVOut, revealUTXOValue } = await xverseInscribeApi.executeBrc20TransferOrder(
    commitAddress,
    commitTransaction.hex,
  );

  yield ExecuteTransferProgressCodes.CreatingTransferTransaction;
  const transferTransaction = await generateSignedBtcTransaction(
    privateKey,
    [
      {
        address: revealAddress,
        status: {
          confirmed: false,
        },
        txid: revealTransactionId,
        vout: revealUTXOVOut,
        value: revealUTXOValue,
      },
    ],
    finalRecipientUtxoValue,
    [
      {
        address: recipientAddress,
        amountSats: finalRecipientUtxoValue,
      },
    ],
    revealAddress,
    transferFeeEstimate,
    network,
  );

  yield ExecuteTransferProgressCodes.Finalizing;

  const response = await esploraClient.sendRawTransaction(transferTransaction.hex);

  return response.tx.hash;
}
