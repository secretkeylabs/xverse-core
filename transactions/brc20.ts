import * as btc from '@scure/btc-signer';
import { CancelToken } from 'axios';
import BigNumber from 'bignumber.js';
import xverseInscribeApi from '../api/xverseInscribe';
import { Transport } from '../ledger';
import { Account, UTXO } from '../types';
import { isValidTick } from '../utils';
import { CoreError } from '../utils/coreError';
import { ActionType, EnhancedTransaction, TransactionContext } from './bitcoin';
import { estimateVSize } from './bitcoin/utils/transactionVsizeEstimator';
import { TransportWebUSB } from '@keystonehq/hw-transport-webusb';

// This is the value of the inscription output, which the final recipient of the inscription will receive.
const FINAL_SATS_VALUE = 1000;

export type SignOptions = {
  ledgerTransport?: Transport | undefined;
  keystoneTransport?: TransportWebUSB | undefined;
  selectedAccount?: Account;
};

export enum BRC20ErrorCode {
  INSUFFICIENT_FUNDS = 'INSUFFICIENT_FUNDS',
  FAILED_TO_FINALIZE = 'FAILED_TO_FINALIZE',
  UTXOS_MISSING = 'UTXOS_MISSING',
  INVALID_TICK = 'INVALID_TICK',
  INVALID_AMOUNT = 'INVALID_AMOUNT',
  INVALID_FEE_RATE = 'INVALID_FEE_RATE',
  SERVER_ERROR = 'SERVER_ERROR',
  USER_REJECTED = 'USER_REJECTED',
  DEVICE_LOCKED = 'DEVICE_LOCKED',
  GENERAL_LEDGER_ERROR = 'GENERAL_LEDGER_ERROR',
  GENERAL_KEYSTONE_ERROR = 'GENERAL_KEYSTONE_ERROR',
}

type EstimateProps = {
  tick: string;
  amount: number;
  revealAddress: string;
  feeRate: number;
  cancelToken?: CancelToken;
};

type BaseEstimateResult = {
  commitValue: number;
  valueBreakdown: {
    commitChainFee: number;
    revealChainFee: number;
    revealServiceFee: number;
  };
};

type TransferEstimateResult = BaseEstimateResult & {
  valueBreakdown: {
    transferChainFee: number;
    transferUtxoValue: number;
  };
};

type ExecuteProps = {
  tick: string;
  amount: number;
  revealAddress: string;
  feeRate: number;
};

const validateProps = (props: EstimateProps): props is EstimateProps & { addressUtxos: UTXO[] } => {
  const { tick, amount, feeRate } = props;

  if (!isValidTick(tick)) {
    throw new CoreError('Invalid tick; should be 4 or 5 bytes long', BRC20ErrorCode.INVALID_TICK);
  }

  if (amount <= 0) {
    throw new CoreError('Amount should be positive', BRC20ErrorCode.INVALID_AMOUNT);
  }

  if (feeRate <= 0) {
    throw new CoreError('Fee rate should be positive', BRC20ErrorCode.INVALID_FEE_RATE);
  }

  return true;
};

export const brc20TransferEstimateFees = async (
  estimateProps: EstimateProps,
  context: TransactionContext,
): Promise<TransferEstimateResult> => {
  validateProps(estimateProps);

  const { tick, amount, revealAddress, feeRate, cancelToken } = estimateProps;

  const dummyAddress =
    context.network === 'Mainnet'
      ? 'bc1pgkwmp9u9nel8c36a2t7jwkpq0hmlhmm8gm00kpdxdy864ew2l6zqw2l6vh'
      : 'tb1pelzrpv4y7y0z7pqt6p7qz42fc3zjkyatyg5hx803efx2ydqhdlkq3m6rmg';

  const finalRecipientUtxoValue = new BigNumber(FINAL_SATS_VALUE);

  const tx = new btc.Transaction();
  const dummyUtxo = await context.ordinalsAddress.constructUtxo({
    status: {
      confirmed: false,
    },
    txid: '0000000000000000000000000000000000000000000000000000000000000001',
    vout: 0,
    value: FINAL_SATS_VALUE,
  });
  context.ordinalsAddress.addInput(tx, dummyUtxo);
  tx.addOutputAddress(dummyAddress, BigInt(FINAL_SATS_VALUE));

  const transferFeeEstimate = estimateVSize(tx) * feeRate;

  const inscriptionValue = finalRecipientUtxoValue.plus(transferFeeEstimate);

  const { chainFee: revealChainFee, serviceFee: revealServiceFee } = await xverseInscribeApi.getBrc20TransferFees(
    tick,
    amount,
    revealAddress,
    feeRate,
    context.network,
    inscriptionValue.toNumber(),
    cancelToken,
  );

  const commitValue = inscriptionValue.plus(revealChainFee).plus(revealServiceFee);

  const fundTransaction = new EnhancedTransaction(
    context,
    [
      {
        type: ActionType.SEND_BTC,
        toAddress: dummyAddress,
        amount: BigInt(commitValue.toString()),
        combinable: true,
      },
    ],
    feeRate,
  );

  try {
    const fundSummary = await fundTransaction.getSummary();

    const commitChainFees = fundSummary.fee;

    return {
      commitValue: commitValue.plus(commitChainFees.toString()).toNumber(),
      valueBreakdown: {
        commitChainFee: Number(commitChainFees),
        revealChainFee,
        revealServiceFee,
        transferChainFee: transferFeeEstimate,
        transferUtxoValue: finalRecipientUtxoValue.toNumber(),
      },
    };
  } catch (e) {
    if (e instanceof Error && e.message.includes('Insufficient funds')) {
      throw new CoreError('Not enough funds at selected fee rate', BRC20ErrorCode.INSUFFICIENT_FUNDS);
    }
    throw e;
  }
};

