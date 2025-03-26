import BigNumber from 'bignumber.js';

import xverseInscribeApi from '../api/xverseInscribe';
import { CoreError } from '../utils/coreError';
import { ActionType, EnhancedTransaction, ExtendedUtxo, TransactionContext } from './bitcoin';
import { Action } from './bitcoin/types';
import { SignOptions } from './brc20';

const MINIMUM_INSCRIPTION_VALUE = 546;
const MAX_CONTENT_LENGTH = 400e3; // 400kb is the max that miners will mine

export enum InscriptionErrorCode {
  INSUFFICIENT_FUNDS = 'INSUFFICIENT_FUNDS',
  INVALID_FEE_RATE = 'INVALID_FEE_RATE',
  INVALID_SERVICE_FEE_CONFIG = 'INVALID_SERVICE_FEE_CONFIG',
  INVALID_CONTENT = 'INVALID_CONTENT',
  CONTENT_TOO_BIG = 'CONTENT_TOO_BIG',
  INSCRIPTION_VALUE_TOO_LOW = 'INSCRIPTION_VALUE_TOO_LOW',
  NO_NON_ORDINAL_UTXOS = 'NO_NON_ORDINAL_UTXOS',
  FAILED_TO_FINALIZE = 'FAILED_TO_FINALIZE',
  SERVER_ERROR = 'SERVER_ERROR',
  USER_REJECTED = 'USER_REJECTED',
  DEVICE_LOCKED = 'DEVICE_LOCKED',
  GENERAL_HARDWARE_WALLET_ERROR = 'GENERAL_HARDWARE_WALLET_ERROR',
}

type EstimateProps = {
  content: string;
  contentType: string;
  revealAddress: string;
  feeRate: number;
  finalInscriptionValue?: number;
  serviceFee?: number;
  serviceFeeAddress?: string;
  repetitions?: number;
};

type EstimateResult = {
  commitValue: number;
  valueBreakdown: {
    commitChainFee: number;
    revealChainFee: number;
    revealServiceFee: number;
    externalServiceFee?: number;
    inscriptionValue: number;
    totalInscriptionValue: number;
  };
};

type ExecuteProps = {
  contentString?: string;
  contentBase64?: string;
  contentType: string;
  revealAddress: string;
  feeRate: number;
  finalInscriptionValue?: number;
  serviceFee?: number;
  serviceFeeAddress?: string;
  repetitions?: number;
};

export async function inscriptionMintFeeEstimate(
  estimateProps: EstimateProps,
  context: TransactionContext,
): Promise<EstimateResult> {
  const {
    content,
    contentType,
    revealAddress,
    feeRate,
    finalInscriptionValue,
    serviceFee,
    serviceFeeAddress,
    repetitions,
  } = estimateProps;

  // a service fee of below 546 will result in a dust UTXO
  if (((serviceFee || serviceFeeAddress) && !(serviceFee && serviceFeeAddress)) || (serviceFee && serviceFee < 546)) {
    throw new CoreError(
      'Invalid service fee config, both serviceFee and serviceFeeAddress must be specified',
      InscriptionErrorCode.INVALID_SERVICE_FEE_CONFIG,
    );
  }

  if (feeRate <= 0) {
    throw new CoreError('Fee rate should be a positive number', InscriptionErrorCode.INVALID_FEE_RATE);
  }

  if (content.length > MAX_CONTENT_LENGTH) {
    throw new CoreError(
      `Content exceeds maximum size of ${MAX_CONTENT_LENGTH} bytes`,
      InscriptionErrorCode.CONTENT_TOO_BIG,
    );
  }

  const dummyAddress =
    context.network === 'Mainnet'
      ? 'bc1pgkwmp9u9nel8c36a2t7jwkpq0hmlhmm8gm00kpdxdy864ew2l6zqw2l6vh'
      : 'tb1pelzrpv4y7y0z7pqt6p7qz42fc3zjkyatyg5hx803efx2ydqhdlkq3m6rmg';

  const inscriptionValue = finalInscriptionValue ?? MINIMUM_INSCRIPTION_VALUE;

  if (inscriptionValue < MINIMUM_INSCRIPTION_VALUE) {
    throw new CoreError(
      `Inscription value cannot be less than ${MINIMUM_INSCRIPTION_VALUE}`,
      InscriptionErrorCode.INSCRIPTION_VALUE_TOO_LOW,
    );
  }

  const {
    chainFee: revealChainFee,
    serviceFee: revealServiceFee,
    totalInscriptionValue,
  } = await xverseInscribeApi.getInscriptionFeeEstimate(context.network, {
    contentLength: content.length,
    contentType,
    revealAddress,
    feeRate,
    inscriptionValue,
    repetitions,
  });

  const commitValue = new BigNumber(totalInscriptionValue).plus(revealChainFee).plus(revealServiceFee);

  const actions: Action[] = [
    {
      type: ActionType.SEND_BTC,
      toAddress: dummyAddress,
      amount: BigInt(commitValue.toString()),
      combinable: true,
    },
  ];

  if (serviceFee && serviceFeeAddress) {
    actions.push({
      type: ActionType.SEND_BTC,
      toAddress: serviceFeeAddress,
      amount: BigInt(serviceFee.toString()),
      combinable: true,
    });
  }

  const fundTransaction = new EnhancedTransaction(context, actions, feeRate);

  try {
    const fundSummary = await fundTransaction.getSummary();

    const commitChainFees = fundSummary.fee;

    return {
      commitValue: commitValue
        .plus(serviceFee ?? 0)
        .plus(commitChainFees.toString())
        .toNumber(),
      valueBreakdown: {
        commitChainFee: Number(commitChainFees),
        revealChainFee,
        revealServiceFee,
        inscriptionValue,
        totalInscriptionValue,
        externalServiceFee: serviceFee,
      },
    };
  } catch (e) {
    if (e instanceof Error && e.message.includes('Insufficient funds')) {
      throw new CoreError('Not enough funds at selected fee rate', InscriptionErrorCode.INSUFFICIENT_FUNDS);
    }
    throw e;
  }
}

