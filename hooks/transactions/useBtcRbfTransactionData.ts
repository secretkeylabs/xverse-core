import { useQuery } from '@tanstack/react-query';
import { rbf } from '../../transactions';
import { Account, BtcTransactionData, SettingsNetwork } from '../../types';
import { BitcoinEsploraApiProvider, mempoolApi } from '../../api';
import { RbfData, sortFees } from '../useRbfTransactionData/helpers';

type Props = {
  account: Account | null;
  transaction?: BtcTransactionData;
  btcNetwork: SettingsNetwork;
  esploraProvider: BitcoinEsploraApiProvider;
  isLedgerAccount: boolean;
};

export const useBtcRbfTransactionData = ({
  account,
  transaction,
  btcNetwork,
  esploraProvider,
  isLedgerAccount,
}: Props) => {
  const fetchRbfData = async (): Promise<RbfData | undefined> => {
    if (!account || !transaction) {
      return;
    }

    const rbfTx = new rbf.RbfTransaction(transaction, {
      ...account,
      accountType: account.accountType || 'software',
      accountId: isLedgerAccount && account.deviceAccountIndex ? account.deviceAccountIndex : account.id,
      network: btcNetwork.type,
      esploraProvider,
    });

    const mempoolFees = await mempoolApi.getRecommendedFees(btcNetwork.type);
    const rbfRecommendedFees = await rbfTx.getRbfRecommendedFees(mempoolFees);
    const rbfTransactionSummary = await rbf.getRbfTransactionSummary(esploraProvider, transaction.txid);

    return {
      rbfTransaction: rbfTx,
      rbfTxSummary: rbfTransactionSummary,
      rbfRecommendedFees: sortFees(rbfRecommendedFees),
      mempoolFees,
    };
  };

  return useQuery({
    queryKey: ['btc-rbf-transaction-data', transaction?.txid],
    queryFn: fetchRbfData,
    enabled: !!transaction && !!account,
  });
};
