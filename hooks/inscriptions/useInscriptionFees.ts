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
  const [errorCode, setErrorCode] = useState<InscriptionErrorCode | undefined>();
  const [errorMessage, setErrorMessage] = useState<string | undefined>();

  useEffect(() => {
    if (!addressUtxos) return;

    setIsInitialised(true);
    setIsLoading(true);
    setErrorCode(undefined);
    setErrorMessage(undefined);

    const runEstimate = async () => {
      try {
        const result = await mintFeeEstimate({
          addressUtxos,
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
        if (CoreError.isCoreError(e) && (e.code ?? '') in InscriptionErrorCode) {
          setErrorCode(e.code as InscriptionErrorCode);

          // if there are not enough funds, we get the fee again with a fictitious UTXO to show what the fee would be
          if (e.code === InscriptionErrorCode.INSUFFICIENT_FUNDS) {
            const result = await mintFeeEstimate({
              addressUtxos: [
                {
                  address: '',
                  txid: '1234567890123456789012345678901234567890123456789012345678901234',
                  vout: 0,
                  status: { confirmed: true },
                  value: 100e8,
                },
              ],
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
    errorCode: isInitialised ? errorCode : undefined,
    errorMessage: isInitialised ? errorMessage : undefined,
    isInitialised,
  };
};

export default useInscriptionFees;
