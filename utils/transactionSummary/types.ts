import {
  EnhancedInput,
  EnhancedOutput,
  IOInscription,
  IOSatribute,
  TransactionFeeOutput,
} from '../../transactions/bitcoin';
import { RareSatsType } from '../../types';
import { RuneBase, RuneMint } from '../runes';

export type BaseSummary = {
  runes: {
    hasCenotaph: boolean;
    hasInsufficientBalance: boolean;
    hasInvalidMint: boolean;
    mint?: RuneMint;
    burns: RuneBase[];
  };
  feeRate?: number;
  inputs: EnhancedInput[];
  outputs: EnhancedOutput[];
  hasOutputScript: boolean;
  hasExternalInputs: boolean;
  hasUnconfirmedInputs: boolean;
  isFinal: boolean;
  hasSigHashNone: boolean;
  hasSigHashSingle: boolean;
};

export type IORune = RuneBase & {
  address: string;
};

export type AggregatedIOSummary = {
  btcSatsAmount: number;
  inscriptions: (Omit<IOInscription, 'offset'> & { satributes: RareSatsType[] })[];
  satributes: Omit<IOSatribute, 'offset'>[];
  runes: IORune[];
};

export type AggregatedInputSummary = AggregatedIOSummary;
export type AggregatedOutputSummary = AggregatedIOSummary;

export type AggregatedSummary = BaseSummary & {
  type: 'aggregated';
  transfers: {
    [address: string]: AggregatedInputSummary;
  };
  receipts: {
    [address: string]: AggregatedOutputSummary;
  };
  fee?: number;
};

export type TransferBundle = {
  amount: number;
  inscriptions: (IOInscription & { satributes: RareSatsType[] })[];
  satributes: IOSatribute[];
  runes: RuneBase[];
};

export type TransferIOSummary = {
  destinationType: 'address' | 'pk' | 'ms' | 'tr_ms' | 'tr_ns';
  address?: string;
  script: string[];
  scriptHex: string;
  btcSatsAmount: number;
  bundles: TransferBundle[];
};

export type UserTransactionSummary = BaseSummary & {
  type: 'user';
  transfers: TransferIOSummary[];
  paymentsAddressReceipts: AggregatedOutputSummary;
  ordinalsAddressReceipts: AggregatedOutputSummary;
  feeOutput: TransactionFeeOutput;
};
