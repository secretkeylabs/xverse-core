import { useCallback, useState } from 'react';

import { NetworkType, UTXO } from 'types';
import { CoreError } from '../../utils/coreError';

import { InscriptionErrorCode, inscriptionMintExecute } from '../../transactions/inscriptionMint';

type Props = {
  seedPhrase: string;
  accountIndex: number;
  addressUtxos: UTXO[];
  revealAddress: string;
  changeAddress: string;
  contentString?: string;
  contentBase64?: string;
  contentType: string;
  feeRate: number;
  network: NetworkType;
};

const useInscriptionExecute = (props: Props) => {
  const {
    seedPhrase,
    accountIndex,
    addressUtxos,
    contentType,
    contentBase64,
    contentString,
    revealAddress,
    changeAddress,
    feeRate,
    network,
  } = props;
  const [running, setRunning] = useState(false);
  const [revealTransactionId, setRevealTransactionId] = useState<string | undefined>();
  const [errorCode, setErrorCode] = useState<InscriptionErrorCode | undefined>();
  const [errorMessage, setErrorMessage] = useState<string | undefined>();

  const executeMint = useCallback(() => {
    if (running || !!revealTransactionId) return;

    const innerProps = {
      seedPhrase,
      accountIndex,
      addressUtxos,
      revealAddress,
      changeAddress,
      contentType,
      contentBase64,
      contentString,
      feeRate,
      network,
    };

    // if we get to here, that means that the transfer is valid and we can try to execute it but we don't want to
    // be able to accidentally execute it again if something goes wrong, so we set the running flag
    setRunning(true);

    const runTransfer = async () => {
      try {
        const mintResult = await inscriptionMintExecute(innerProps);

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
  }, [
    seedPhrase,
    accountIndex,
    addressUtxos,
    contentType,
    contentBase64,
    contentString,
    revealAddress,
    changeAddress,
    feeRate,
    network,
    running,
    revealTransactionId,
  ]);

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
