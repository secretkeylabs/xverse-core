import { Account, BtcPaymentType, BtcTransactionData, EsploraTransaction } from '../types';
import EsploraApiProvider from './esplora/esploraAPiProvider';
import { parseBtcTransactionData, parseOrdinalsBtcTransactions } from './helper';

export async function fetchBtcOrdinalTransactions(ordinalsAddress: string, esploraProvider: EsploraApiProvider) {
  if (!ordinalsAddress) {
    return [];
  }

  const transactions: BtcTransactionData[] = [];
  const txResponse: EsploraTransaction[] = await esploraProvider.getAddressTransactions(ordinalsAddress);
  txResponse.forEach((tx) => {
    transactions.push(parseOrdinalsBtcTransactions(tx, ordinalsAddress));
  });
  return transactions.filter((tx) => tx.incoming);
}

export async function fetchBtcPaymentTransactions(
  btcAddress: string,
  ordinalsAddress: string,
  esploraProvider: EsploraApiProvider,
) {
  if (!btcAddress) {
    return [];
  }

  const transactions: BtcTransactionData[] = [];
  const txResponse: EsploraTransaction[] = await esploraProvider.getAddressTransactions(btcAddress);
  txResponse.forEach((tx) => {
    transactions.push(parseBtcTransactionData(tx, btcAddress, ordinalsAddress));
  });
  return transactions;
}

export async function fetchBtcTransactionsData(
  account: Account,
  esploraProvider: EsploraApiProvider,
  withOrdinals: boolean,
  /** If not provided, both nested and native transactions will be fetched */
  btcPaymentAddressType?: BtcPaymentType,
): Promise<BtcTransactionData[]> {
  const ordinalsAddress = account.btcAddresses?.taproot.address ?? '';
  const transactionPromises: Promise<BtcTransactionData[]>[] = [];

  if (btcPaymentAddressType === undefined || btcPaymentAddressType === 'nested') {
    transactionPromises.push(
      fetchBtcPaymentTransactions(account.btcAddresses.nested?.address ?? '', ordinalsAddress, esploraProvider),
    );
  }

  if (btcPaymentAddressType === undefined || btcPaymentAddressType === 'native') {
    transactionPromises.push(
      fetchBtcPaymentTransactions(account.btcAddresses.native?.address ?? '', ordinalsAddress, esploraProvider),
    );
  }

  if (withOrdinals) {
    transactionPromises.push(fetchBtcOrdinalTransactions(ordinalsAddress, esploraProvider));
  }

  const allTransactionResults = await Promise.all(transactionPromises);
  const allTransactions = allTransactionResults.flat();

  return allTransactions;
}

export async function fetchBtcTransaction(
  id: string,
  btcAddress: string,
  ordinalsAddress: string,
  esploraProvider: EsploraApiProvider,
  isOrdinal?: boolean,
) {
  const txResponse: EsploraTransaction = await esploraProvider.getTransaction(id);
  const transaction: BtcTransactionData = isOrdinal
    ? parseOrdinalsBtcTransactions(txResponse, ordinalsAddress)
    : parseBtcTransactionData(txResponse, btcAddress, ordinalsAddress);
  return transaction;
}
