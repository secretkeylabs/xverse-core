import { useEffect, useState } from 'react';

import { UTXO } from 'types';
import { BRC20ErrorCode, brc20TransferEstimateFees } from '../../transactions/brc20';
import { CoreError } from '../../utils/coreError';

const DUMMY_UTXO = {
  address: '',
  txid: '1234567890123456789012345678901234567890123456789012345678901234',
  vout: 0,
  status: { confirmed: true },
  value: 100e8,
};

type CommitValueBreakdown = {
  commitChainFee: number;
  revealChainFee: number;
  revealServiceFee: number;
  transferChainFee: number;
  transferUtxoValue: number;
};

type Props = {
  addressUtxos: UTXO[] | undefined;
  tick: string;
  amount: number;
  feeRate: number;
  revealAddress: string;
};

/**
 * Estimates the fees for a BRC-20 1-step transfer
 * @param addressUtxos - The UTXOs in the bitcoin address which will be used for payment
 * @param tick - The 4 letter BRC-20 token name
 * @param amount - The amount of the BRC-20 token to transfer
 * @param feeRate - The desired fee rate for the transactions
 * @param revealAddress - The address where the balance of the BRC-20 token lives. This is usually the ordinals address.
 */
const useBrc20TransferFees = (props: Props) => {
  const { addressUtxos = [], tick, amount, feeRate, revealAddress } = props;
  const [commitValue, setCommitValue] = useState<number | undefined>();
  const [commitValueBreakdown, setCommitValueBreakdown] = useState<CommitValueBreakdown | undefined>();
  const [isLoading, setIsLoading] = useState(false);
  const [errorCode, setErrorCode] = useState<BRC20ErrorCode | undefined>();

  useEffect(() => {
    setIsLoading(true);
    setErrorCode(undefined);

    const runEstimate = async () => {
      try {
        const result = await brc20TransferEstimateFees({
          addressUtxos,
          tick,
          amount,
          revealAddress,
          feeRate,
        });
        setCommitValue(result.commitValue);
        setCommitValueBreakdown(result.valueBreakdown);
      } catch (e) {
        if (CoreError.isCoreError(e) && (e.code ?? '') in BRC20ErrorCode) {
          setErrorCode(e.code as BRC20ErrorCode);

          // if there are not enough funds, we get the fee again with a fictitious UTXO to show what the fee would be
          if (e.code === BRC20ErrorCode.INSUFFICIENT_FUNDS) {
            const result = await brc20TransferEstimateFees({
              addressUtxos: [DUMMY_UTXO],
              tick,
              amount,
              revealAddress,
              feeRate,
            });
            setCommitValue(result.commitValue);
            setCommitValueBreakdown(result.valueBreakdown);
          }
        } else {
          setErrorCode(BRC20ErrorCode.SERVER_ERROR);
        }
      }

      setIsLoading(false);
    };

    runEstimate();
  }, [addressUtxos, tick, amount, revealAddress, feeRate]);

  return {
    commitValue,
    commitValueBreakdown,
    isLoading,
    errorCode,
  };
};

export default useBrc20TransferFees;
