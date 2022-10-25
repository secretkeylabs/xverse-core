export interface Attribute {
  value: string;
  trait_type: string;
}

export interface TokenMetaData {
  image_url: string;
  image_type: string;
  image_protocol: string;
  asset_url: string;
  asset_type: string;
  asset_protocol: string;
  asset_id: string;
  name: string;
  contract_id: string;
}

export interface NftData {
  asset_id: string;
  collection_contract_id: string;
  token_id: number;
  fully_qualified_token_id: string;
  token_metadata: TokenMetaData;
  nft_token_attributes: Attribute[];
  rarity_rank: string;
  collection_count: number;
  rarity_score: string;
}

interface NftIdValue {
  hex: string;
  repr: string;
}

export interface NonFungibleToken {
  asset_identifier: string;
  value: NftIdValue;
  tx_id: string;
  data?: NftData | null;
  name?: string;
}

export type AccountAssetsListData = {
  assetsList: Array<NonFungibleToken>;
  totalCount: number;
};

export type NftsListData = {
  nftsList: Array<NonFungibleToken>;
  total: number;
};

export interface NftEventsResponse {
  results: NonFungibleToken[];
  total: number;
  limit: number;
  offset: number;
}
