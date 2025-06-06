import { getRunesClient } from '../api';
import { PsbtSummary, TransactionContext, TransactionSummary } from '../transactions/bitcoin';
import { CreateEtchOrderRequest, FungibleToken, Marketplace, NetworkType, Override } from '../types';
import { bigUtils } from './bignumber';
import { type BigNumber } from 'bignumber.js';

export type RuneBase = {
  runeName: string;
  runeId: string;
  amount: bigint;
  divisibility: number;
  symbol: string;
  inscriptionId: string;
};

export type RuneMint = RuneBase & {
  runeIsOpen: boolean;
  runeIsMintable: boolean;
};

export type RuneTransfer = RuneBase & {
  sourceAddress: string;
  destinationAddresses: string[];
  hasSufficientBalance: boolean;
};

export type RuneReceipt = RuneBase & {
  sourceAddresses: string[];
  destinationAddress: string;
};

export type RuneBurn = RuneBase & { sourceAddresses: string[] };

export type RuneSummaryParseOptions = { separateTransfersOnNoExternalInputs?: boolean };

export type RuneSummary = {
  inputsHadRunes: boolean;
  // can only do 1 mint per txn
  mint?: RuneMint;
  transfers: RuneTransfer[];
  receipts: RuneReceipt[];
  burns: RuneBurn[];
  outputMapping: Record<number, (RuneBase & { destinationAddress: string })[]>;
};

export type EtchActionDetails = Omit<
  CreateEtchOrderRequest,
  'appServiceFee' | 'appServiceFeeAddress' | 'refundAddress'
>;

export type MintActionDetails = RuneMint & {
  repeats: number;
  runeSize: number;
  destinationAddress: string;
};

/**
 * RuneSummaryActions is a RuneSummary with the mint and etch properties extended
 *  with ordinals service specific properties.
 * for usage with the tx confirmations and etch/mint screens
 */
export type RuneSummaryActions = Override<
  RuneSummary,
  {
    mint: MintActionDetails;
    etch: EtchActionDetails;
  }
>;

const getSpacedName = (name: string, spacerRaw: bigint | BigNumber): string => {
  const spacer = BigInt(spacerRaw.toString(10));

  if (spacer === 0n) {
    return name;
  }

  const nameArr = [...name];
  const spacerBin = spacer.toString(2).split('').reverse();

  while (spacerBin.length) {
    const isSpace = spacerBin.pop();
    if (isSpace === '0') {
      continue;
    }

    nameArr.splice(spacerBin.length + 1, 0, '•');
  }

  return nameArr.join('');
};

export const normalizeRuneName = (name: string): string => {
  // remove all non-alphanumeric characters
  return name.replace(/[^a-zA-Z]/g, '').toUpperCase();
};

const extractRuneInputs = async (context: TransactionContext, summary: TransactionSummary | PsbtSummary) => {
  const userAddresses = new Set([context.paymentAddress.address, context.ordinalsAddress.address]);

  const inputRuneData = await Promise.all(
    summary.inputs.map(async (input) => {
      const hasRunes = await input.extendedUtxo.hasRunes();
      const balances = await input.extendedUtxo.getRuneBalances();

      return {
        input,
        hasRunes,
        balances,
        isUserAddress: userAddresses.has(input.extendedUtxo.address),
      };
    }),
  );

  return inputRuneData.filter((input) => input.hasRunes);
};

