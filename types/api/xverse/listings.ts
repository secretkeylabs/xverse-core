export type Marketplace = 'Magic Eden' | 'OKX' | 'Unisat';

export type ListingProvider = {
  code: string;
  name: Marketplace;
  url: string;
  logo: string;
};

export type TokenId = {
  name: string; // UNCOMMON•GOODS
  id: string; // 840000:1 or 1:0
};

export type ListingRuneMarketInfo = {
  floorPrice: string;
  marketplace: ListingProvider;
};

export type CreateRuneListingRequest = {
  rune: string;
  makerRunesPublicKey: string;
  makerRunesAddress: string;
  makerReceiveAddress: string;
  expiresAt: string;
  marketplaces: Marketplace[];
  utxos: Array<{ index: number; location: string; priceSats: number; amount: number }>;
};

export type CreateRuneListingResponse = {
  psbt: string;
  marketplace: ListingProvider;
  batchAuctionId?: string;
};

export type SubmitRuneListingRequest = {
  marketplaceName: string;
  psbtBase64: string;
  batchAuctionId?: string;
  ordinalsPublicKey: string;
  ordinalsAddress: string;
  btcAddress: string;
  rune: TokenId;
  expiresAt: string;
};

export type SubmitRuneListingResponse = {
  successfull: boolean;
  marketplace: ListingProvider;
};
