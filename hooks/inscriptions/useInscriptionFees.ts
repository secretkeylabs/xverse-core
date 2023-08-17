import { useEffect, useState } from 'react';

import { UTXO } from 'types';
import { InscriptionErrorCode, mintFeeEstimate } from '../../transactions/inscriptionMint';
import { CoreError } from '../../utils/coreError';

type CommitValueBreakdown = {
  commitChainFee: number;
  revealChainFee: number;
  revealServiceFee: number;
  externalServiceFee?: number;
};

export enum ErrorCode {
  UTXOS_MISSING = 'UTXOS_MISSING',
  CONTENT_TOO_BIG = 'CONTENT_TOO_BIG',
  INSUFFICIENT_FUNDS = 'INSUFFICIENT_FUNDS',
  INVALID_FEE_RATE = 'INVALID_FEE_RATE',
  INSCRIPTION_VALUE_TOO_LOW = 'INSCRIPTION_VALUE_TOO_LOW',
  INVALID_SERVICE_FEE_CONFIG = 'INVALID_SERVICE_FEE_CONFIG',
  INVALID_CONTENT = 'INVALID_CONTENT',
  SERVER_ERROR = 'SERVER_ERROR',
}

type Props = {
  addressUtxos: UTXO[] | undefined;
  content: string;
  contentType: string;
  feeRate: number;
  revealAddress: string;
  finalInscriptionValue?: number;
  serviceFee?: number;
  serviceFeeAddress?: string;
};

const validateProps = (props: Props) => {
  const { addressUtxos, feeRate } = props;

  if (!addressUtxos) {
    return ErrorCode.UTXOS_MISSING;
  }

  if (!addressUtxos.length) {
    return ErrorCode.INSUFFICIENT_FUNDS;
  }

  if (feeRate <= 0) {
    return ErrorCode.INVALID_FEE_RATE;
  }

  return null;
};

/**
 * Estimates the fees for a BRC-20 1-step transfer
 * @param addressUtxos - The UTXOs in the bitcoin address which will be used for payment
 * @param content - The content of the inscription
 * @param contentType - The contentType of the inscription
 * @param feeRate - The desired fee rate for the transactions
 * @param revealAddress - The address where the balance of the BRC-20 token lives. This is usually the ordinals address.
 */
const useInscriptionFees = (props: Props) => {
  const {
    addressUtxos,
    content,
    contentType,
    feeRate,
    revealAddress,
    finalInscriptionValue,
    serviceFee,
    serviceFeeAddress,
  } = props;

  const [commitValue, setCommitValue] = useState<number | undefined>();
  const [commitValueBreakdown, setCommitValueBreakdown] = useState<CommitValueBreakdown | undefined>();
  const [isInitialised, setIsInitialised] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorCode, setErrorCode] = useState<ErrorCode | undefined>();
  const [errorMessage, setErrorMessage] = useState<string | undefined>();

  useEffect(() => {
    const validationErrorCode = validateProps(props);

    if (validationErrorCode) {
      setErrorCode(validationErrorCode);

      if (validationErrorCode !== ErrorCode.UTXOS_MISSING) {
        setIsInitialised(true);
      }

      return;
    }

    setIsInitialised(true);
    setIsLoading(true);
    setErrorCode(undefined);

    const runEstimate = async () => {
      try {
        const result = await mintFeeEstimate({
          addressUtxos: addressUtxos!,
          content,
          contentType,
          revealAddress,
          feeRate,
          finalInscriptionValue,
          serviceFee,
          serviceFeeAddress,
        });
        setCommitValue(result.commitValue);
        setCommitValueBreakdown(result.valueBreakdown);
      } catch (e) {
        let finalErrorCode: string | undefined;
        if (CoreError.isCoreError(e)) {
          finalErrorCode = e.code;
        }

        switch (finalErrorCode) {
          case InscriptionErrorCode.CONTENT_TOO_BIG:
            setErrorCode(ErrorCode.CONTENT_TOO_BIG);
            break;
          case InscriptionErrorCode.INSUFFICIENT_FUNDS:
            setErrorCode(ErrorCode.INSUFFICIENT_FUNDS);
            break;
          case InscriptionErrorCode.INSCRIPTION_VALUE_TOO_LOW:
            setErrorCode(ErrorCode.INSCRIPTION_VALUE_TOO_LOW);
            break;
          case InscriptionErrorCode.INVALID_CONTENT:
            setErrorCode(ErrorCode.INVALID_CONTENT);
            break;
          case InscriptionErrorCode.INVALID_SERVICE_FEE_CONFIG:
            setErrorCode(ErrorCode.INVALID_SERVICE_FEE_CONFIG);
            break;
          default:
            setErrorCode(ErrorCode.SERVER_ERROR);
            break;
        }

        setErrorMessage(e.message);
      }

      setIsLoading(false);
    };

    runEstimate();
  }, [
    addressUtxos,
    content,
    contentType,
    serviceFee,
    serviceFeeAddress,
    finalInscriptionValue,
    revealAddress,
    feeRate,
  ]);

  return {
    commitValue,
    commitValueBreakdown,
    isLoading,
    errorCode: isInitialised ? errorCode : undefined,
    errorMessage: isInitialised ? errorMessage : undefined,
    isInitialised,
  };
};

export default useInscriptionFees;
