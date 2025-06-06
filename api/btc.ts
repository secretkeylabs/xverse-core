import { Account, AccountBtcAddresses, BtcTransactionData, EsploraTransaction, Rune } from '../types';
import EsploraApiProvider from './esplora/esploraAPiProvider';
import { parseBtcTransactionData, parseOrdinalsBtcTransactions } from './helper';

import { RunesApi } from '../api/runes/provider';
import {
  ApiAddressTransaction,
  AssetInTx,
  BtcTxHistory,
  BtcTxType,
  EnhancedRuneIO,
  EnhancedRunesOwnActivity,
  EnhancedTx,
  InscriptionEvent,
  InscriptionTxType,
  MultipleAssetsTxType,
  PartialInscriptionEvents,
  RuneInfo,
  RuneIO,
  RunesActivity,
  RunesAllEvent,
  RunesTxType,
} from '../types/api/xverse/history';
import { XverseApi } from './xverse';

export async function fetchBtcOrdinalMempoolTransactions(ordinalsAddress: string, esploraProvider: EsploraApiProvider) {
  if (!ordinalsAddress) {
    return [];
  }

  const transactions: BtcTransactionData[] = [];
  const txResponse: EsploraTransaction[] = await esploraProvider.getAddressMempoolTransactions(ordinalsAddress);
  txResponse.forEach((tx) => {
    transactions.push(parseOrdinalsBtcTransactions(tx, ordinalsAddress));
  });
  return transactions.filter((tx) => tx.incoming);
}

export async function fetchBtcPaymentMempoolTransactions(
  btcAddress: string,
  ordinalsAddress: string,
  esploraProvider: EsploraApiProvider,
) {
  if (!btcAddress) {
    return [];
  }

  const transactions: BtcTransactionData[] = [];
  const txResponse: EsploraTransaction[] = await esploraProvider.getAddressMempoolTransactions(btcAddress);
  txResponse.forEach((tx) => {
    transactions.push(parseBtcTransactionData(tx, btcAddress, ordinalsAddress));
  });
  return transactions;
}

