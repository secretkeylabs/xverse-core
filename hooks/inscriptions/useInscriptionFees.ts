import { useEffect, useState } from 'react';

import { TransactionContext } from '../../transactions/bitcoin';
import { InscriptionErrorCode, inscriptionMintFeeEstimate } from '../../transactions/inscriptionMint';
import { CoreError } from '../../utils/coreError';

type CommitValueBreakdown = {
  commitChainFee: number;
  revealChainFee: number;
  revealServiceFee: number;
  externalServiceFee?: number;
  inscriptionValue: number;
  totalInscriptionValue: number;
};

type Props = {
  context: TransactionContext;
  content: string;
  contentType: string;
  feeRate: number;
  revealAddress: string;
  finalInscriptionValue?: number;
  serviceFee?: number;
  serviceFeeAddress?: string;
  repetitions?: number;
};

const useInscriptionFees = (props: Props) => {
  const {
    context,
    content,
    contentType,
    feeRate,
    revealAddress,
    finalInscriptionValue,
    serviceFee,
    serviceFeeAddress,
    repetitions,
  } = props;

  const [commitValue, setCommitValue] = useState<number | undefined>();
  const [commitValueBreakdown, setCommitValueBreakdown] = useState<CommitValueBreakdown | undefined>();
  const [isLoading, setIsLoading] = useState(false);
  const [errorCode, setErrorCode] = useState<InscriptionErrorCode | undefined>();
  const [errorMessage, setErrorMessage] = useState<string | undefined>();

  useEffect(() => {
    setIsLoading(true);
    setErrorCode(undefined);
    setErrorMessage(undefined);

    const runEstimate = async () => {
      try {
        const result = await inscriptionMintFeeEstimate(
          {
            content,
            contentType,
            revealAddress,
            feeRate,
            finalInscriptionValue,
            serviceFee,
            serviceFeeAddress,
            repetitions,
          },
          context,
        );
        setCommitValue(result.commitValue);
        setCommitValueBreakdown(result.valueBreakdown);
      } catch (e) {
        if (CoreError.isCoreError(e) && (e.code ?? '') in InscriptionErrorCode) {
          setErrorCode(e.code as InscriptionErrorCode);
        } else {
          setErrorCode(InscriptionErrorCode.SERVER_ERROR);
        }

        setErrorMessage(e.message);
      }

      setIsLoading(false);
    };

    runEstimate();
  }, [context, content, contentType, serviceFee, serviceFeeAddress, finalInscriptionValue, revealAddress, feeRate]);

  return {
    commitValue,
    commitValueBreakdown,
    isLoading,
    errorCode,
    errorMessage,
  };
};

export default useInscriptionFees;
