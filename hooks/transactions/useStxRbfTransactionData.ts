import { useQuery } from '@tanstack/react-query';
import { fetchStxRbfData, StxRbfArgs } from './helpers';

const useStxRbfTransactionData = ({ transaction, stacksNetwork, appInfo, stxAvailableBalance }: StxRbfArgs) => {
  const fetchRbfData = async () => {
    if (!transaction) {
      return;
    }

    const stxRbfData = await fetchStxRbfData({ transaction, stacksNetwork, appInfo, stxAvailableBalance });
    return stxRbfData;
  };

  return useQuery({
    queryKey: ['stx-rbf-transaction-data', transaction?.txid],
    queryFn: fetchRbfData,
    enabled: !!transaction,
  });
};

export default useStxRbfTransactionData;
