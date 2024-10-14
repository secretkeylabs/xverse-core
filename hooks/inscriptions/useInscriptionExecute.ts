import { useCallback, useState } from 'react';

import { CoreError } from '../../utils/coreError';

import { Transport } from '../../ledger';
import { TransactionContext } from '../../transactions/bitcoin';
import { InscriptionErrorCode, inscriptionMintExecute } from '../../transactions/inscriptionMint';
import { TransportWebUSB } from '@keystonehq/hw-transport-webusb';

type Props = {
  context: TransactionContext;
  revealAddress: string;
  contentString?: string;
  contentBase64?: string;
  contentType: string;
  feeRate: number;
  serviceFee?: number;
  serviceFeeAddress?: string;
  repetitions?: number;
};

const useInscriptionExecute = (props: Props) => {
  const {
    context,
    contentType,
    contentBase64,
    contentString,
    revealAddress,
    feeRate,
    serviceFee,
    serviceFeeAddress,
    repetitions,
  } = props;
  const [running, setRunning] = useState(false);
  const [revealTransactionId, setRevealTransactionId] = useState<string | undefined>();
  const [errorCode, setErrorCode] = useState<InscriptionErrorCode | undefined>();
  const [errorMessage, setErrorMessage] = useState<string | undefined>();

  const executeMint = useCallback(
    (executeOptions?: { ledgerTransport?: Transport; keystoneTransport?: TransportWebUSB }) => {
      if (running || !!revealTransactionId) return;

      const innerProps = {
        revealAddress,
        contentType,
        contentBase64,
        contentString,
        feeRate,
        serviceFee,
        serviceFeeAddress,
        repetitions,
      };

      // if we get to here, that means that the transfer is valid and we can try to execute it but we don't want to
      // be able to accidentally execute it again if something goes wrong, so we set the running flag
      setRunning(true);
      setErrorCode(undefined);
      setErrorMessage(undefined);

      const runTransfer = async () => {
        try {
          const mintResult = await inscriptionMintExecute(innerProps, context, {
            ledgerTransport: executeOptions?.ledgerTransport,
            keystoneTransport: executeOptions?.keystoneTransport,
          });

          setRevealTransactionId(mintResult);
        } catch (e) {
          if (CoreError.isCoreError(e) && (e.code ?? '') in InscriptionErrorCode) {
            setErrorCode(e.code as InscriptionErrorCode);
          } else {
            setErrorCode(InscriptionErrorCode.SERVER_ERROR);
          }

          setErrorMessage(e.message);
        } finally {
          setRunning(false);
        }
      };

      runTransfer();
    },
    [
      context,
      contentType,
      contentBase64,
      contentString,
      revealAddress,
      feeRate,
      running,
      revealTransactionId,
      serviceFee,
      serviceFeeAddress,
    ],
  );

  return {
    isExecuting: running,
    executeMint,
    revealTransactionId,
    complete: !!revealTransactionId,
    errorCode,
    errorMessage,
  };
};

export default useInscriptionExecute;
