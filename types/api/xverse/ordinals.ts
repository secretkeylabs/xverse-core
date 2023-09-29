export interface OrdinalInfo {
  inscriptionNumber: string;
  metadata: Record<string, string>;
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