const parseSummaryWithBurnRuneScript = async (
  context: TransactionContext,
  summary: TransactionSummary | PsbtSummary,
  network: NetworkType,
): Promise<RuneSummary> => {
  const runeClient = getRunesClient(network);
  const runeInputs = await extractRuneInputs(context, summary);

  const inputsHadRunes = runeInputs.length > 0;

  const burns = runeInputs.reduce((acc, input) => {
    const inputAddress = input.input.extendedUtxo.address;
    const inputBalances = input.balances;

    for (const runeName in inputBalances) {
      const addressRuneKey = `${inputAddress}:${runeName}`;

      if (acc[addressRuneKey] === undefined) {
        acc[addressRuneKey] = {
          runeName,
          amount: BigInt(inputBalances[runeName].toFixed()),
          sourceAddresses: [inputAddress],
        };
      } else {
        acc[addressRuneKey].amount += BigInt(inputBalances[runeName].toFixed());
      }
    }

    return acc;
  }, {} as Record<string, Omit<RuneBurn, 'runeId' | 'divisibility' | 'symbol' | 'inscriptionId'>>);

  const embellishedBurns: RuneBurn[] = [];

  for (const burn of Object.values(burns)) {
    const runeInfo = await runeClient.getRuneInfo(burn.runeName);

    embellishedBurns.push({
      ...burn,
      runeId: runeInfo?.id || '',
      divisibility: runeInfo?.entry.divisibility.toNumber() || 0,
      symbol: runeInfo?.entry.symbol || '',
      inscriptionId: runeInfo?.parent || '',
    });
  }

  return {
    inputsHadRunes,
    receipts: [],
    transfers: [],
    burns: embellishedBurns,
    outputMapping: {},
  };
};

