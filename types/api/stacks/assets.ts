import { cvToJSON, hexToCV } from "@stacks/transactions";
import { hexToString } from "../../helper";
import { BtcOrdinal } from "../blockcypher/wallet";

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

export interface BnsNamesResponse {
  names: string[];
}

export interface BnsNameDataResponse {
  address: string;
  blockchain: string;
  expire_block: number;
  last_txid: string;
  status: string;
  zonefile: string;
  zonefile_hash: string;
}

export interface PoxData {
  contract_id: string;
  first_burnchain_block_height: number;
  min_amount_ustx: string;
  prepare_cycle_length: number;
  rejection_fraction: number;
  reward_cycle_id: number;
  rejection_votes_left_required: string;
  total_liquid_supply_ustx: string;
  next_reward_cycle_in: number;
}

export interface DelegationInfo {
  delegated: boolean;
  amount?: string;
  delegatedTo?: string;
  untilBurnHeight?: number;
}

export interface CoreInfo {
  burn_block_height: number;
  stable_burn_block_height: number;
  stacks_tip_height: number;
  stacks_tip: string;
}

export function getBnsNftName(nft: NonFungibleToken) {
  const hex = nft.value.hex;
  const cv = cvToJSON(hexToCV(hex));
  const nameValue = cv.value?.name?.value ?? '';
  const nameSpaceValue = cv.value?.namespace?.value ?? '';

  return nameValue && nameSpaceValue
    ? `${hexToString(nameValue)}.${hexToString(nameSpaceValue)}`
    : '';
}