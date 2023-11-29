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
  total_inscriptions: number;
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

export const RodarmorRareSats = ['MYTHIC', 'LEGENDARY', 'EPIC', 'RARE', 'UNCOMMON', 'COMMON'] as const;
export type RodarmorRareSatsType = (typeof RodarmorRareSats)[number];

export const Satributes = [
  'BLACK_LEGENDARY',
  'BLACK_EPIC',
  'BLACK_RARE',
  'BLACK_UNCOMMON',
  'FIBONACCI',
  '1D_PALINDROME',
  '2D_PALINDROME',
  '3D_PALINDROME',
  'SEQUENCE_PALINDROME',
  'PERFECT_PALINCEPTION',
  'PALIBLOCK_PALINDROME',
  'PALINDROME',
  'NAME_PALINDROME',
  'ALPHA',
  'OMEGA',
  'FIRST_TRANSACTION',
  'BLOCK9',
  'BLOCK78',
  'NAKAMOTO',
  'VINTAGE',
  'PIZZA',
  'JPEG',
  'HITMAN',
  'SILK_ROAD',
] as const;
export type SatributesType = (typeof Satributes)[number];

// ({} & string) is a workaround to support our types and also allow any string for unsupported types
// eslint-disable-next-line @typescript-eslint/ban-types
export type RareSatsType = RodarmorRareSatsType | SatributesType | ({} & string);

export type SatRangeInscription = Pick<Inscription, 'id' | 'content_type'> & { inscription_number: number };

export type SatRange = {
  range: {
    start: string;
    end: string;
  };
  year_mined: number;
  block: number;
  offset: number;
  satributes: RareSatsType[];
  inscriptions: SatRangeInscription[];
};

export type UtxoOrdinalBundle = {
  txid: string;
  vout: number;
  block_height: number;
  value: number;
  sat_ranges: SatRange[];
};

export type XVersion = {
  xVersion: number;
};

export type AddressBundleResponse = {
  total: number;
  offset: number;
  limit: number;
  results: UtxoOrdinalBundle[];
} & XVersion;

export type UtxoBundleResponse = UtxoOrdinalBundle & XVersion;

export type BundleSatRange = Omit<SatRange, 'year_mined'> & {
  totalSats: number;
  yearMined: number;
};

export type Bundle = Omit<UtxoOrdinalBundle, 'sat_ranges'> & {
  satRanges: BundleSatRange[];
  inscriptions: SatRangeInscription[];
  satributes: RareSatsType[][];
  totalExoticSats: number;
};