export async function inscriptionMintExecute(
  executeProps: ExecuteProps,
  context: TransactionContext,
  options?: SignOptions,
): Promise<string> {
  const {
    contentString,
    contentBase64,
    contentType,
    revealAddress,
    feeRate,
    serviceFee,
    serviceFeeAddress,
    finalInscriptionValue,
    repetitions,
  } = executeProps;

  if (feeRate <= 0) {
    throw new CoreError('Fee rate should be a positive number', InscriptionErrorCode.INVALID_FEE_RATE);
  }

  if (((serviceFee || serviceFeeAddress) && !(serviceFee && serviceFeeAddress)) || (serviceFee && serviceFee < 546)) {
    throw new CoreError(
      'Invalid service fee config, both serviceFee and serviceFeeAddress must be specified',
      InscriptionErrorCode.INVALID_SERVICE_FEE_CONFIG,
    );
  }

  const content = contentString ?? contentBase64;

  if (!content || (contentString && contentBase64) || content.length === 0) {
    throw new CoreError(
      'Only contentString or contentBase64 can be specified, not both or neither, and should have content',
      InscriptionErrorCode.INVALID_CONTENT,
    );
  }

  if (content.length > MAX_CONTENT_LENGTH) {
    throw new CoreError(
      `Content exceeds maximum size of ${MAX_CONTENT_LENGTH} bytes`,
      InscriptionErrorCode.CONTENT_TOO_BIG,
    );
  }

  const paymentUtxos = await context.paymentAddress.getUtxos();
  paymentUtxos.sort((a, b) => b.utxo.value - a.utxo.value);

  if (paymentUtxos.length === 0) {
    throw new CoreError('No available UTXOs', InscriptionErrorCode.INSUFFICIENT_FUNDS);
  }

  let nonInscribedUtxo: ExtendedUtxo | undefined;

  for (const utxo of paymentUtxos) {
    const bundleData = await utxo.getBundleData();

    if (
      bundleData?.block_height &&
      (bundleData.sat_ranges.length === 0 ||
        bundleData.sat_ranges.every((rng) => rng.offset !== 0 || rng.inscriptions.length === 0))
    ) {
      nonInscribedUtxo = utxo;
      break;
    }
  }

  if (!nonInscribedUtxo) {
    throw new CoreError(
      'Must have at least one non-inscribed UTXO for inscription',
      InscriptionErrorCode.NO_NON_ORDINAL_UTXOS,
    );
  }

  const inscriptionValue = finalInscriptionValue ?? MINIMUM_INSCRIPTION_VALUE;

  const contentField = contentBase64 ? { contentBase64 } : { contentString: contentString as string };

  const { commitAddress, commitValue } = await xverseInscribeApi.createInscriptionOrder(context.network, {
    ...contentField,
    contentType,
    feeRate,
    revealAddress,
    inscriptionValue,
    repetitions,
    appServiceFee: serviceFee,
    appServiceFeeAddress: serviceFeeAddress,
  });

  const actions: Action[] = [
    {
      type: ActionType.SEND_BTC,
      toAddress: commitAddress,
      amount: BigInt(commitValue),
      combinable: true,
    },
  ];

  if (serviceFee && serviceFeeAddress) {
    actions.push({
      type: ActionType.SEND_BTC,
      toAddress: serviceFeeAddress,
      amount: BigInt(serviceFee),
      combinable: true,
    });
  }

  const fundTransaction = new EnhancedTransaction(context, actions, feeRate, {
    forceIncludeOutpointList: [nonInscribedUtxo.outpoint],
  });

  let commitHex: string;

  try {
    const commitTransaction = await fundTransaction.getTransactionHexAndId(options);
    commitHex = commitTransaction.hex;
  } catch (e) {
    if (e instanceof Error && e.message.includes('Insufficient funds')) {
      throw new CoreError('Not enough funds at selected fee rate', InscriptionErrorCode.INSUFFICIENT_FUNDS);
    }
    if (options?.ledgerTransport && e instanceof Error && e.message.includes('denied by the user')) {
      throw new CoreError('User rejected transaction', InscriptionErrorCode.USER_REJECTED);
    }
    if (e instanceof Error && e.name === 'LockedDeviceError') {
      throw new CoreError('Ledger device locked', InscriptionErrorCode.DEVICE_LOCKED);
    }
    if (e instanceof Error && e.name === 'TransportStatusError') {
      throw new CoreError('Hardware wallet error', InscriptionErrorCode.GENERAL_HARDWARE_WALLET_ERROR);
    }
    if (e instanceof Error && e.name === 'TransportError') {
      throw new CoreError('Keystone error', InscriptionErrorCode.GENERAL_HARDWARE_WALLET_ERROR);
    }
    throw e;
  }

  const { revealTransactionId } = await xverseInscribeApi.executeInscriptionOrder(context.network, {
    commitAddress,
    commitTransactionHex: commitHex,
  });

  return revealTransactionId;
}
