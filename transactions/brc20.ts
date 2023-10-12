import { base64 } from '@scure/base';
import { CancelToken } from 'axios';
import BigNumber from 'bignumber.js';

import { createInscriptionRequest } from '../api';
import BitcoinEsploraApiProvider from '../api/esplora/esploraAPiProvider';
import xverseInscribeApi from '../api/xverseInscribe';
import { NetworkType, UTXO } from '../types';
import { CoreError } from '../utils/coreError';
import { getBtcPrivateKey } from '../wallet';
import { generateSignedBtcTransaction, selectUtxosForSend, signNonOrdinalBtcSendTransaction } from './btc';

// This is the value of the inscription output, which the final recipient of the inscription will receive.
const FINAL_SATS_VALUE = 1000;

export enum BRC20ErrorCode {
  INSUFFICIENT_FUNDS = 'INSUFFICIENT_FUNDS',
  FAILED_TO_FINALIZE = 'FAILED_TO_FINALIZE',
  UTXOS_MISSING = 'UTXOS_MISSING',
  INVALID_TICK = 'INVALID_TICK',
  INVALID_AMOUNT = 'INVALID_AMOUNT',
  INVALID_FEE_RATE = 'INVALID_FEE_RATE',
  SERVER_ERROR = 'SERVER_ERROR',
}

type EstimateProps = {
  addressUtxos?: UTXO[];
  tick: string;
  amount: number;
  revealAddress: string;
  feeRate: number;
  cancelToken?: CancelToken;
  network: NetworkType;
};

type BaseEstimateResult = {
  commitValue: number;
  valueBreakdown: {
    commitChainFee: number;
    revealChainFee: number;
    revealServiceFee: number;
  };
};

type EstimateResult = BaseEstimateResult & {
  valueBreakdown: {
    inscriptionValue: number;
  };
};

type TransferEstimateResult = BaseEstimateResult & {
  valueBreakdown: {
    transferChainFee: number;
    transferUtxoValue: number;
  };
};

type ExecuteProps = {
  seedPhrase: string;
  accountIndex: number;
  addressUtxos: UTXO[];
  tick: string;
  amount: number;
  revealAddress: string;
  changeAddress: string;
  feeRate: number;
  network: NetworkType;
};

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

const validateProps = (props: EstimateProps): props is EstimateProps & { addressUtxos: UTXO[] } => {
  const { addressUtxos, tick, amount, feeRate } = props;

  if (!addressUtxos) {
    throw new CoreError('UTXOs empty', BRC20ErrorCode.UTXOS_MISSING);
  }

  if (!addressUtxos.length) {
    throw new CoreError('Insufficient funds, no UTXOs found', BRC20ErrorCode.INSUFFICIENT_FUNDS);
  }

  if (tick.length !== 4) {
    throw new CoreError('Invalid tick; should be 4 characters long', BRC20ErrorCode.INVALID_TICK);
  }

  if (amount <= 0) {
    throw new CoreError('Amount should be positive', BRC20ErrorCode.INVALID_AMOUNT);
  }

  if (feeRate <= 0) {
    throw new CoreError('Fee rate should be positive', BRC20ErrorCode.INVALID_FEE_RATE);
  }

  return true;
};

export const brc20MintEstimateFees = async (estimateProps: EstimateProps): Promise<EstimateResult> => {
  validateProps(estimateProps);

  const { addressUtxos, tick, amount, revealAddress, feeRate, cancelToken, network } = estimateProps;

  const dummyAddress =
    network === 'Mainnet'
      ? 'bc1pgkwmp9u9nel8c36a2t7jwkpq0hmlhmm8gm00kpdxdy864ew2l6zqw2l6vh'
      : 'tb1pelzrpv4y7y0z7pqt6p7qz42fc3zjkyatyg5hx803efx2ydqhdlkq3m6rmg';

  const { chainFee: revealChainFee, serviceFee: revealServiceFee } = await xverseInscribeApi.getBrc20MintFees(
    tick,
    amount,
    revealAddress,
    feeRate,
    network,
    FINAL_SATS_VALUE,
    cancelToken,
  );

  const commitValue = new BigNumber(FINAL_SATS_VALUE).plus(revealChainFee).plus(revealServiceFee);

  const bestUtxoData = selectUtxosForSend({
    changeAddress: dummyAddress,
    recipients: [{ address: revealAddress, amountSats: new BigNumber(commitValue) }],
    availableUtxos: addressUtxos!,
    feeRate,
    network,
  });

  if (!bestUtxoData) {
    throw new CoreError('Not enough funds at selected fee rate', BRC20ErrorCode.INSUFFICIENT_FUNDS);
  }

  const commitChainFees = bestUtxoData.fee;

  return {
    commitValue: commitValue.plus(commitChainFees).toNumber(),
    valueBreakdown: {
      commitChainFee: commitChainFees,
      revealChainFee,
      revealServiceFee,
      inscriptionValue: FINAL_SATS_VALUE,
    },
  };
};

