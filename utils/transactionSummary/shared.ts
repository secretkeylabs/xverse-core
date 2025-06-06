import { btcTransaction } from '../../transactions';
import {
  EnhancedInput,
  IOInscription,
  IOSatribute,
  PsbtSummary,
  TransactionOutput,
  TransactionSummary,
} from '../../transactions/bitcoin';
import { RareSatsType } from '../../types';
import { RuneSummary } from '../runes';
import {
  AggregatedInputSummary,
  AggregatedIOSummary,
  AggregatedOutputSummary,
  AggregatedSummary,
  IORune,
  UserTransactionSummary,
} from './types';

export const isPsbtSummary = (summary: TransactionSummary | PsbtSummary): summary is PsbtSummary => {
  return 'isFinal' in summary;
};

export const isScriptOutput = (
  output: btcTransaction.EnhancedOutput,
): output is btcTransaction.TransactionScriptOutput =>
  (output as btcTransaction.TransactionScriptOutput).type === 'script';

export const isAddressOutput = (output: btcTransaction.EnhancedOutput): output is btcTransaction.TransactionOutput =>
  (output as btcTransaction.TransactionOutput).type === 'address';

export const isPubKeyOutput = (
  output: btcTransaction.EnhancedOutput,
): output is btcTransaction.TransactionPubKeyOutput => !isScriptOutput(output) && !isAddressOutput(output);

export const isUserSummary = (
  summary: UserTransactionSummary | AggregatedSummary | undefined,
): summary is UserTransactionSummary => !!(summary && summary.type === 'user');

export const isAggregatedSummary = (
  summary: UserTransactionSummary | AggregatedSummary | undefined,
): summary is AggregatedSummary => !!(summary && summary.type === 'aggregated');

export const combineInscriptionsAndSatributes = (inscriptions: IOInscription[], satributes: IOSatribute[]) => {
  const result: {
    inscriptions: (IOInscription & { satributes: RareSatsType[] })[];
    satributes: IOSatribute[];
  } = {
    inscriptions: [],
    satributes: [],
  };
  const satributesLocal = [...satributes];

  for (const inscription of inscriptions) {
    const inscriptionSatributes = satributesLocal.find((satribute) => satribute.offset === inscription.offset);

    if (inscriptionSatributes) {
      const indexToDelete = satributesLocal.indexOf(inscriptionSatributes);
      satributesLocal.splice(indexToDelete, 1);
      if (inscriptionSatributes.amount > 1) {
        satributesLocal.push({
          ...inscriptionSatributes,
          amount: inscriptionSatributes.amount - 1,
          offset: inscriptionSatributes.offset + 1,
        });
      }
    }

    result.inscriptions.push({ ...inscription, satributes: inscriptionSatributes?.types ?? [] });
  }

  result.satributes = satributesLocal;

  return result;
};

export const extractSummaryItems = (
  ios: TransactionOutput[] | EnhancedInput[],
  runes: IORune[],
): AggregatedIOSummary => {
  let btcSatsAmount = 0;
  let inscriptions: IOInscription[] = [];
  let satributes: IOSatribute[] = [];

  for (const io of ios) {
    if ('extendedUtxo' in io) {
      btcSatsAmount += io.extendedUtxo.utxo.value;
    } else {
      btcSatsAmount += io.amount;
    }

    inscriptions = [...inscriptions, ...io.inscriptions];
    satributes = [...satributes, ...io.satributes];
  }

  const result: AggregatedIOSummary = {
    btcSatsAmount,
    inscriptions: [],
    satributes: [],
    runes,
  };

  // Add satributes to inscriptions if they overlap
  const mergedInscriptionsSatributes = combineInscriptionsAndSatributes(inscriptions, satributes);

  result.inscriptions = mergedInscriptionsSatributes.inscriptions;
  result.satributes = mergedInscriptionsSatributes.satributes;

  return result;
};

const generateSatributeKey = (satribute: Omit<IOSatribute, 'offset'>) => {
  const satributeTypes = [...satribute.types];
  return satributeTypes.sort().join(',');
};

const aggregateSatributes = (satributes: Omit<IOSatribute, 'offset'>[]): Omit<IOSatribute, 'offset'>[] => {
  const aggregatedMap = satributes.reduce((acc, satribute) => {
    const key = generateSatributeKey(satribute);
    acc[key] ||= { ...satribute, amount: 0 };
    acc[key].amount += satribute.amount;

    return acc;
  }, {} as Record<string, Omit<IOSatribute, 'offset'>>);

  return Object.values(aggregatedMap);
};

