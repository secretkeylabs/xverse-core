import axios, { CancelToken } from 'axios';
import { useEffect, useState } from 'react';

import { BRC20ErrorCode, brc20TransferEstimateFees } from '../../transactions/brc20';
import { NetworkType, UTXO } from '../../types';
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
  /** The UTXOs in the bitcoin address which will be used for payment. */
  addressUtxos: UTXO[] | undefined;

  /** The 4 letter BRC-20 token name. */
  tick: string;

  /** The amount of the BRC-20 token to transfer. */
  amount: number;

  /** The desired fee rate for the transactions. */
  feeRate: number;

  /** The address where the balance of the BRC-20 token lives. This is usually the ordinals address. */
  revealAddress: string;

  /** If true, the initial fetch will be skipped. */
  skipInitialFetch?: boolean;

  network: NetworkType;
};

const useBrc20TransferFees = (props: Props) => {
  const { addressUtxos = [], tick, amount, feeRate, revealAddress, network, skipInitialFetch = false } = props;
  const [commitValue, setCommitValue] = useState<number | undefined>();
  const [commitValueBreakdown, setCommitValueBreakdown] = useState<CommitValueBreakdown | undefined>();
  const [isLoading, setIsLoading] = useState(false);
  const [errorCode, setErrorCode] = useState<BRC20ErrorCode | undefined>();

  const [isInitialised, setIsInitialised] = useState(false);

  useEffect(() => {
    setIsLoading(true);
    setErrorCode(undefined);

    const feeCancelToken = axios.CancelToken.source();
    const feeEstimateCancelToken = axios.CancelToken.source();

    const runEstimate = async () => {
      const callEstimate = async (addressUtxosToUse: UTXO[], cancelToken: CancelToken) => {
        try {
          const result = await brc20TransferEstimateFees({
            addressUtxos: addressUtxosToUse,
            tick,
            amount,
            revealAddress,
            feeRate,
            cancelToken,
            network,
          });
          setCommitValue(result.commitValue);
          setCommitValueBreakdown(result.valueBreakdown);
        } catch (e) {
          if (axios.isCancel(e)) {
            // The request was cancelled due to the use effect being cleaned up
            // This could be due to the user changing the inputs before the request has finished or
            // navigating off the page. Either way, we don't want to show an error in this case and we don't want to
            // fire the state change methods.
            return 'cancelled';
          }

          if (CoreError.isCoreError(e) && (e.code ?? '') in BRC20ErrorCode) {
            setErrorCode(e.code as BRC20ErrorCode);
            return e.code as BRC20ErrorCode;
          } else {
            setErrorCode(BRC20ErrorCode.SERVER_ERROR);
          }
        }
      };

      // we first try to estimate using the actual UTXOs
      let ephemeralErrorCode = await callEstimate(addressUtxos, feeCancelToken.token);

      // if there are not enough funds, we get the fee again with a fictitious UTXO to show what the fee would be
      if (ephemeralErrorCode === BRC20ErrorCode.INSUFFICIENT_FUNDS) {
        ephemeralErrorCode = await callEstimate([DUMMY_UTXO], feeEstimateCancelToken.token);
      }

      if (ephemeralErrorCode === 'cancelled') {
        return;
      }

      setIsLoading(false);
    };

    if (!skipInitialFetch || isInitialised) {
      runEstimate();
    }

    setIsInitialised(true);

    return () => {
      feeCancelToken.cancel('Fee estimate out of scope, cleaning up');
      feeEstimateCancelToken.cancel('Fee estimate out of scope, cleaning up');
    };
  }, [addressUtxos, tick, amount, revealAddress, feeRate]);

  return {
    commitValue,
    commitValueBreakdown,
    isLoading,
    errorCode,
  };
};

export default useBrc20TransferFees;
