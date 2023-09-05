import { useCallback, useState } from 'react';

import { NetworkType, UTXO } from 'types';
import { CoreError } from '../../utils/coreError';

import { BRC20ErrorCode, ExecuteTransferProgressCodes, brc20TransferExecute } from '../../transactions/brc20';

type Props = {
  /** The seed phrase of the wallet. */
  seedPhrase: string;

  /** The account index of the seed phrase to use. */
  accountIndex: number;

  /** The UTXOs in the bitcoin address which will be used for payment. */
  addressUtxos: UTXO[];

  /** The 4 letter BRC-20 token name. */
  tick: string;

  /** The amount of the BRC-20 token to transfer. */
  amount: number;

  /** The address where the balance of the BRC-20 token lives. This is usually the ordinals address. */
  revealAddress: string;

  /** The address where change SATS will be sent to. Should be the Bitcoin address of the wallet. */
  changeAddress: string;

  /** The address where the BRC-20 tokens will be sent to. */
  recipientAddress: string;

  /** The desired fee rate for the transactions. */
  feeRate: number;

  /** The network to broadcast the transactions on (Mainnet or Testnet). */
  network: NetworkType;
};

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
  const [errorCode, setErrorCode] = useState<BRC20ErrorCode | undefined>();

  const executeTransfer = useCallback(() => {
    if (running) return;

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

    // if we get to here, that means that the transfer is valid and we can try to execute it but we don't want to
    // be able to accidentally execute it again if something goes wrong, so we set the running flag
    setRunning(true);
    setErrorCode(undefined);
    setProgress(undefined);

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
        if (CoreError.isCoreError(e)) {
          setErrorCode(e.code as BRC20ErrorCode);
        } else {
          setErrorCode(BRC20ErrorCode.SERVER_ERROR);
        }
      } finally {
        setRunning(false);
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
