import { useQuery } from '@tanstack/react-query';
import { getAccountAddressDetails } from '../../account';
import { BitcoinEsploraApiProvider, mempoolApi } from '../../api';
import { rbf } from '../../transactions';
import { Account, BtcPaymentType, BtcTransactionData, SettingsNetwork } from '../../types';
import { RbfData, sortFees } from './helpers';

type Props = {
  account: Account | null;
  transaction?: BtcTransactionData;
  btcNetwork: SettingsNetwork;
  esploraProvider: BitcoinEsploraApiProvider;
  isLedgerAccount: boolean;
  btcPaymentAddressType: BtcPaymentType;
};

const useBtcRbfTransactionData = ({
  account,
  transaction,
  btcNetwork,
  esploraProvider,
  isLedgerAccount,
  btcPaymentAddressType,
}: Props) => {
  const fetchRbfData = async (): Promise<RbfData | undefined> => {
    if (!account || !transaction) {
      return;
    }

    const accountAddresses = getAccountAddressDetails(account, btcPaymentAddressType);

    const rbfTx = new rbf.RbfTransaction(transaction, {
      ...accountAddresses,
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

export default useBtcRbfTransactionData;
