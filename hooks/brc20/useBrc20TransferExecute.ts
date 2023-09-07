import { useCallback, useState } from 'react';

import { NetworkType, UTXO } from 'types';
import { CoreError } from '../../utils/coreError';

import { BRC20ErrorCode, ExecuteTransferProgressCodes, brc20TransferExecute } from '../../transactions/brc20';

export enum ErrorCode {
  INSUFFICIENT_FUNDS = 'INSUFFICIENT_FUNDS',
  INVALID_TICK = 'INVALID_TICK',
  INVALID_AMOUNT = 'INVALID_AMOUNT',
  INVALID_FEE_RATE = 'INVALID_FEE_RATE',
  BROADCAST_FAILED = 'BROADCAST_FAILED',
  SERVER_ERROR = 'SERVER_ERROR',
}

type Props = {
  seedPhrase: string;
  accountIndex: number;
  addressUtxos: UTXO[];
  tick: string;
  amount: number;
  revealAddress: string;
  changeAddress: string;
  recipientAddress: string;
  feeRate: number;
  network: NetworkType;
};

const validateProps = (props: Props) => {
  const { addressUtxos, tick, amount, feeRate } = props;

  if (!addressUtxos.length) {
    return ErrorCode.INSUFFICIENT_FUNDS;
  }

  if (tick.length !== 4) {
    return ErrorCode.INVALID_TICK;
  }

  if (amount <= 0) {
    return ErrorCode.INVALID_AMOUNT;
  }

  if (feeRate <= 0) {
    return ErrorCode.INVALID_FEE_RATE;
  }
  return undefined;
};

/**
 *
 * @param seedPhrase - The seed phrase of the wallet
 * @param accountIndex - The account index of the seed phrase to use
 * @param addressUtxos - The UTXOs in the bitcoin address which will be used for payment
 * @param tick - The 4 letter BRC-20 token name
 * @param amount - The amount of the BRC-20 token to transfer
 * @param revealAddress - The address where the balance of the BRC-20 token lives. This is usually the ordinals address.
 * @param changeAddress - The address where change SATS will be sent to. Should be the Bitcoin address of the wallet.
 * @param recipientAddress - The address where the BRC-20 tokens will be sent to.
 * @param feeRate - The desired fee rate for the transactions
 * @param network - The network to broadcast the transactions on (Mainnet or Testnet)
 * @returns
 */
const useBrc20TransferExecute = (props: Props) => {
  const {
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
  } = props;
  const [running, setRunning] = useState(false);
  const [commitTransactionId, setCommitTransactionId] = useState<string | undefined>();
  const [revealTransactionId, setRevealTransactionId] = useState<string | undefined>();
  const [transferTransactionId, setTransferTransactionId] = useState<string | undefined>();
  const [progress, setProgress] = useState<ExecuteTransferProgressCodes | undefined>();
  const [errorCode, setErrorCode] = useState<ErrorCode | undefined>();

  const executeTransfer = useCallback(() => {
    if (running || !!transferTransactionId) return;

    const innerProps = {
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
        const transferGenerator = await brc20TransferExecute(innerProps);

        let done = false;
        do {
          const itt = await transferGenerator.next();
          done = itt.done ?? false;

          if (done) {
            const result = itt.value as {
              revealTransactionId: string;
              commitTransactionId: string;
              transferTransactionId: string;
            };
            setCommitTransactionId(result.commitTransactionId);
            setRevealTransactionId(result.revealTransactionId);
            setTransferTransactionId(result.transferTransactionId);
            setProgress(undefined);
          } else {
            setProgress(itt.value as ExecuteTransferProgressCodes);
          }
        } while (!done);
      } catch (e) {
        let finalErrorCode: string | undefined;
        if (CoreError.isCoreError(e)) {
          finalErrorCode = e.code;
        }

        switch (finalErrorCode) {
          case BRC20ErrorCode.FAILED_TO_FINALIZE:
            setErrorCode(ErrorCode.BROADCAST_FAILED);
            break;
          case BRC20ErrorCode.INSUFFICIENT_FUNDS:
            setErrorCode(ErrorCode.INSUFFICIENT_FUNDS);
            break;
          default:
            setErrorCode(ErrorCode.SERVER_ERROR);
            break;
        }
      }
    };

    runTransfer();
  }, [
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
    running,
    transferTransactionId,
  ]);

  return {
    executeTransfer,
    transferTransactionId,
    commitTransactionId,
    revealTransactionId,
    complete: !!transferTransactionId,
    progress,
    errorCode,
  };
};

export default useBrc20TransferExecute;
