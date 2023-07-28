import { base64 } from '@scure/base';
import BigNumber from 'bignumber.js';
import { NetworkType, UTXO } from 'types';
import { createInscriptionRequest } from '../api';
import BitcoinEsploraApiProvider from '../api/esplora/esploraAPiProvider';
import xverseInscribeApi from '../api/xverseInscribe';
import { getBtcPrivateKey } from '../wallet';
import { generateSignedBtcTransaction, selectUtxosForSend, signNonOrdinalBtcSendTransaction } from './btc';

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
  addressUtxos: UTXO[],
  tick: string,
  amount: number,
  revealAddress: string,
  feeRate: number,
) => {
  const dummyAddress = 'bc1pgkwmp9u9nel8c36a2t7jwkpq0hmlhmm8gm00kpdxdy864ew2l6zqw2l6vh';
  const finalRecipientUtxoValue = new BigNumber(RECIPIENT_SATS_VALUE);
  const { tx } = await signNonOrdinalBtcSendTransaction(
    dummyAddress,
    [
      {
        address: revealAddress,
        status: {
          confirmed: false,
        },
        txid: '0000000000000000000000000000000000000000000000000000000000000001',
        vout: 0,
        value: RECIPIENT_SATS_VALUE,
      },
    ],
    0,
    'action action action action action action action action action action action action',
    'Mainnet',
  );

  const transferFeeEstimate = tx.vsize * feeRate;

  const inscriptionValue = finalRecipientUtxoValue.plus(transferFeeEstimate);

  const { chainFee: revealChainFee, serviceFee: revealServiceFee } = await xverseInscribeApi.getBrc20TransferFees(
    tick,
    amount,
    revealAddress,
    feeRate,
    inscriptionValue.toNumber(),
  );

  const commitValue = inscriptionValue.plus(revealChainFee).plus(revealServiceFee);

  const bestUtxoData = selectUtxosForSend(
    dummyAddress,
    [{ address: revealAddress, amountSats: new BigNumber(commitValue) }],
    addressUtxos,
    feeRate,
  );

  if (!bestUtxoData) {
    throw new Error('Not enough funds at selected fee rate');
  }

  const commitChainFees = bestUtxoData.fee;

  return {
    commitValue: commitValue.plus(commitChainFees).toNumber(),
    valueBreakdown: {
      commitChainFee: commitChainFees,
      revealChainFee,
      revealServiceFee,
      transferChainFee: transferFeeEstimate,
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

export async function* brc20TransferExecute(
  seedPhrase: string,
  accountIndex: number,
  addressUtxos: UTXO[],
  tick: string,
  amount: number,
  revealAddress: string,
  changeAddress: string,
  recipientAddress: string,
  feeRate: number,
  network: NetworkType,
): AsyncGenerator<ExecuteTransferProgressCodes, string, never> {
  const privateKey = await getBtcPrivateKey({
    seedPhrase,
    index: BigInt(accountIndex),
    network: 'Mainnet',
  });

  const esploraClient = new BitcoinEsploraApiProvider({ network });

  yield ExecuteTransferProgressCodes.CreatingInscriptionOrder;

  const finalRecipientUtxoValue = new BigNumber(RECIPIENT_SATS_VALUE);
  const { tx } = await await signNonOrdinalBtcSendTransaction(
    recipientAddress,
    [
      {
        address: revealAddress,
        status: {
          confirmed: false,
        },
        txid: '0000000000000000000000000000000000000000000000000000000000000001',
        vout: 0,
        value: RECIPIENT_SATS_VALUE,
      },
    ],
    accountIndex,
    seedPhrase,
    'Mainnet',
  );

  const transferFeeEstimate = tx.vsize * feeRate;

  const inscriptionValue = finalRecipientUtxoValue.plus(transferFeeEstimate);

  const { commitAddress, commitValue } = await xverseInscribeApi.createBrc20TransferOrder(
    tick,
    amount,
    revealAddress,
    feeRate,
    network,
    inscriptionValue.toNumber(),
  );

  yield ExecuteTransferProgressCodes.CreatingCommitTransaction;

  const bestUtxoData = selectUtxosForSend(
    changeAddress,
    [{ address: revealAddress, amountSats: new BigNumber(commitValue) }],
    addressUtxos,
    feeRate,
  );

  if (!bestUtxoData) {
    throw new Error('Not enough funds at selected fee rate');
  }

  const commitChainFees = bestUtxoData.fee;

  const commitTransaction = await generateSignedBtcTransaction(
    privateKey,
    bestUtxoData.selectedUtxos,
    new BigNumber(commitValue),
    [
      {
        address: commitAddress,
        amountSats: new BigNumber(commitValue),
      },
    ],
    changeAddress,
    new BigNumber(commitChainFees),
    network,
  );

  yield ExecuteTransferProgressCodes.ExecutingInscriptionOrder;

  const { revealTransactionId, revealUTXOVOut, revealUTXOValue } = await xverseInscribeApi.executeBrc20Order(
    commitAddress,
    commitTransaction.hex,
  );

  yield ExecuteTransferProgressCodes.CreatingTransferTransaction;

  const transferTransaction = await signNonOrdinalBtcSendTransaction(
    recipientAddress,
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
    accountIndex,
    seedPhrase,
    'Mainnet',
    new BigNumber(transferFeeEstimate),
  );

  yield ExecuteTransferProgressCodes.Finalizing;

  // we sleep here to give the reveal transaction time to propagate
  await new Promise((resolve) => setTimeout(resolve, 500));

  const MAX_RETRIES = 2;
  let error: Error | undefined;

  for (let i = 0; i <= MAX_RETRIES; i++) {
    try {
      const response = await esploraClient.sendRawTransaction(transferTransaction.signedTx);

      return response.tx.hash;
    } catch (err) {
      error = err as Error;
    }
    // eslint-disable-next-line @typescript-eslint/no-loop-func
    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  throw error!;
}
