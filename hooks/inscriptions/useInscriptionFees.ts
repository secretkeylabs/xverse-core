import { useEffect, useState } from 'react';

import { InscriptionErrorCode, inscriptionMintFeeEstimate } from '../../transactions/inscriptionMint';
import { NetworkType, UTXO } from '../../types';
import { CoreError } from '../../utils/coreError';

type CommitValueBreakdown = {
  commitChainFee: number;
  revealChainFee: number;
  revealServiceFee: number;
  externalServiceFee?: number;
};

type Props = {
  addressUtxos: UTXO[] | undefined;
  content: string;
  contentType: string;
  feeRate: number;
  revealAddress: string;
  finalInscriptionValue?: number;
  serviceFee?: number;
  serviceFeeAddress?: string;
  network: NetworkType;
  repetitions?: number;
};

const DUMMY_UTXO = {
  address: '',
  txid: '1234567890123456789012345678901234567890123456789012345678901234',
  vout: 0,
  status: { confirmed: true },
  value: 100e8,
};

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
    network,
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
        const result = await inscriptionMintFeeEstimate({
          addressUtxos: addressUtxos || [DUMMY_UTXO],
          content,
          contentType,
          revealAddress,
          feeRate,
          finalInscriptionValue,
          serviceFee,
          serviceFeeAddress,
          network,
          repetitions,
        });
        setCommitValue(result.commitValue);
        setCommitValueBreakdown(result.valueBreakdown);
      } catch (e) {
        if (CoreError.isCoreError(e) && (e.code ?? '') in InscriptionErrorCode) {
          setErrorCode(e.code as InscriptionErrorCode);

          // if there are not enough funds, we get the fee again with a fictitious UTXO to show what the fee would be
          if (e.code === InscriptionErrorCode.INSUFFICIENT_FUNDS) {
            const result = await inscriptionMintFeeEstimate({
              addressUtxos: [DUMMY_UTXO],
              content,
              contentType,
              revealAddress,
              feeRate,
              finalInscriptionValue,
              serviceFee,
              serviceFeeAddress,
              network,
              repetitions,
            });
            setCommitValue(result.commitValue);
            setCommitValueBreakdown(result.valueBreakdown);
          }
        } else {
          setErrorCode(InscriptionErrorCode.SERVER_ERROR);
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
    errorCode,
    errorMessage,
  };
};

export default useInscriptionFees;