export enum ExecuteTransferProgressCodes {
  CreatingInscriptionOrder = 'CreatingInscriptionOrder',
  CreatingCommitTransaction = 'CreatingCommitTransaction',
  ExecutingInscriptionOrder = 'ExecutingInscriptionOrder',
  CreatingTransferTransaction = 'CreatingTransferTransaction',
  Finalizing = 'Finalizing',
}

export async function* brc20TransferExecute(
  executeProps: ExecuteProps & { recipientAddress: string },
  context: TransactionContext,
  options: SignOptions,
): AsyncGenerator<
  ExecuteTransferProgressCodes,
  {
    revealTransactionId: string;
    commitTransactionId: string;
    transferTransactionId: string;
  },
  never
> {
  validateProps(executeProps);
  const { tick, amount, revealAddress, feeRate, recipientAddress } = executeProps;

  yield ExecuteTransferProgressCodes.CreatingInscriptionOrder;

  const finalRecipientUtxoValue = new BigNumber(FINAL_SATS_VALUE);

  const tx = new btc.Transaction();
  const dummyUtxo = await context.ordinalsAddress.constructUtxo({
    status: {
      confirmed: false,
    },
    txid: '0000000000000000000000000000000000000000000000000000000000000001',
    vout: 0,
    value: FINAL_SATS_VALUE,
  });
  context.ordinalsAddress.addInput(tx, dummyUtxo);
  tx.addOutputAddress(recipientAddress, BigInt(finalRecipientUtxoValue.toString()));

  const transferFeeEstimate = estimateVSize(tx) * feeRate;

  const inscriptionValue = finalRecipientUtxoValue.plus(transferFeeEstimate);

  const { commitAddress, commitValue } = await xverseInscribeApi.createBrc20TransferOrder(
    tick,
    amount,
    revealAddress,
    feeRate,
    context.network,
    inscriptionValue.toNumber(),
  );

  yield ExecuteTransferProgressCodes.CreatingCommitTransaction;

  const fundTransaction = new EnhancedTransaction(
    context,
    [
      {
        type: ActionType.SEND_BTC,
        toAddress: commitAddress,
        amount: BigInt(commitValue.toString()),
        combinable: true,
      },
    ],
    feeRate,
  );

  let commitHex: string;

  try {
    const commitTransaction = await fundTransaction.getTransactionHexAndId(options);
    commitHex = commitTransaction.hex;
  } catch (e) {
    if (e instanceof Error && e.message.includes('Insufficient funds')) {
      throw new CoreError('Not enough funds at selected fee rate', BRC20ErrorCode.INSUFFICIENT_FUNDS);
    }
    if (options.ledgerTransport && e instanceof Error && e.message.includes('denied by the user')) {
      throw new CoreError('User rejected transaction', BRC20ErrorCode.USER_REJECTED);
    }
    if (options.keystoneTransport && e instanceof Error && e.message.includes('UR parsing rejected')) {
      throw new CoreError('User rejected transaction', BRC20ErrorCode.USER_REJECTED);
    }
    if (e instanceof Error && e.name === 'LockedDeviceError') {
      throw new CoreError('Ledger device locked', BRC20ErrorCode.DEVICE_LOCKED);
    }
    if (e instanceof Error && e.name === 'TransportStatusError') {
      throw new CoreError('Ledger error', BRC20ErrorCode.GENERAL_LEDGER_ERROR);
    }
    if (e instanceof Error && e.name === 'TransportError') {
      throw new CoreError('Keystone error', BRC20ErrorCode.GENERAL_KEYSTONE_ERROR);
    }
    throw e;
  }

  yield ExecuteTransferProgressCodes.ExecutingInscriptionOrder;

  const { revealTransactionId, revealUTXOVOut, revealUTXOValue } = await xverseInscribeApi.executeBrc20Order(
    context.network,
    commitAddress,
    commitHex,
    true,
  );

  yield ExecuteTransferProgressCodes.CreatingTransferTransaction;

  const transferUtxo = await context.ordinalsAddress.constructUtxo({
    value: revealUTXOValue,
    txid: revealTransactionId,
    vout: revealUTXOVOut,
    status: {
      confirmed: false,
    },
  });

  const transferTransaction = new btc.Transaction();
  await context.ordinalsAddress.addInput(transferTransaction, transferUtxo, { rbfEnabled: true });
  context.addOutputAddress(transferTransaction, recipientAddress, BigInt(finalRecipientUtxoValue.toString()));

  try {
    await context.signTransaction(transferTransaction, options);
  } catch (e) {
    if (options.ledgerTransport && e instanceof Error && e.message.includes('denied by the user')) {
      throw new CoreError('User rejected transaction', BRC20ErrorCode.USER_REJECTED);
    }
    if (options.keystoneTransport && e instanceof Error && e.message.includes('UR parsing rejected')) {
      throw new CoreError('User rejected transaction', BRC20ErrorCode.USER_REJECTED);
    }
    throw e;
  }

  transferTransaction.finalize();

  yield ExecuteTransferProgressCodes.Finalizing;

  try {
    const response = await xverseInscribeApi.finalizeBrc20TransferOrder(
      context.network,
      commitAddress,
      transferTransaction.hex,
    );

    return response;
  } catch (error) {
    throw new CoreError('Failed to finalize order', BRC20ErrorCode.FAILED_TO_FINALIZE, error);
  }
}
