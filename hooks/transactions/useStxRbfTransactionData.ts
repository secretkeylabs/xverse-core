import { useQuery } from '@tanstack/react-query';
import { StxTransactionData, SettingsNetwork, StacksNetwork, AppInfo } from '../../types';
import { fetchStxRbfData } from '../useRbfTransactionData/helpers';

type Props = {
  transaction?: StxTransactionData;
  btcNetwork: SettingsNetwork;
  stacksNetwork: StacksNetwork;
  appInfo: AppInfo | null;
  stxAvailableBalance: string;
};

const useStxRbfTransactionData = ({ transaction, btcNetwork, stacksNetwork, appInfo, stxAvailableBalance }: Props) => {
  const fetchRbfData = async () => {
    if (!transaction) {
      return;
    }

    const stxRbfData = await fetchStxRbfData(transaction, btcNetwork, stacksNetwork, appInfo, stxAvailableBalance);
    return stxRbfData;
  };

  return useQuery({
    queryKey: ['stx-rbf-transaction-data', transaction?.txid],
    queryFn: fetchRbfData,
    enabled: !!transaction,
  });
};

export default useStxRbfTransactionData;