const diffSatributes = (
  mainCollection: Omit<IOSatribute, 'offset'>[],
  diffCollection: Omit<IOSatribute, 'offset'>[],
): Omit<IOSatribute, 'offset'>[] => {
  const diffSatributeAmounts = aggregateSatributes(diffCollection).reduce((acc, satribute) => {
    const key = generateSatributeKey(satribute);
    acc[key] ||= 0;
    acc[key] += satribute.amount;
    return acc;
  }, {} as Record<string, number>);

  return aggregateSatributes(mainCollection).reduce((acc, satribute) => {
    const key = generateSatributeKey(satribute);
    const amountDiff = satribute.amount - (diffSatributeAmounts[key] ?? 0);

    if (amountDiff > 0) {
      acc.push({
        ...satribute,
        amount: amountDiff,
      });
    }

    return acc;
  }, [] as Omit<IOSatribute, 'offset'>[]);
};

const aggregateRunes = (runes: IORune[]): IORune[] => {
  const aggregatedRunes = runes.reduce((acc, rune) => {
    acc[rune.runeName] ||= { ...rune, amount: 0n };
    acc[rune.runeName].amount += rune.amount;
    return acc;
  }, {} as Record<string, IORune>);

  return Object.values(aggregatedRunes);
};

const diffRunes = (mainCollection: IORune[], diffCollection: IORune[]): IORune[] => {
  const diffRuneAmounts = aggregateRunes(diffCollection).reduce((acc, rune) => {
    acc[rune.runeName] ||= 0n;
    acc[rune.runeName] += rune.amount;
    return acc;
  }, {} as Record<string, bigint>);

  return aggregateRunes(mainCollection).reduce((acc, rune) => {
    const amountDiff = rune.amount - (diffRuneAmounts[rune.runeName] ?? 0n);
    if (amountDiff > 0n) {
      acc.push({
        ...rune,
        amount: amountDiff,
      });
    }
    return acc;
  }, [] as IORune[]);
};

const diffInscriptions = (
  mainCollection: (Omit<IOInscription, 'offset'> & { satributes: RareSatsType[] })[],
  diffCollection: (Omit<IOInscription, 'offset'> & { satributes: RareSatsType[] })[],
): (Omit<IOInscription, 'offset'> & { satributes: RareSatsType[] })[] => {
  const rightInscriptionIds = new Set(diffCollection.map((inscription) => inscription.id));

  return mainCollection.filter((inscription) => !rightInscriptionIds.has(inscription.id));
};

const getTransfers = (
  userInputSummary: AggregatedInputSummary,
  userOutputSummary: AggregatedOutputSummary,
): AggregatedInputSummary => {
  return {
    btcSatsAmount: Math.max(userInputSummary.btcSatsAmount - userOutputSummary.btcSatsAmount, 0),
    inscriptions: diffInscriptions(userInputSummary.inscriptions, userOutputSummary.inscriptions),
    satributes: diffSatributes(userInputSummary.satributes, userOutputSummary.satributes),
    runes: diffRunes(userInputSummary.runes, userOutputSummary.runes),
  };
};

const getReceipts = (
  userInputSummary: AggregatedInputSummary,
  userOutputSummary: AggregatedOutputSummary,
): AggregatedOutputSummary => {
  return {
    btcSatsAmount: Math.max(userOutputSummary.btcSatsAmount - userInputSummary.btcSatsAmount, 0),
    inscriptions: diffInscriptions(userOutputSummary.inscriptions, userInputSummary.inscriptions),
    satributes: diffSatributes(userOutputSummary.satributes, userInputSummary.satributes),
    runes: diffRunes(userOutputSummary.runes, userInputSummary.runes),
  };
};

export const getAddressSummary = (
  address: string,
  summary: TransactionSummary | PsbtSummary,
  runeSummary: RuneSummary,
): { transfers: AggregatedInputSummary; receipts: AggregatedOutputSummary } => {
  // compile list of input assets from user
  const userInputs = summary.inputs.filter((input) => input.extendedUtxo.address === address);
  const userInputSummary: AggregatedInputSummary = extractSummaryItems(
    userInputs,
    runeSummary.transfers
      .filter((transfer) => transfer.sourceAddress === address)
      .map(({ sourceAddress, amount, divisibility, inscriptionId, runeName, runeId, symbol }) => ({
        amount,
        divisibility,
        inscriptionId,
        runeName,
        runeId,
        symbol,
        address: sourceAddress,
      })),
  );

  // compile list of output assets to user
  const userOutputs = summary.outputs.filter(
    (output): output is TransactionOutput => output.type === 'address' && output.address === address,
  );
  const userOutputSummary = extractSummaryItems(
    userOutputs,
    runeSummary.receipts
      .filter((transfer) => transfer.destinationAddress === address)
      .map(({ destinationAddress, amount, divisibility, inscriptionId, runeName, runeId, symbol }) => ({
        amount,
        divisibility,
        inscriptionId,
        runeName,
        runeId,
        symbol,
        address: destinationAddress,
      })),
  );

  return {
    transfers: getTransfers(userInputSummary, userOutputSummary),
    receipts: getReceipts(userInputSummary, userOutputSummary),
  };
};
