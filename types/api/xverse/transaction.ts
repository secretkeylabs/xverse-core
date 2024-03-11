import BigNumber from 'bignumber.js';
import { TokenType, TransactionType, TransactionStatus, ContractCall, TransactionPostCondition } from '../shared';

export type TransactionData = {
  txid: string;
  amount: BigNumber;
  seenTime: Date;
  incoming: boolean;
  txType: TransactionType;
  txStatus: TransactionStatus;
  contractCall?: ContractCall;
  post_conditions?: Array<TransactionPostCondition>;
  tokenType?: TokenType;
  tokenName?: string;
  recipientAddress?: string;
  memo?: string;
  cycles?: string;
  rewardAddress?: string;
  poolPoxAddress?: string;
  untilBurnHt?: string;
  poolContractAddress?: string;
  poolContractName?: string;
  assetId?: string;
};

export type StxTransactionListData = {
  transactionsList: Array<StxTransactionData>;
  totalCount: number;
};

export interface StxTransactionData extends TransactionData {
  blockHash: string;
  blockHeight: number;
  burnBlockTime: number;
  burnBlockTimeIso: Date;
  canonical: boolean;
  fee: BigNumber;
  nonce: number;
  postConditionMode: string;
  senderAddress: string;
  tokenTransfer?: {
    recipientAddress: string;
    amount: BigNumber;
    memo: string;
  };
  sponsored: boolean;
  txid: string;
  txIndex: number;
  txResults: string;
  txStatus: TransactionStatus;
  txType: TransactionType;
  seenTime: Date;
}

export interface StxMempoolTransactionData extends TransactionData {
  receiptTime: number;
  receiptTimeIso: Date;
  fee: BigNumber;
  nonce: number;
  postConditionMode: string;
  senderAddress: string;
  tokenTransfer?: {
    recipientAddress: string;
    amount: BigNumber;
    memo: string;
  };
  sponsored: boolean;
  txid: string;
  txStatus: TransactionStatus;
  txType: TransactionType;
  seenTime: Date;
}

export type StxMempoolTransactionListData = {
  transactionsList: Array<StxMempoolTransactionData>;
  totalCount: number;
};

export type BtcFeeResponse = {
  limits: {
    min: number;
    max: number;
  };
  regular: number;
  priority: number;
};
export interface FeesMultipliers {
  stxSendTxMultiplier: number;
  poolStackingTxMultiplier: number;
  otherTxMultiplier: number;
}

export interface AppInfo {
  stxSendTxMultiplier: number;
  poolStackingTxMultiplier: number;
  otherTxMultiplier: number;
  thresholdHighSatsFee: number;
  thresholdHighSatsPerByteRatio: number;
  thresholdHighStacksFee: number;
}
