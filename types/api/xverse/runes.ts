import { UtxoOrdinalBundleApi } from './ordinals';

export type RuneSellRequest = {
  side: 'sell';
  rune: string;
  makerRunesPublicKey: string;
  makerRunesAddress: string;
  makerReceiveAddress: string;
  utxos: Array<{ location: string; priceSats: number }>;
  expiresAt: string;
};

export type RuneSellResponse = {
  orderPsbtBase64: string;
};

export type SubmitRuneSellRequest = {
  side: 'sell';
  signedPsbtBase64: string;
  symbol: string;
  makerRunesPublicKey: string;
  makerRunesAddress: string;
  makerReceiveAddress: string;
  expiresAt: string;
};

export type SubmitRunesSellResponse = {
  orderIds: string[];
};

export type CancelOrderRequest = {
  orderIds: string[];
  makerAddress: string;
  makerPublicKey: string;
};

export type CancelOrderResponse = {
  orderIds: string[];
  token: string;
  message: string;
};

export type SubmitCancelOrderRequest = {
  signature: string;
  orderIds: string[];
  makerAddress: string;
  makerPublicKey: string;
  token: string;
};

export type SubmitCancelOrderResponse = {
  orderIds: string[];
};

export type GetRunesUtxosParams = {
  rune: string;
  sort?: 'balanceAsc' | 'balanceDesc';
  includeListed?: boolean;
};

export type GetRunesUtxoItem = UtxoOrdinalBundleApi & {
  listing: Array<{
    orderId: string;
    totalPriceSats: number;
    unitPriceSats: number;
    formattedUnitPriceSats: string;
    expiresAt: string;
    source: string;
  }>;
};

export type GetRunesUtxosResponse = Array<GetRunesUtxoItem>;

type FloorUnitPrice = {
  formatted: string;
  value: string;
};

type Volume = {
  '24h': number;
  '7d': number;
  '30d': number;
};

export type RuneMarketInfo = {
  rune: string;
  ticker: string;
  totalSupply: string;
  formattedTotalSupply: string;
  divisibility: number;
  imageURI: string;
  description: string;
  discordLink: string;
  twitterLink: string;
  minOrderSize: number;
  maxOrderSize: number;
  pendingTxnCount: number;
  floorUnitPrice: FloorUnitPrice;
  marketCap: number;
  volume: Volume;
};
