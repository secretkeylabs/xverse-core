import { Inscription } from '../ordinals';

export interface OrdinalInfo {
  inscriptionNumber: string;
  metadata: Record<string, string>;
}

export interface CollectionMarketDataResponse {
  collection_id: string;
  collection_name?: string;
  floor_price?: number;
  floor_change_24h?: number;
}

export type CondensedInscription = Pick<Inscription, 'id' | 'content_type' | 'number'>;

export interface InscriptionCollectionsData {
  collection_id: string | null;
  collection_name: string | null;
  category: 'brc-20' | 'sns' | null;
  total_inscriptions: number;
  thumbnail_inscriptions?: Array<CondensedInscription>;
}
export interface CollectionsList {
  limit: number;
  offset: number;
  total: number;
  results: Array<InscriptionCollectionsData>;
}

export interface InscriptionInCollectionsList {
  limit: number;
  offset: number;
  total: number;
  collection_name: string;
  portfolio_value: number;
  data: Array<Inscription>;
}

export type Satribute =
  | 'UNCOMMON'
  | 'RARE'
  | 'EPIC'
  | 'LEGENDARY'
  | 'MYTHIC'
  | 'ALPHA'
  | 'BLOCK78'
  | 'FIRST_TRANSACTION'
  | 'PIZZA'
  | 'VINTAGE'
  | 'BLACK_UNCOMMON'
  | 'BLACK_RARE'
  | 'BLACK_EPIC'
  | 'BLACK_LEGENDARY'
  | 'BLOCK9'
  | 'JPEG'
  | 'OMEGA'
  | 'FIBONACCI'
  | 'HITMAN'
  | 'NAKAMOTO'
  | 'SILK_ROAD'
  | 'PALINDROME'
  | '1D_PALINDROME'
  | '2D_PALINDROME'
  | '3D_PALINDROME'
  | 'PALIBLOCK_PALINDROME'
  | 'PERFECT_PALINCEPTION'
  | 'SEQUENCE_PALINDROME'
  | 'NAME_PALINDROME';

export type BundleSatRange = {
  year_mined: number;
  block: number;
  offset: number;
  range: {
    start: string;
    end: string;
  };
  satributes: Satribute[];
  inscriptions: {
    content_type: string;
    id: string;
  }[];
};

export type BundleInscription = {
  id: string;
  offset: number;
  content_type: string;
};

export type UtxoOrdinalBundle = {
  txid: string;
  vout: number;
  block_height: number;
  value: number;
  sat_ranges: BundleSatRange[];
};
