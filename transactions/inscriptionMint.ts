import BigNumber from 'bignumber.js';

import { getOrdinalIdsFromUtxo } from '../api/ordinals';
import xverseInscribeApi from '../api/xverseInscribe';
import { NetworkType, UTXO } from '../types';
import { CoreError } from '../utils/coreError';
import { getBtcPrivateKey } from '../wallet';
import { generateSignedBtcTransaction, selectUtxosForSend } from './btc';

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
}

type EstimateProps = {
  addressUtxos: UTXO[];
  content: string;
  contentType: string;
  revealAddress: string;
  feeRate: number;
  finalInscriptionValue?: number;
  serviceFee?: number;
  serviceFeeAddress?: string;
  network: NetworkType;
  repetitions?: number;
};

type BaseEstimateResult = {
  commitValue: number;
  valueBreakdown: {
    commitChainFee: number;
    revealChainFee: number;
    revealServiceFee: number;
    externalServiceFee?: number;
  };
};

type EstimateResult = BaseEstimateResult & {
  valueBreakdown: {
    inscriptionValue: number;
  };
};

type ExecuteProps = {
  getSeedPhrase: () => Promise<string>;
  accountIndex: number;
  changeAddress: string;
  network: NetworkType;
  addressUtxos: UTXO[];
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

export async function inscriptionMintFeeEstimate(estimateProps: EstimateProps): Promise<EstimateResult> {
  const {
    addressUtxos,
    content,
    contentType,
    revealAddress,
    feeRate,
    finalInscriptionValue,
    serviceFee,
    serviceFeeAddress,
    network,
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
    network === 'Mainnet'
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
  } = await xverseInscribeApi.getInscriptionFeeEstimate(network, {
    contentLength: content.length,
    contentType,
    revealAddress,
    feeRate,
    inscriptionValue,
    repetitions,
  });

  const commitValue = new BigNumber(totalInscriptionValue).plus(revealChainFee).plus(revealServiceFee);

  const recipients = [{ address: revealAddress, amountSats: new BigNumber(commitValue) }];

  if (serviceFee && serviceFeeAddress) {
    recipients.push({
      address: serviceFeeAddress,
      amountSats: new BigNumber(serviceFee),
    });
  }

  const bestUtxoData = selectUtxosForSend({
    changeAddress: dummyAddress,
    recipients,
    availableUtxos: addressUtxos,
    feeRate,
    network,
  });

  if (!bestUtxoData) {
    throw new CoreError('Not enough funds at selected fee rate', InscriptionErrorCode.INSUFFICIENT_FUNDS);
  }

  const commitChainFees = bestUtxoData.fee;

  return {
    commitValue: commitValue
      .plus(commitChainFees)
      .plus(serviceFee ?? 0)
      .toNumber(),
    valueBreakdown: {
      commitChainFee: commitChainFees,
      revealChainFee,
      revealServiceFee,
      inscriptionValue,
      externalServiceFee: serviceFee,
    },
  };
}

export async function inscriptionMintExecute(executeProps: ExecuteProps): Promise<string> {
  const {
    getSeedPhrase,
    accountIndex,
    addressUtxos,
    changeAddress,
    contentString,
    contentBase64,
    contentType,
    revealAddress,
    feeRate,
    network,
    serviceFee,
    serviceFeeAddress,
    finalInscriptionValue,
    repetitions,
  } = executeProps;

  if (!addressUtxos.length) {
    throw new CoreError('No available UTXOs', InscriptionErrorCode.INSUFFICIENT_FUNDS);
  }

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

  const inscriptionValue = finalInscriptionValue ?? MINIMUM_INSCRIPTION_VALUE;

  const privateKey = await getBtcPrivateKey({
    seedPhrase: await getSeedPhrase(),
    index: BigInt(accountIndex),
    network,
  });

  const contentField = contentBase64 ? { contentBase64 } : { contentString: contentString as string };

  const { commitAddress, commitValue } = await xverseInscribeApi.createInscriptionOrder(network, {
    ...contentField,
    contentType,
    feeRate,
    revealAddress,
    inscriptionValue,
    repetitions,
    appServiceFee: serviceFee,
    appServiceFeeAddress: serviceFeeAddress,
  });

  const recipients = [{ address: commitAddress, amountSats: new BigNumber(commitValue) }];

  if (serviceFee && serviceFeeAddress) {
    recipients.push({
      address: serviceFeeAddress,
      amountSats: new BigNumber(serviceFee),
    });
  }

  const bestUtxoData = selectUtxosForSend({
    changeAddress,
    recipients,
    availableUtxos: addressUtxos,
    feeRate,
    network,
    useUnconfirmed: false,
  });

  if (!bestUtxoData) {
    throw new CoreError('Not enough funds at selected fee rate', InscriptionErrorCode.INSUFFICIENT_FUNDS);
  }

  const selectedOrdinalUtxos = [];
  const selectedNonOrdinalUtxos = [];

  for (const utxo of bestUtxoData.selectedUtxos) {
    const ordinalIds = await getOrdinalIdsFromUtxo(network, utxo);
    if (ordinalIds.length > 0) {
      selectedOrdinalUtxos.push(utxo);
    } else {
      selectedNonOrdinalUtxos.push(utxo);
    }
  }

  if (selectedNonOrdinalUtxos.length === 0) {
    throw new CoreError(
      'Must have at least one non-inscribed UTXO for inscription',
      InscriptionErrorCode.NO_NON_ORDINAL_UTXOS,
    );
  }

  const commitChainFees = bestUtxoData.fee;
  const satsToSend = new BigNumber(commitValue).plus(serviceFee ?? 0);

  const commitTransaction = await generateSignedBtcTransaction(
    privateKey,
    [...selectedNonOrdinalUtxos, ...selectedOrdinalUtxos],
    satsToSend,
    recipients,
    changeAddress,
    new BigNumber(commitChainFees),
    network,
  );

  const { revealTransactionId } = await xverseInscribeApi.executeInscriptionOrder(network, {
    commitAddress,
    commitTransactionHex: commitTransaction.hex,
  });

  return revealTransactionId;
}
