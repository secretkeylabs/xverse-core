export type TokenMetaData = {
  image_url: string;
  image_type: string;
  image_protocol: string;
  asset_url: string;
  asset_type: string;
  asset_protocol: string;
  asset_id: string;
  name: string;
  contract_id: string;
};

export type Attribute = {
  value: string;
  trait_type: string;
};

export type NftData = {
  asset_id: string;
  collection_contract_id: string;
  token_id: number;
  fully_qualified_token_id: string;
  token_metadata: TokenMetaData;
  nft_token_attributes: Attribute[];
  rarity_rank: string;
  collection_count: number;
  rarity_score: string;
};

export type NftDetailResponse = {
  result: boolean;
  data: NftData;
  isCompliant?: boolean;
};