export async function fetchBtcMempoolTransactions(addresses: AccountBtcAddresses, esploraProvider: EsploraApiProvider) {
  const ordinalsAddress = addresses?.taproot.address ?? '';
  const transactionPromises: Promise<BtcTransactionData[]>[] = [];

  if (addresses.nested?.address) {
    transactionPromises.push(
      fetchBtcPaymentMempoolTransactions(addresses.nested?.address ?? '', ordinalsAddress, esploraProvider),
    );
  }

  if (addresses.native?.address) {
    transactionPromises.push(
      fetchBtcPaymentMempoolTransactions(addresses.native?.address ?? '', ordinalsAddress, esploraProvider),
    );
  }

  transactionPromises.push(fetchBtcOrdinalMempoolTransactions(ordinalsAddress, esploraProvider));

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

// for this tx types we don't need to show the addresses in the tx
const excludeAddressTxTypes = ['etch', 'mint', 'consolidate', 'burn', 'mintBurn'];

const getAddressesInTx = (
  tx: ApiAddressTransaction,
  addresses: AccountBtcAddresses,
  txType: BtcTxType | InscriptionTxType | RunesTxType | MultipleAssetsTxType,
) => {
  if (excludeAddressTxTypes.includes(txType)) {
    return null;
  }

  if (tx.addressList.hasMore) {
    return {
      hasMore: true,
      external: [],
      isOwnTaproot: false,
      isOwnNested: false,
      isOwnNative: false,
    };
  }

  const ownActivityAddressSet = new Set(tx.ownActivity.map((activity) => activity.address));

  const externalAddresses = tx.addressList.items.filter((item) => {
    const isExternalAddress = item.address && !ownActivityAddressSet.has(item.address);
    const isInputOrOutputAddressForSendOrReceiveTx =
      (txType !== 'send' && txType !== 'receive') ||
      (txType === 'send' && item.isOutput) ||
      (txType === 'receive' && item.isInput);
    return isExternalAddress && isInputOrOutputAddressForSendOrReceiveTx;
  });

  const onlyOwnAddresses = externalAddresses.length === 0;

  return {
    hasMore: false,
    external: externalAddresses,
    isOwnTaproot: onlyOwnAddresses && ownActivityAddressSet.has(addresses.taproot.address),
    isOwnNested:
      onlyOwnAddresses && addresses.nested?.address ? ownActivityAddressSet.has(addresses.nested.address) : false,
    isOwnNative:
      onlyOwnAddresses && addresses.native?.address ? ownActivityAddressSet.has(addresses.native.address) : false,
  };
};

const getAssetsInTx = (tx: ApiAddressTransaction): AssetInTx => {
  const hasRunesActivity = tx.runes.allActivity.items.length > 0;
  const hasInscriptionsActivity = tx.inscriptions.items.length > 0;

  if (hasRunesActivity && !hasInscriptionsActivity) {
    return 'runes';
  }

  if (hasInscriptionsActivity && !hasRunesActivity) {
    return 'inscriptions';
  }

  if (hasInscriptionsActivity && hasRunesActivity) {
    return 'multipleAssets';
  }

  return 'btc';
};

// this can be negative if amount is leaving the wallet or positive if amount is entering the wallet
const calculateSatsOwnActivity = (tx: ApiAddressTransaction) => {
  const sats = tx.ownActivity.reduce((acc, activity) => {
    return acc + (activity.received - activity.sent);
  }, 0);

  return sats;
};

const getTypeFromInscription = (inscription: InscriptionEvent): InscriptionTxType => {
  // v2 will also have recover tx type

  // the following order of early returns is important cuz we can have combinations in a same inscription

  if (inscription.inscribed) {
    return 'inscribe';
  }

  if (inscription.burned) {
    return 'burn';
  }

  if (inscription.received) {
    return 'receive';
  }

  return 'send';
};

const getInscriptionsTxType = (inscriptions: PartialInscriptionEvents): InscriptionTxType => {
  // when there are more inscriptions in the tx we treated it as a trade cuz we can't know the type of each inscription
  if (inscriptions.hasMore) {
    return 'trade';
  }

  const firstInscriptionType = getTypeFromInscription(inscriptions.items[0]);
  if (inscriptions.items.length === 1) {
    return firstInscriptionType;
  }

  const hasMultipleInscriptionTypes = inscriptions.items.some(
    (inscription) => getTypeFromInscription(inscription) !== firstInscriptionType,
  );

  return hasMultipleInscriptionTypes ? 'trade' : firstInscriptionType;
};

const getTypeFromRune = (runeIO: RuneIO | undefined, allActivity: RunesAllEvent[]): RunesTxType => {
  // v2 will also have recover tx type

  // if runeIO is nullish, it means that ownActivity is empty hence it's an etch or a mint & burn,
  // if there is at least one etch in allActivity, we treat it as an etch
  // for the rest we treat it as a mint & burn
  if (!runeIO) {
    return allActivity.some((activity) => activity.isEtch) ? 'etch' : 'mintBurn';
  }

  // we grab this info to know if mint or burn
  const runeFromAllActivity = allActivity.find((activity) => activity.runeId === runeIO.runeId);

  // the following order of early returns is important cuz we can have combinations in a same rune

  // 1. check for etch in case of pre-mining
  if (runeFromAllActivity?.isEtch) {
    return 'etch';
  }

  // 2. check for mint in case of mint with partial burn
  if (runeFromAllActivity?.isMint) {
    return 'mint';
  }

  // 3. check for burn in case of burn
  if (runeFromAllActivity?.isBurn) {
    return 'burn';
  }

  // 4. check if balances are equal for split/consolidate
  // we can't actually know if this was a split or consolidation for now we just return consolidate
  if (BigInt(runeIO.sent) === BigInt(runeIO.received)) {
    return 'consolidate';
  }

  // 5. return receive or send based on the balance
  return BigInt(runeIO.received) - BigInt(runeIO.sent) > 0n ? 'receive' : 'send';
};

const getRunesTxType = (runes: RunesActivity): RunesTxType => {
  // when there are more runes in the tx we treated it as a trade cuz we can't know the type of each rune
  if (runes.ownActivity.hasMore) {
    return 'trade';
  }

  const firstRuneType = getTypeFromRune(runes.ownActivity.items[0], runes.allActivity.items);

  // we check for 1 or 0 cuz when etching, own activity can be empty is there is no minting
  if (runes.ownActivity.items.length <= 1) {
    return firstRuneType;
  }

  const runeTypes = new Set<RunesTxType>(
    runes.ownActivity.items.map((rune) => getTypeFromRune(rune, runes.allActivity.items)),
  );

  // when one or multiple runes are leaving the wallet and there is also consolidations/splits
  // we want to return the type of the rune that is leaving the wallet
  if (runeTypes.size === 2 && runeTypes.has('consolidate') && (runeTypes.has('send') || runeTypes.has('burn'))) {
    return runeTypes.has('send') ? 'send' : 'burn';
  }

  return runeTypes.size > 1 ? 'trade' : firstRuneType;
};

const getRunesObjectForTxWithRuneAssets = (
  tx: ApiAddressTransaction,
  runesInfoDictionary: Map<string, RuneInfo>,
  txType: RunesTxType,
): EnhancedRunesOwnActivity => {
  const ownRuneIdsSet = new Set<string>();

  const ownItems = tx.runes.ownActivity.items
    // if txType is of runes leaving the wallet, we want to avoid runes that are consolidate/split
    .filter((rune) => (txType !== 'send' && txType !== 'burn') || BigInt(rune.received) !== BigInt(rune.sent))
    .map((rune) => {
      ownRuneIdsSet.add(rune.runeId);
      return {
        ...rune,
        ...runesInfoDictionary.get(rune.runeId),
      };
    });

  const allItems: EnhancedRuneIO[] = [];
  tx.runes.allActivity.items.forEach((rune) => {
    const isEtchOrMintBurnedRune = rune.isEtch || (rune.isBurn && rune.isMint);
    const isDuplicate = ownRuneIdsSet.has(rune.runeId);
    if (isEtchOrMintBurnedRune && !isDuplicate) {
      allItems.push({
        runeId: rune.runeId,
        address: '',
        sent: '0',
        received: '0',
        outgoing: '0',
        incoming: '0',
        ...runesInfoDictionary.get(rune.runeId),
      });
    }
  });

  return {
    ...tx.runes.ownActivity,
    items: [...ownItems, ...allItems],
  };
};

const getMultipleAssetsTxType = (tx: ApiAddressTransaction): MultipleAssetsTxType => {
  const inscriptionsTxType = getInscriptionsTxType(tx.inscriptions);
  const runesTxType = getRunesTxType(tx.runes);
  // etch with inscribed inscription
  if (runesTxType === 'etch' && inscriptionsTxType === 'inscribe') {
    return 'etch';
  }

  return inscriptionsTxType === runesTxType ? inscriptionsTxType : 'trade';
};

const getBtcTxType = (tx: ApiAddressTransaction): BtcTxType => {
  const satsAmount = calculateSatsOwnActivity(tx);

  // v2 will discriminate between consolidate and recovers
  const hasNoExternalActivity = satsAmount + (tx.totalIn - tx.totalOut) === 0;
  if (hasNoExternalActivity) {
    return 'consolidate';
  }
  return satsAmount > 0 ? 'receive' : 'send';
};

export const enhanceTx = ({
  tx,
  addresses,
  runesInfoDictionary,
}: {
  tx: ApiAddressTransaction;
  addresses: AccountBtcAddresses;
  runesInfoDictionary: Map<string, RuneInfo>;
}): EnhancedTx => {
  const assetInTx = getAssetsInTx(tx);
  const baseTxObject = {
    id: tx.txid,
    fees: tx.totalIn - tx.totalOut,
    satsAmount: calculateSatsOwnActivity(tx),
    blockHeight: tx.blockHeight,
    blockTime: tx.blockTime,
  };

  // inscriptions
  if (assetInTx === 'inscriptions') {
    const txType = getInscriptionsTxType(tx.inscriptions);
    return {
      ...baseTxObject,
      assetInTx: 'inscriptions',
      txType: getInscriptionsTxType(tx.inscriptions),
      inscriptions: tx.inscriptions,
      addressesInTx: getAddressesInTx(tx, addresses, txType),
    };
  }

  // runes
  if (assetInTx === 'runes') {
    const txType = getRunesTxType(tx.runes);
    return {
      ...baseTxObject,
      assetInTx: 'runes',
      txType,
      runes: getRunesObjectForTxWithRuneAssets(tx, runesInfoDictionary, txType),
      addressesInTx: getAddressesInTx(tx, addresses, txType),
    };
  }

  // multiple assets
  if (assetInTx === 'multipleAssets') {
    const runeTxType = getRunesTxType(tx.runes);
    const txType = getMultipleAssetsTxType(tx);
    return {
      ...baseTxObject,
      assetInTx: 'multipleAssets',
      txType,
      inscriptions: tx.inscriptions,
      runes: getRunesObjectForTxWithRuneAssets(tx, runesInfoDictionary, runeTxType),
      addressesInTx: getAddressesInTx(tx, addresses, txType),
    };
  }

  // by default return btc tx till we can handle any new tx types
  const txType = getBtcTxType(tx);
  return {
    ...baseTxObject,
    assetInTx: 'btc',
    txType,
    addressesInTx: getAddressesInTx(tx, addresses, txType),
  };
};

export const mapRuneToRuneInfo = (rune: Rune): RuneInfo => ({
  symbol: rune.entry.symbol,
  name: rune.entry.spaced_rune,
  divisibility: rune.entry.divisibility,
  inscriptionId: rune.parent ?? '',
});

export const getRunesInfoDictionary = async ({
  txs,
  clientRunesInfo,
  runesApiClient,
}: {
  txs: ApiAddressTransaction[];
  clientRunesInfo: Map<string, RuneInfo>;
  runesApiClient: RunesApi;
}) => {
  const txRunesIdsSet = new Set<string>();
  txs.forEach((item) => {
    item.runes.allActivity.items.forEach((rune) => {
      if (!clientRunesInfo.has(rune.runeId)) {
        txRunesIdsSet.add(rune.runeId);
      }
    });
  });

  const runeInfoDictionary = new Map<string, RuneInfo>();

  const runeIds = Array.from(txRunesIdsSet);
  const runesInfo = await Promise.allSettled(runeIds.map((runeId) => runesApiClient.getRuneInfo(runeId)));

  runesInfo.forEach((runeInfo) => {
    if (runeInfo.status === 'fulfilled' && runeInfo.value) {
      runeInfoDictionary.set(runeInfo.value.id, mapRuneToRuneInfo(runeInfo.value));
    }
  });

  return new Map([...clientRunesInfo, ...runeInfoDictionary]);
};

export const fetchPastBtcTransactions = async ({
  account,
  offset,
  limit,
  clientRunesInfo,
  runesApiClient,
  xverseApiClient,
}: {
  account: Account;
  offset: number;
  limit: number;
  clientRunesInfo: Map<string, RuneInfo>;
  runesApiClient: RunesApi;
  xverseApiClient: XverseApi;
}): Promise<BtcTxHistory> => {
  const { transactions: txs } = await xverseApiClient.account.fetchAccountBtcHistory(account, {
    offset,
    limit,
  });
  const runesInfoDictionary = await getRunesInfoDictionary({ txs, clientRunesInfo, runesApiClient });
  const enhancedTxs = txs.map((tx) => enhanceTx({ tx, addresses: account.btcAddresses, runesInfoDictionary }));
  return {
    transactions: enhancedTxs,
    offset,
    limit,
  };
};
