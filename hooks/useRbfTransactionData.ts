import {
  BtcTransactionData,
  RecommendedFeeResponse,
  StacksNetwork,
  StacksTransaction,
  StxTransactionData,
  mempoolApi,
  microstacksToStx,
  rbf,
} from '../';
import { deserializeTransaction, estimateTransaction } from '@stacks/transactions';
import BigNumber from 'bignumber.js';
import { useCallback, useEffect, useState } from 'react';
import { RbfRecommendedFees, getRawTransaction } from '../transactions';
import EsploraApiProvider from '../api/esplora/esploraAPiProvider';
import { Account, AppInfo, SettingsNetwork } from '../types';

type RbfData = {
  rbfTransaction?: InstanceType<typeof rbf.RbfTransaction>;
  rbfTxSummary?: {
    currentFee: number;
    currentFeeRate: number;
    minimumRbfFee: number;
    minimumRbfFeeRate: number;
  };
  rbfRecommendedFees?: RbfRecommendedFees;
  mempoolFees?: RecommendedFeeResponse;
  isLoading?: boolean;
  errorCode?: 'SOMETHING_WENT_WRONG';
};

export const isBtcTransaction = (
  transaction: BtcTransactionData | StxTransactionData,
): transaction is BtcTransactionData => transaction?.txType === 'bitcoin';

const constructRecommendedFees = (
  lowerName: keyof RbfRecommendedFees,
  lowerFeeRate: number,
  higherName: keyof RbfRecommendedFees,
  higherFeeRate: number,
  stxAvailableBalance: string,
): RbfRecommendedFees => {
  const bigNumLowerFee = BigNumber(lowerFeeRate);
  const bigNumHigherFee = BigNumber(higherFeeRate);

  return {
    [lowerName]: {
      enoughFunds: bigNumLowerFee.lte(BigNumber(stxAvailableBalance)),
      feeRate: microstacksToStx(bigNumLowerFee).toNumber(),
      fee: microstacksToStx(bigNumLowerFee).toNumber(),
    },
    [higherName]: {
      enoughFunds: bigNumHigherFee.lte(BigNumber(stxAvailableBalance)),
      feeRate: microstacksToStx(bigNumHigherFee).toNumber(),
      fee: microstacksToStx(bigNumHigherFee).toNumber(),
    },
  };
};

const sortFees = (fees: RbfRecommendedFees) =>
  Object.fromEntries(
    Object.entries(fees).sort((a, b) => {
      const priorityOrder = ['highest', 'higher', 'high', 'medium'];
      return priorityOrder.indexOf(a[0]) - priorityOrder.indexOf(b[0]);
    }),
  );

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
  esploraProvider: EsploraApiProvider;
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

      const { fee } = transaction;
      const txRaw: string = await getRawTransaction(transaction.txid, btcNetwork);
      const unsignedTx: StacksTransaction = deserializeTransaction(txRaw);

      const [slow, medium, high] = await estimateTransaction(unsignedTx.payload, undefined, stacksNetwork);

      let feePresets: RbfRecommendedFees = {};
      let mediumFee = medium.fee;
      let highFee = high.fee;
      const higherFee = fee.multipliedBy(1.25).toNumber();
      const highestFee = fee.multipliedBy(1.5).toNumber();

      if (appInfo?.thresholdHighStacksFee) {
        if (high.fee > appInfo.thresholdHighStacksFee) {
          // adding a fee cap
          highFee = appInfo.thresholdHighStacksFee * 1.5;
          mediumFee = appInfo.thresholdHighStacksFee;
        }
      }

      let minimumFee = fee.multipliedBy(1.25).toNumber();
      if (!Number.isSafeInteger(minimumFee)) {
        // round up the fee to the nearest integer
        minimumFee = Math.ceil(minimumFee);
      }

      if (fee.lt(BigNumber(mediumFee))) {
        feePresets = constructRecommendedFees('medium', mediumFee, 'high', highFee, stxAvailableBalance);
      } else {
        feePresets = constructRecommendedFees('higher', higherFee, 'highest', highestFee, stxAvailableBalance);
      }

      setRbfData({
        rbfTransaction: undefined,
        rbfTxSummary: {
          currentFee: microstacksToStx(fee).toNumber(),
          currentFeeRate: microstacksToStx(fee).toNumber(),
          minimumRbfFee: microstacksToStx(BigNumber(minimumFee)).toNumber(),
          minimumRbfFeeRate: microstacksToStx(BigNumber(minimumFee)).toNumber(),
        },
        rbfRecommendedFees: sortFees(feePresets),
        mempoolFees: {
          fastestFee: microstacksToStx(BigNumber(high.fee)).toNumber(),
          halfHourFee: microstacksToStx(BigNumber(medium.fee)).toNumber(),
          hourFee: microstacksToStx(BigNumber(slow.fee)).toNumber(),
          economyFee: microstacksToStx(BigNumber(slow.fee)).toNumber(),
          minimumFee: microstacksToStx(BigNumber(slow.fee)).toNumber(),
        },
      });
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
