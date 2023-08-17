import { useCallback, useState } from 'react';

import { NetworkType, UTXO } from 'types';
import { CoreError } from '../../utils/coreError';

import { InscriptionErrorCode, mintExecute } from '../../transactions/inscriptionMint';

export enum ErrorCode {
  CONTENT_TOO_BIG = 'CONTENT_TOO_BIG',
  INSUFFICIENT_FUNDS = 'INSUFFICIENT_FUNDS',
  INVALID_FEE_RATE = 'INVALID_FEE_RATE',
  INSCRIPTION_VALUE_TOO_LOW = 'INSCRIPTION_VALUE_TOO_LOW',
  INVALID_SERVICE_FEE_CONFIG = 'INVALID_SERVICE_FEE_CONFIG',
  INVALID_CONTENT = 'INVALID_CONTENT',
  SERVER_ERROR = 'SERVER_ERROR',
}

type Props = {
  seedPhrase: string;
  accountIndex: number;
  addressUtxos: UTXO[];
  revealAddress: string;
  changeAddress: string;
  contentString?: string;
  contentBase64?: string;
  contentType: string;
  feeRate: number;
  network: NetworkType;
};

const validateProps = (props: Props) => {
  const { addressUtxos, feeRate } = props;

  if (!addressUtxos.length) {
    return ErrorCode.INSUFFICIENT_FUNDS;
  }

  if (feeRate <= 0) {
    return ErrorCode.INVALID_FEE_RATE;
  }
  return undefined;
};

const useInscriptionExecute = (props: Props) => {
  const {
    seedPhrase,
    accountIndex,
    addressUtxos,
    contentType,
    contentBase64,
    contentString,
    revealAddress,
    changeAddress,
    feeRate,
    network,
  } = props;
  const [running, setRunning] = useState(false);
  const [revealTransactionId, setRevealTransactionId] = useState<string | undefined>();
  const [errorCode, setErrorCode] = useState<ErrorCode | undefined>();
  const [errorMessage, setErrorMessage] = useState<string | undefined>();

  const executeMint = useCallback(() => {
    if (running || !!revealTransactionId) return;

    const innerProps = {
      seedPhrase,
      accountIndex,
      addressUtxos,
      revealAddress,
      changeAddress,
      contentType,
      contentBase64,
      contentString,
      feeRate,
      network,
    };

    const validationErrorCode = validateProps(innerProps);
    setErrorCode(validationErrorCode);

    if (validationErrorCode) {
      return;
    }

    // if we get to here, that means that the transfer is valid and we can try to execute it but we don't want to
    // be able to accidentally execute it again if something goes wrong, so we set the running flag
    setRunning(true);

    const runTransfer = async () => {
      try {
        const mintResult = await mintExecute(innerProps);

        setRevealTransactionId(mintResult);
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
      } finally {
        setRunning(false);
      }
    };

    runTransfer();
  }, [
    seedPhrase,
    accountIndex,
    addressUtxos,
    contentType,
    contentBase64,
    contentString,
    revealAddress,
    changeAddress,
    feeRate,
    network,
    running,
    revealTransactionId,
  ]);

  return {
    executeMint,
    revealTransactionId,
    complete: !!revealTransactionId,
    errorCode,
    errorMessage,
  };
};

export default useInscriptionExecute;