const parseSummaryWithRuneScript = async (
  context: TransactionContext,
  summary: TransactionSummary | PsbtSummary,
  network: NetworkType,
): Promise<RuneSummary> => {
  const runeOp = summary.runeOp;

  const runeClient = getRunesClient(network);
  const runeInputs = await extractRuneInputs(context, summary);
  const userAddresses = new Set([context.paymentAddress.address, context.ordinalsAddress.address]);

  const inputsHadRunes = runeInputs.filter((r) => r.isUserAddress).length > 0;

  const burns: RuneBurn[] = [];

  // calculate initial unallocated balance without mint
  const unallocatedBalance = runeInputs.reduce((acc, input) => {
    for (const runeName in input.balances) {
      const amount = BigInt(input.balances[runeName].toFixed());
      const sourceAddress = input.input.extendedUtxo.address;
      if (runeName in acc) {
        acc[runeName].amount += amount;
        acc[runeName].sourceAddresses.add(sourceAddress);
      } else {
        acc[runeName] = {
          amount,
          sourceAddresses: new Set([sourceAddress]),
        };
      }
    }
    return acc;
  }, {} as Record<string, { amount: bigint; sourceAddresses: Set<string> }>);

  // parse mint and add to unallocated balance if valid
  let mint: RuneMint | undefined = undefined;
  if (runeOp?.Runestone?.mint) {
    const runeInfo = await runeClient.getRuneInfo(runeOp.Runestone.mint);

    if (runeInfo && runeInfo.entry.terms.cap) {
      const runeName = runeInfo.entry.spaced_rune || '';
      const mintAmount = BigInt(runeInfo.entry.terms.amount?.toString(10) ?? 0);
      const runeIsOpen = !!(runeInfo.entry.terms.amount && runeInfo.entry.terms.cap);

      mint = {
        runeName,
        runeId: runeInfo.id,
        amount: mintAmount,
        runeIsOpen,
        runeIsMintable: runeInfo.mintable,
        divisibility: runeInfo.entry.divisibility.toNumber(),
        symbol: runeInfo.entry.symbol || '¤',
        inscriptionId: runeInfo.parent || '',
      };

      if (runeInfo.mintable) {
        if (runeName in unallocatedBalance) {
          unallocatedBalance[runeName].amount += mintAmount;
          unallocatedBalance[runeName].sourceAddresses.add('mint');
        } else {
          unallocatedBalance[runeName] = {
            amount: mintAmount,
            sourceAddresses: new Set(['mint']),
          };
        }
      }
    } else {
      // rune being minted does not exist or is not open
      mint = {
        runeName: runeInfo?.entry.spaced_rune || '',
        runeId: runeInfo?.id || '',
        amount: 0n,
        divisibility: 0,
        symbol: runeInfo?.entry.symbol || '',
        inscriptionId: runeInfo?.parent || '',
        runeIsOpen: false,
        runeIsMintable: false,
      };
    }
  }

  // start compiling transfers and receipts
  type PartialTransfer = Omit<
    RuneTransfer,
    'runeId' | 'hasSufficientBalance' | 'destinationAddresses' | 'divisibility' | 'symbol' | 'inscriptionId'
  >;

  const transfersByRuneAndAddress = runeInputs
    .filter((r) => r.isUserAddress)
    .reduce((acc, input) => {
      const inputAddress = input.input.extendedUtxo.address;

      for (const runeName in input.balances) {
        const balance = BigInt(input.balances[runeName].toFixed());

        acc[runeName] ||= {};

        if (!(inputAddress in acc[runeName])) {
          acc[runeName][inputAddress] = {
            sourceAddress: inputAddress,
            runeName,
            amount: balance,
          };
        } else {
          acc[runeName][inputAddress].amount += balance;
        }
      }

      return acc;
    }, {} as Record<string, Record<string, PartialTransfer>>);

  // process edicts into receipts if not burnt on script
  const allocated = {} as Record<
    number,
    Record<string, { amount: bigint; sourceAddresses: string[]; destinationAddress: string }>
  >;

  for (const edict of runeOp?.Runestone?.edicts ?? []) {
    let runeName = '';

    if (edict.id === '0:0') {
      runeName = getSpacedName(runeOp?.Runestone?.etching?.rune || '', runeOp?.Runestone?.etching?.spacers || 0n);
    } else {
      const runeInfo = await runeClient.getRuneInfo(edict.id);
      if (runeInfo?.entry.spaced_rune) {
        runeName = runeInfo?.entry.spaced_rune;
      }
    }

    const amount = BigInt(edict.amount.toString(10));

    if (!(runeName in unallocatedBalance) || unallocatedBalance[runeName].amount <= 0n) {
      // there are no runes available for the transfer, decrease the unallocated balance and continue to next edict
      // we decrease the unallocated balance to pick up insufficient balance errors
      unallocatedBalance[runeName] = unallocatedBalance[runeName] ?? { amount: 0n, sourceAddresses: new Set() };
      unallocatedBalance[runeName].amount -= amount;
      continue;
    }

    const outputIndex = Number(edict.output.toString(10));

    const sourceAddresses = [...unallocatedBalance[runeName].sourceAddresses];

    if (outputIndex < summary.outputs.length) {
      const amountToTransfer =
        // if amount is 0, transfer entire unallocated balance
        amount === 0n
          ? unallocatedBalance[runeName].amount
          : // else transfer min of amount and unallocated balance
            BigInt(bigUtils.min(amount, unallocatedBalance[runeName].amount).toString(10));

      // this could overflow to negative, which is fine and will show that there are not enough funds
      unallocatedBalance[runeName].amount -= amount === 0n ? unallocatedBalance[runeName].amount : amount;

      if (amountToTransfer < 0n) {
        // we've already hit insufficient balance
        continue;
      }

      const output = summary.outputs[outputIndex];
      if (output.type !== 'address') {
        const runeInfo = await runeClient.getRuneInfo(runeName);

        if (!runeInfo) {
          throw new Error('Cannot find rune info for transfer');
        }

        burns.push({
          runeName,
          runeId: runeInfo.id,
          amount: amountToTransfer,
          sourceAddresses: sourceAddresses.filter((a) => a !== 'mint'),
          divisibility: runeInfo.entry.divisibility.toNumber(),
          symbol: runeInfo.entry.symbol,
          inscriptionId: runeInfo.parent || '',
        });
        continue;
      }

      // assign to specific output
      if (allocated[outputIndex] === undefined) {
        allocated[outputIndex] = {};
      }

      if (runeName in allocated[outputIndex]) {
        allocated[outputIndex][runeName].amount += amountToTransfer;
      } else {
        allocated[outputIndex][runeName] = {
          amount: amountToTransfer,
          sourceAddresses,
          destinationAddress: output.address,
        };
      }
    } else if (outputIndex === summary.outputs.length) {
      // distribute between outputs
      let availableAmount = unallocatedBalance[runeName].amount;

      if (availableAmount <= 0n) {
        // no balance to distribute
        continue;
      }

      const nonOpReturnOutputIndexes = summary.outputs
        .map((output, index) => ({ output, index }))
        .filter((o) => o.output.type !== 'script');

      const amountPerOutput = amount === 0n ? availableAmount / BigInt(nonOpReturnOutputIndexes.length) : amount;
      let remainder = amount === 0n ? availableAmount % BigInt(nonOpReturnOutputIndexes.length) : 0n;

      for (const output of nonOpReturnOutputIndexes) {
        if (output.output.type !== 'address') {
          throw new Error('Something went wrong. Output should be an address.');
        }

        if (availableAmount <= 0n) {
          break;
        }

        let outputAmount = BigInt(bigUtils.min(amountPerOutput, availableAmount).toString(10));
        if (remainder > 0n) {
          outputAmount += 1n;
          remainder -= 1n;
        }

        unallocatedBalance[runeName].amount -= outputAmount;
        availableAmount -= outputAmount;

        if (allocated[output.index] === undefined) {
          allocated[output.index] = {};
        }

        if (runeName in allocated[output.index]) {
          allocated[output.index][runeName].amount += outputAmount;
        } else {
          allocated[output.index][runeName] = {
            amount: outputAmount,
            sourceAddresses,
            destinationAddress: output.output.address,
          };
        }
      }
    } else {
      throw new Error('Invalid runeOp. Entire Rune op should be burnt.');
    }
  }

  // allocate unallocated
  let changeOutputIndex: number | undefined = undefined;

  if (
    runeOp?.Runestone?.pointer === undefined ||
    runeOp?.Runestone?.pointer === null ||
    runeOp.Runestone.pointer.gte(summary.outputs.length)
  ) {
    let index = 0;
    for (const output of summary.outputs) {
      if (output.type === 'address') {
        changeOutputIndex = Number(index);
        break;
      }
      index++;
    }
  } else {
    changeOutputIndex = Number(runeOp.Runestone.pointer.toString(10));
  }

  const changeOutput = changeOutputIndex !== undefined ? summary.outputs[Number(changeOutputIndex)] : undefined;
  if (changeOutputIndex !== undefined && changeOutput?.type === 'address') {
    // if there is a default change output, allocate unallocated balance to change output
    for (const runeName in unallocatedBalance) {
      const amount = unallocatedBalance[runeName].amount;
      const sourceAddresses = [...unallocatedBalance[runeName].sourceAddresses];

      if (amount > 0n) {
        unallocatedBalance[runeName].amount -= amount;

        if (allocated[changeOutputIndex] === undefined) {
          allocated[changeOutputIndex] = {};
        }

        if (runeName in allocated[changeOutputIndex]) {
          allocated[changeOutputIndex][runeName].amount += amount;
        } else {
          allocated[changeOutputIndex][runeName] = {
            amount,
            sourceAddresses,
            destinationAddress: changeOutput.address,
          };
        }
      }
    }
  } else {
    // if selected change output is an op_return, runes get burnt
    for (const runeName in unallocatedBalance) {
      const amount = unallocatedBalance[runeName].amount;
      const sourceAddresses = [...unallocatedBalance[runeName].sourceAddresses];

      if (amount > 0n) {
        unallocatedBalance[runeName].amount -= amount;

        // only track burns for user addresses
        if (sourceAddresses.some((address) => userAddresses.has(address))) {
          const runeInfo = await runeClient.getRuneInfo(runeName);

          if (!runeInfo) {
            throw new Error('Cannot find rune info for transfer');
          }

          burns.push({
            runeName,
            amount,
            runeId: runeInfo.id,
            sourceAddresses: sourceAddresses.filter((a) => a !== 'mint'),
            divisibility: runeInfo.entry.divisibility.toNumber(),
            symbol: runeInfo.entry.symbol,
            inscriptionId: runeInfo.parent || '',
          });
        }
      }
    }
  }

  // generate receipts and add destination addresses
  const receipts: RuneReceipt[] = [];
  const runeRecipients: Record<string, string[]> = {};
  const userReceiptRuneAmounts = {} as Record<string, Record<string, bigint>>;

  const outputMapping: Record<number, (RuneBase & { destinationAddress: string })[]> = {};

  for (const i in allocated) {
    const index = Number(i);
    const summaryOutput = summary.outputs[index];

    if (summaryOutput.type === 'script') {
      throw new Error('Something went wrong while parsing the runeOp. All allocated outputs should be non-script.');
    }

    const output = allocated[index];

    outputMapping[index] = [];

    for (const runeName in output) {
      const amount = output[runeName].amount;
      const sourceAddresses = output[runeName].sourceAddresses;
      const destinationAddress = output[runeName].destinationAddress;

      runeRecipients[runeName] ||= [];
      runeRecipients[runeName].push(destinationAddress);

      const runeInfo = await runeClient.getRuneInfo(runeName);

      outputMapping[index].push({
        runeName,
        amount,
        destinationAddress,
        divisibility: runeInfo?.entry.divisibility.toNumber() || 0,
        runeId: runeInfo?.id || '',
        symbol: runeInfo?.entry.symbol || '',
        inscriptionId: runeInfo?.parent || '',
      });

      if (userAddresses.has(destinationAddress)) {
        // we only show receipts if we are sending to another address or if we transfer between payment and ordinals
        // otherwise, transfers are just change and there is no need to show them
        if (sourceAddresses.length !== 1 || sourceAddresses[0] !== destinationAddress) {
          receipts.push({
            sourceAddresses: sourceAddresses.filter((a) => a !== 'mint'),
            destinationAddress,
            runeName,
            amount,
            runeId: runeInfo?.id || '',
            divisibility: runeInfo?.entry.divisibility.toNumber() || 0,
            symbol: runeInfo?.entry.symbol || '',
            inscriptionId: runeInfo?.parent || '',
          });
        }

        userReceiptRuneAmounts[destinationAddress] = userReceiptRuneAmounts[destinationAddress] ?? {};
        userReceiptRuneAmounts[destinationAddress][runeName] =
          userReceiptRuneAmounts[destinationAddress][runeName] || 0n;
        userReceiptRuneAmounts[destinationAddress][runeName] += amount;
      }
    }
  }

  // calculate hasSufficientBalance to transfers from receipts and unallocatedBalance
  const burnt = burns.reduce((acc, burn) => {
    acc[burn.runeName] = acc[burn.runeName] || 0n;
    acc[burn.runeName] += burn.amount;
    return acc;
  }, {} as Record<string, bigint>);

  const transfers: RuneTransfer[] = [];

  for (const [runeName, addressTransfers] of Object.entries(transfersByRuneAndAddress)) {
    for (const [sourceAddress, transfer] of Object.entries(addressTransfers)) {
      const runeInfo = await runeClient.getRuneInfo(runeName);

      const amount = BigInt(
        transfer.amount - (userReceiptRuneAmounts[sourceAddress]?.[runeName] ?? 0n) - (burnt[runeName] ?? 0n),
      );

      if (amount <= 0n) {
        continue;
      }

      transfers.push({
        sourceAddress,
        destinationAddresses: runeRecipients[runeName].filter((a) => a !== sourceAddress) || [],
        runeName,
        amount,
        runeId: runeInfo?.id || '',
        divisibility: runeInfo?.entry.divisibility.toNumber() || 0,
        symbol: runeInfo?.entry.symbol || '',
        inscriptionId: runeInfo?.parent || '',
        hasSufficientBalance: unallocatedBalance[runeName].amount >= 0n,
      });
    }
  }

  return {
    inputsHadRunes,
    mint,
    receipts,
    transfers,
    burns,
    outputMapping,
  };
};

export const parseSummaryForRunes = async (
  context: TransactionContext,
  summary: TransactionSummary | PsbtSummary,
  network: NetworkType,
): Promise<RuneSummary> => {
  if ((summary.runeOp?.Cenotaph?.flaws ?? 0) > 0) {
    return parseSummaryWithBurnRuneScript(context, summary, network);
  }
  return parseSummaryWithRuneScript(context, summary, network);
};

export const marketplaceRuneDashboardUrl = (rune: FungibleToken, marketplace: Marketplace): string => {
  const marketplaceToUrl: { [key in Marketplace]: string } = {
    'Magic Eden': `https://magiceden.io/runes/${rune.name}`,
    Unisat: `https://unisat.io/runes/market?tick=${rune.name}`,
    OKX: `https://www.okx.com/web3/marketplace/runes/token/${rune.name}/${rune.principal}`,
  };

  return marketplaceToUrl[marketplace];
};
