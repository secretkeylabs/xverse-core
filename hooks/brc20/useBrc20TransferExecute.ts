import { useEffect, useState } from 'react';

import { NetworkType, UTXO } from 'types';
import { ExecuteTransferProgressCodes, brc20TransferExecute } from '../../transactions/brc20';

export enum ErrorCode {
  INSUFFICIENT_FUNDS = 'INSUFFICIENT_FUNDS',
  INVALID_TICK = 'INVALID_TICK',
  INVALID_AMOUNT = 'INVALID_AMOUNT',
  INVALID_FEE_RATE = 'INVALID_FEE_RATE',
  TRANSFER_BROADCAST_FAILED = 'TRANSFER_BROADCAST_FAILED',
  SERVER_ERROR = 'SERVER_ERROR',
}

const useBrc20TransferExecute = (
  seedPhrase: string,
  accountIndex: number,
  addressUtxos: UTXO[],
  tick: string,
  amount: number,
  revealAddress: string,
  changeAddress: string,
  recipientAddress: string,
  feeRate: number,
  network: NetworkType,
) => {
  const [executed, setExecuted] = useState(false);
  const [running, setRunning] = useState(false);
  const [complete, setComplete] = useState(false);
  const [transferTransactionId, setTransferTransactionId] = useState<string | undefined>();
  const [progress, setProgress] = useState<ExecuteTransferProgressCodes | undefined>();
  const [errorCode, setErrorCode] = useState<ErrorCode | undefined>();

  const executeTransfer = () => {
    setExecuted(true);
  };

  useEffect(() => {
    if (!executed) return;
    if (running) return;

    if (!addressUtxos.length) {
      setErrorCode(ErrorCode.INSUFFICIENT_FUNDS);
      setExecuted(false);
      return;
    }

    if (tick.length !== 4) {
      setErrorCode(ErrorCode.INVALID_TICK);
      setExecuted(false);
      return;
    }

    if (amount <= 0) {
      setErrorCode(ErrorCode.INVALID_AMOUNT);
      setExecuted(false);
      return;
    }

    if (feeRate <= 0) {
      setErrorCode(ErrorCode.INVALID_FEE_RATE);
      setExecuted(false);
      return;
    }

    // if we get to here, that means that the transfer is valid and we can try to execute it but we don't want to
    // be able to accidentally execute it again if something goes wrong, so we set the running flag
    setRunning(true);
    setErrorCode(undefined);

    const runTransfer = async () => {
      try {
        const transferGenerator = await brc20TransferExecute(
          seedPhrase,
          accountIndex,
          addressUtxos,
          tick,
          amount,
          revealAddress,
          changeAddress,
          recipientAddress,
          feeRate,
          network,
        );

        let done = false;
        do {
          const itt = await transferGenerator.next();
          done = itt.done ?? false;

          if (done) {
            setTransferTransactionId(itt.value as string);
            setProgress(undefined);
          } else {
            setProgress(itt.value as ExecuteTransferProgressCodes);
          }
        } while (!done);
        setComplete(true);
      } catch (e) {
        if (e.message === 'Failed to broadcast transfer transaction') {
          setErrorCode(ErrorCode.TRANSFER_BROADCAST_FAILED);
        } else if (e.message === 'Not enough funds at selected fee rate') {
          setErrorCode(ErrorCode.INSUFFICIENT_FUNDS);
        } else {
          setErrorCode(ErrorCode.SERVER_ERROR);
        }
      }
    };

    runTransfer();
  }, [executed, running]);

  return { executeTransfer, transferTransactionId, complete, progress, error: errorCode };
};

export default useBrc20TransferExecute;
