import { HDKey } from '@scure/bip32';
import BigNumber from 'bignumber.js';
import { ContractCall, TransactionPostCondition, TransactionStatus, TransactionType } from '../shared';
import { StxMempoolTransactionData, TransactionData } from './transaction';

export type StxAddressDataResponse = {
  balance: string;
  locked: string;
  unlock_height: string;
  nonce: number;
};

export type StxAddressData = {
  balance: BigNumber;
  availableBalance: BigNumber;
  locked: BigNumber;
  nonce?: number;
  transactions: Array<TransactionData>;
  totalTransactions?: number;
};

export type StxPendingTxData = {
  pendingTransactions: StxMempoolTransactionData[];
};

export type StxTransactionResponse = {
  limit: number;
  offset: number;
  total: number;
  results: Array<StxTransactionDataResponse>;
};

export type StxTransactionDataResponse = {
  block_hash: string;
  block_height: number;
  burn_block_time: number;
  burn_block_time_iso: string;
  canonical: boolean;
  fee_rate: string;
  nonce: number;
  post_condition_mode: string;
  sender_address: string;
  token_transfer: {
    recipient_address: string;
    amount: string;
    memo: string;
  };
  sponsored: boolean;
  tx_id: string;
  tx_index: number;
  tx_results: string;
  tx_status: TransactionStatus;
  tx_type: TransactionType;
  contract_call?: ContractCall;
  events?: Array<Event>;
  post_conditions?: TransactionPostCondition[];
};

export interface TokenFiatRateResponse {
  tokenFiatRate: number;
}

export type Keychain = {
  childKey: HDKey;
  address: string;
  privateKey: string;
};
