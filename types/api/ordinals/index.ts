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
  sat_rarity: 'common';
  sat_coinbase_height: number;
  mime_type: 'text/plain';
  content_type: 'text/plain;charset=utf-8';
  content_length: number;
  timestamp: number;
}

export interface InscriptionsList {
  limit: number;
  offset: number;
  total: number;
  results: Inscription[];
}
