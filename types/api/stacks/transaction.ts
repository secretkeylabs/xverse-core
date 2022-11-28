import {
  TransactionType,
  TransactionStatus,
  TransactionPostCondition,
  ContractCall,
} from '../shared/transaction';
import { ClarityValue, cvToHex, PostCondition, StacksTransaction, TokenTransferPayload, uintCV } from '@stacks/transactions';
import { SettingsNetwork, StxMempoolTransactionData } from 'types/network';
export { cvToHex, uintCV, StacksTransaction, TokenTransferPayload };

export type UnsignedStacksTransation = {
  amount: string,
  senderAddress: string,
  recipientAddress: string,
  contractAddress: string,
  contractName: string,
  assetName: string,
  publicKey: string,
  network: SettingsNetwork,
  pendingTxs: StxMempoolTransactionData[],
  memo?: string,
  isNFT?: boolean,
}

export type UnsignedContractCallTransaction = {
  publicKey: string,
  contractAddress: string,
  contractName: string,
  functionName: string,
  functionArgs: ClarityValue[],
  network: SettingsNetwork,
  nonce?: bigint,
  postConditions: PostCondition[],
  sponsored?: boolean,
  postConditionMode?: number
}

export type StxMempoolResponse = {
  limit: number;
  offset: number;
  total: number;
  results: Array<StxMempoolTransactionDataResponse>;
};

export type StxMempoolTransactionDataResponse = {
  receipt_time: number;
  receipt_time_iso: string;
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
  tx_status: TransactionStatus;
  tx_type: TransactionType;
  contract_call?: ContractCall;
  post_conditions?: TransactionPostCondition[];
};

export type TransferTransactionArrayObject = {
  tx: TransferTransaction;
};

export type TransferTransactionsData = {
  limit: number;
  offset: number;
  total: number;
  results: Array<TransferTransactionArrayObject>;
};

export type TransferTransaction = {
  tx_id: string;
  nonce: number;
  fee_rate: number;
  sender_address: string;
  sponsored: boolean;
  post_condition_mode: string;
  post_conditions: Array<TransactionPostCondition>;
  anchor_mode: string;
  is_unanchored: string;
  block_hash: string;
  parent_block_hash: string;
  block_height: number;
  burn_block_time: number;
  burn_block_time_iso: string;
  parent_burn_block_time: number;
  parent_burn_block_time_iso: string;
  canonical: boolean;
  tx_index: number;
  tx_status: TransactionStatus;
  tx_result: {
    hex: string;
    repr: string;
  };
  microblock_hash: string;
  microblock_sequence: number;
  microblock_canonical: boolean;
  event_count: number;
  execution_cost_read_count: number;
  execution_cost_read_length: number;
  execution_cost_runtime: number;
  execution_cost_write_count: number;
  execution_cost_write_length: number;
  tx_type: TransactionType;
  contract_call: ContractCall;
  stx_sent: string;
  stx_received: string;
  ft_transfers: Array<Transfer>;
  nft_transfers: Array<Transfer>;
};

export type Transfer = {
  asset_identifier: string;
  amount: string;
  sender: string;
  recipient: string;
};

export type FungibleToken = {
  name: string;
  balance: string;
  total_sent: string;
  total_received: string;
  principal: string;
  assetName: string;
  ticker?: string;
  decimals?: number;
  image?: string;
  visible?: boolean;
  supported?: boolean;
  tokenFiatRate?: number | null;
};

export type StxBalance = {
  balance: string;
  total_sent: string;
  total_received: string;
  total_fees_sent: string;
  total_miner_rewards_received: string;
  lock_tx_id: string;
  locked: string;
  lock_height: number;
  burnchain_lock_height: number;
  burnchain_unlock_height: number;
};

export type TokensResponse = {
  stx: StxBalance;
  fungible_tokens: any;
  non_fungible_tokens: any;
};
export interface Transaction {
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
  error?: string;
}
export interface PostConditionsOptions {
  contractAddress: string;
  contractName: string;
  assetName: string;
  stxAddress: string;
  amount: string | number;
}

export interface Args {
  name: string;
  type: string;
}
export interface Output {
  type: Output;
}
export interface ContractFunction {
  name: string;
  access: string;
  args: Args[];
  output: Output;
}

export interface ContractInterfaceResponse {
  functions: ContractFunction[];
}

