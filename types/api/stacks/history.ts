import { Transaction } from './transaction';

export type NonFungibleTokenHistoryEvent =
  | NonFungibleTokenHistoryEventWithTxId
  | NonFungibleTokenHistoryEventWithTxMetadata;

export interface NonFungibleTokenHistoryEventWithTxId {
  sender?: string;
  recipient?: string;
  event_index: number;
  asset_event_type: string;
  tx_id: string;
}

export interface NonFungibleTokenHistoryEventWithTxMetadata {
  sender?: string;
  recipient?: string;
  event_index: number;
  asset_event_type: string;
  tx: Transaction;
}

export interface NftHistoryResponse {
  limit: number;
  offset: number;
  total: number;
  results: NonFungibleTokenHistoryEvent[];
}
