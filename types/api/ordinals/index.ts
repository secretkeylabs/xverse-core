import { TransactionData } from '../xverse/transaction';

export interface Inscription {
  id: string;
  number: number;
  address: string;
  genesis_address: string;
  genesis_block_height: number;
  genesis_block_hash: string;
  genesis_tx_id: string;
  genesis_fee: string;
  genesis_timestamp: 0;
  location: string;
  output: string;
  value: string;
  offset: string;
  sat_ordinal: string;
  sat_rarity: string;
  sat_coinbase_height: number;
  mime_type: string;
  content_type?: string;
  content_length: number;
  timestamp: number;
  tx_id: string;
  category?: 'brc-20' | 'sns' | null;
  collection_id?: string | null;
  collection_name?: string | null;
  inscription_floor_price?: number;
}

export interface InscriptionsList {
  limit: number;
  offset: number;
  total: number;
  results: Inscription[];
}

export interface Brc20TxHistoryItem {
  operation: string;
  ticker: string;
  inscription_id: string;
  block_height: number;
  block_hash: string;
  tx_id: string;
  location: string;
  address: string;
  timestamp: number;
  transfer_send?: {
    amount: string;
    from_address: string;
    to_address: string;
  };
  transfer?: {
    amount: string;
    from_address: string;
  };
  deploy?: {
    max_supply: string;
    mint_limit: string;
    decimals: number;
  };
  mint?: {
    amount: string;
  };
}

export interface Brc20HistoryTransactionData extends TransactionData {
  operation: string;
  ticker: string;
  inscription_id: string;
  block_height: number;
  block_hash: string;
  location: string;
  address: string;
  timestamp: number;
  transfer_send?: {
    amount: string;
    from_address: string;
    to_address: string;
  };
  transfer?: {
    amount: string;
    from_address: string;
  };
  deploy?: {
    max_supply: string;
    mint_limit: string;
    decimals: number;
  };
  mint?: {
    amount: string;
  };
}

export interface HiroApiBrc20TxHistoryResponse {
  limit: number;
  offset: number;
  total: number;
  results: Array<Brc20TxHistoryItem>;
}
