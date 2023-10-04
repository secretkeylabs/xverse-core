import { Inscription } from '../ordinals';

export interface OrdinalInfo {
  inscriptionNumber: string;
  metadata: Record<string, string>;
}

export interface CollectionMarketDataResponse {
  collection_id: string;
  collection_name: string;
  floor_price: number;
  floor_change_24h: number;
}

export type CondensedInscription = Pick<Inscription, 'id' | 'content_type'>;

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

export type SatRarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary' | 'mythic';

export type BundleRareSat = {
  number: string;
  rarity_ranking: SatRarity;
  offset: number;
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
  sats: BundleRareSat[];
  inscriptions: BundleInscription[];
};