export async function brc20MintExecute(executeProps: ExecuteProps): Promise<string> {
  validateProps(executeProps);
  const { seedPhrase, accountIndex, addressUtxos, tick, amount, revealAddress, changeAddress, feeRate, network } =
    executeProps;

  const privateKey = await getBtcPrivateKey({
    seedPhrase,
    index: BigInt(accountIndex),
    network,
  });

  const { commitAddress, commitValue } = await xverseInscribeApi.createBrc20MintOrder(
    tick,
    amount,
    revealAddress,
    feeRate,
    network,
    FINAL_SATS_VALUE,
  );

  const bestUtxoData = selectUtxosForSend({
    changeAddress,
    recipients: [{ address: commitAddress, amountSats: new BigNumber(commitValue) }],
    availableUtxos: addressUtxos,
    feeRate,
    network,
  });

  if (!bestUtxoData) {
    throw new CoreError('Not enough funds at selected fee rate', BRC20ErrorCode.INSUFFICIENT_FUNDS);
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

  const { revealTransactionId } = await xverseInscribeApi.executeBrc20Order(
    network,
    commitAddress,
    commitTransaction.hex,
  );

  return revealTransactionId;
}

export const brc20TransferEstimateFees = async (estimateProps: EstimateProps): Promise<TransferEstimateResult> => {
  validateProps(estimateProps);

  const { addressUtxos, tick, amount, revealAddress, feeRate, cancelToken, network } = estimateProps;

  const dummyAddress =
    network === 'Mainnet'
      ? 'bc1pgkwmp9u9nel8c36a2t7jwkpq0hmlhmm8gm00kpdxdy864ew2l6zqw2l6vh'
      : 'tb1pelzrpv4y7y0z7pqt6p7qz42fc3zjkyatyg5hx803efx2ydqhdlkq3m6rmg';

  const finalRecipientUtxoValue = new BigNumber(FINAL_SATS_VALUE);
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
        value: FINAL_SATS_VALUE,
      },
    ],
    0,
    'action action action action action action action action action action action action',
    network,
    new BigNumber(1),
  );

  const transferFeeEstimate = tx.vsize * feeRate;

  const inscriptionValue = finalRecipientUtxoValue.plus(transferFeeEstimate);

  const { chainFee: revealChainFee, serviceFee: revealServiceFee } = await xverseInscribeApi.getBrc20TransferFees(
    tick,
    amount,
    revealAddress,
    feeRate,
    network,
    inscriptionValue.toNumber(),
    cancelToken,
  );

  const commitValue = inscriptionValue.plus(revealChainFee).plus(revealServiceFee);

  const bestUtxoData = selectUtxosForSend({
    changeAddress: dummyAddress,
    recipients: [{ address: revealAddress, amountSats: new BigNumber(commitValue) }],
    availableUtxos: addressUtxos!,
    feeRate,
    network,
  });

  if (!bestUtxoData) {
    throw new CoreError('Not enough funds at selected fee rate', BRC20ErrorCode.INSUFFICIENT_FUNDS);
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

export async function* brc20TransferExecute(executeProps: ExecuteProps & { recipientAddress: string }): AsyncGenerator<
  ExecuteTransferProgressCodes,
  {
    revealTransactionId: string;
    commitTransactionId: string;
    transferTransactionId: string;
  },
  never
> {
  validateProps(executeProps);
  const {
    seedPhrase,
    accountIndex,
    addressUtxos,
    tick,
    amount,
    revealAddress,
    changeAddress,
    feeRate,
    recipientAddress,
    network,
  } = executeProps;

  const privateKey = await getBtcPrivateKey({
    seedPhrase,
    index: BigInt(accountIndex),
    network,
  });

  yield ExecuteTransferProgressCodes.CreatingInscriptionOrder;

  const finalRecipientUtxoValue = new BigNumber(FINAL_SATS_VALUE);
  const { tx } = await signNonOrdinalBtcSendTransaction(
    recipientAddress,
    [
      {
        address: revealAddress,
        status: {
          confirmed: false,
        },
        txid: '0000000000000000000000000000000000000000000000000000000000000001',
        vout: 0,
        value: FINAL_SATS_VALUE,
      },
    ],
    accountIndex,
    seedPhrase,
    network,
    new BigNumber(1),
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

  const bestUtxoData = selectUtxosForSend({
    changeAddress,
    recipients: [{ address: commitAddress, amountSats: new BigNumber(commitValue) }],
    availableUtxos: addressUtxos,
    feeRate,
    network,
  });

  if (!bestUtxoData) {
    throw new CoreError('Not enough funds at selected fee rate', BRC20ErrorCode.INSUFFICIENT_FUNDS);
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
    network,
    commitAddress,
    commitTransaction.hex,
    true,
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
    network,
    new BigNumber(transferFeeEstimate),
  );

  yield ExecuteTransferProgressCodes.Finalizing;

  try {
    const response = await xverseInscribeApi.finalizeBrc20TransferOrder(
      network,
      commitAddress,
      transferTransaction.signedTx,
    );

    return response;
  } catch (error) {
    throw new CoreError('Failed to finalize order', BRC20ErrorCode.FAILED_TO_FINALIZE, error);
  }
}
