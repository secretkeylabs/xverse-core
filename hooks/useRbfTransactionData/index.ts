import { useCallback, useEffect, useState } from 'react';
import { rbf } from '../../transactions';
import { Account, AppInfo, BtcTransactionData, SettingsNetwork, StacksNetwork, StxTransactionData } from '../../types';
import { RbfData, calculateStxData, isBtcTransaction, sortFees } from './helpers';
import { BitcoinEsploraApiProvider, mempoolApi } from '../../api';

const useRbfTransactionData = ({
  account,
  transaction,
  stacksNetwork,
  btcNetwork,
  esploraProvider,
  stxAvailableBalance,
  appInfo,
  isLedgerAccount,
}: {
  account: Account | null;
  transaction?: BtcTransactionData | StxTransactionData;
  stacksNetwork: StacksNetwork;
  btcNetwork: SettingsNetwork;
  esploraProvider: BitcoinEsploraApiProvider;
  stxAvailableBalance: string;
  appInfo: AppInfo | null;
  isLedgerAccount: boolean;
}): RbfData => {
  const [isLoading, setIsLoading] = useState(true);
  const [rbfData, setRbfData] = useState<RbfData>({});
  const [errorCode, setErrorCode] = useState<'SOMETHING_WENT_WRONG' | undefined>();

  const fetchStxData = useCallback(async () => {
    if (!transaction || isBtcTransaction(transaction)) {
      return;
    }
    try {
      setIsLoading(true);
      const calculatedData = await calculateStxData(
        transaction,
        btcNetwork,
        stacksNetwork,
        appInfo,
        stxAvailableBalance,
      );
      setRbfData(calculatedData);
    } catch (err: any) {
      setErrorCode('SOMETHING_WENT_WRONG');
    } finally {
      setIsLoading(false);
    }
  }, [transaction, btcNetwork, stacksNetwork, appInfo, stxAvailableBalance]);

  const fetchRbfData = useCallback(async () => {
    if (!account || !transaction) {
      return;
    }

    if (!isBtcTransaction(transaction)) {
      return fetchStxData();
    }

    try {
      setIsLoading(true);

      const rbfTx = new rbf.RbfTransaction(transaction, {
        ...account,
        accountType: account.accountType || 'software',
        accountId: isLedgerAccount && account.deviceAccountIndex ? account.deviceAccountIndex : account.id,
        network: btcNetwork.type,
        esploraProvider,
      });

      const mempoolFees = await mempoolApi.getRecommendedFees(btcNetwork.type);
      const rbfRecommendedFeesResponse = await rbfTx.getRbfRecommendedFees(mempoolFees);

      const rbfTransactionSummary = await rbf.getRbfTransactionSummary(esploraProvider, transaction.txid);

      setRbfData({
        rbfTransaction: rbfTx,
        rbfTxSummary: rbfTransactionSummary,
        rbfRecommendedFees: sortFees(rbfRecommendedFeesResponse),
        mempoolFees,
      });
    } catch (err: any) {
      setErrorCode('SOMETHING_WENT_WRONG');
    } finally {
      setIsLoading(false);
    }
  }, [account, transaction, btcNetwork.type]);

  useEffect(() => {
    fetchRbfData();
  }, [fetchRbfData]);

  return { ...rbfData, isLoading, errorCode };
};

export default useRbfTransactionData;
