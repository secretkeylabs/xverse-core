import BigNumber from 'bignumber.js';
import { BundleSatRange, UtxoRuneEntry } from './ordinals';

export type ListingBundle<B extends BigNumber | number = BigNumber> = {
  txid: string;
  vout: number;
  block_height?: number;
  value: number;
  sat_ranges: BundleSatRange[];
  runes: UtxoRuneEntry<B>[];
};

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

export type GetRuneMarketDataRequest = {
  marketplaces: Marketplace[];
  rune: TokenId;
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
  successful: boolean;
  marketplace: ListingProvider;
};

export type CreateRuneListingCancellationRequest = {
  btcPublicKey: string;
  ordinalsAddress: string;
  ordinalsPublicKey: string;
  orderIdsPerMarketplace: {
    orderId: string;
    marketplace: Marketplace;
  }[];
};

export type CreateRuneListingCancellationResponse = {
  marketplace: ListingProvider;
  orderId: string;
} & (
  | {
      type: 'withMessage';
      token: string;
      message: string;
    }
  | {
      type: 'withPsbt';
      psbt: string;
    }
);

export type SubmitRuneListingCancellationRequest = {
  cancellationsPerMarketplace: {
    marketplace: Marketplace;
    orderId: string;
    psbt: string;
  }[];
};

export type SubmitRuneListingCancellationResponse = {
  marketplace: ListingProvider;
  successful: boolean;
  txid?: string;
};

export type Listing = {
  location: string;
  balance: number;
  totalPriceSats: number;
  unitPriceSats: number;
  orderId: string;
};
export type ListingWithMarketplace = Listing & { marketplaceName: Marketplace };
export type GetListedUtxosRequest = { address: string; rune: TokenId };
export type GetListedUtxosResponseUtxo = ListingBundle & { listings: ListingWithMarketplace[] };
export type GetListedUtxosResponse = {
  marketplaces: ListingProvider[];
  utxos: { [key: string]: GetListedUtxosResponseUtxo };
};
