import { useEffect, useState } from 'react';

import { UTXO } from 'types';
import { brc20TransferEstimateFees } from '../../transactions/brc20';

type CommitValueBreakdown = {
  commitChainFee: number;
  revealChainFee: number;
  revealServiceFee: number;
  transferChainFee: number;
  transferUtxoValue: number;
};

export enum ErrorCode {
  INSUFFICIENT_FUNDS = 'INSUFFICIENT_FUNDS',
  INVALID_TICK = 'INVALID_TICK',
  INVALID_AMOUNT = 'INVALID_AMOUNT',
  INVALID_FEE_RATE = 'INVALID_FEE_RATE',
  SERVER_ERROR = 'SERVER_ERROR',
}

/**
 * Estimates the fees for a BRC-20 1-step transfer
 * @param addressUtxos - The UTXOs in the bitcoin address which will be used for payment
 * @param tick - The 4 letter BRC-20 token name
 * @param amount - The amount of the BRC-20 token to transfer
 * @param feeRate - The desired fee rate for the transactions
 * @param revealAddress - The address where the balance of the BRC-20 token lives. This is usually the ordinals address.
 */
const useBrc20TransferFees = (
  addressUtxos: UTXO[],
  tick: string,
  amount: number,
  feeRate: number,
  revealAddress: string,
) => {
  const [commitValue, setCommitValue] = useState<number | undefined>();
  const [commitValueBreakdown, setCommitValueBreakdown] = useState<CommitValueBreakdown | undefined>();
  const [isLoading, setIsLoading] = useState(false);
  const [errorCode, setErrorCode] = useState<ErrorCode | undefined>();

  useEffect(() => {
    if (!addressUtxos.length) {
      setErrorCode(ErrorCode.INSUFFICIENT_FUNDS);
      return;
    }

    if (tick.length !== 4) {
      setErrorCode(ErrorCode.INVALID_TICK);
      return;
    }

    if (amount <= 0) {
      setErrorCode(ErrorCode.INVALID_AMOUNT);
      return;
    }

    if (feeRate <= 0) {
      setErrorCode(ErrorCode.INVALID_FEE_RATE);
      return;
    }

    setIsLoading(true);
    setErrorCode(undefined);

    const runEstimate = async () => {
      try {
        const result = await brc20TransferEstimateFees(addressUtxos, tick, amount, revealAddress, feeRate);
        setCommitValue(result.commitValue);
        setCommitValueBreakdown(result.valueBreakdown);
      } catch (e) {
        if (e.message === 'Not enough funds at selected fee rate') {
          setErrorCode(ErrorCode.INSUFFICIENT_FUNDS);
        } else {
          setErrorCode(ErrorCode.SERVER_ERROR);
        }
      }

      setIsLoading(false);
    };

    runEstimate();
  }, [addressUtxos, tick, amount, revealAddress, feeRate]);

  return { commitValue, commitValueBreakdown, isLoading, errorCode };
};

export default useBrc20TransferFees;
