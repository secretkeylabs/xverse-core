export type Protocol = 'runes' | 'brc20' | 'sip10' | 'btc' | 'stx';

export type Provider = {
  code: string;
  name: string;
  url: string;
  logo: string;
};

export type TokenBasic = {
  /**
   * The ticker of the token. This should be unique across all tokens per protocol.
   *
   * These are the expected formats for each protocol:
   * btc: "BTC"
   * stx: "STX"
   * brc20: the brc-20 ticker
   * runes: the rune id
   */
  ticker: string;
  protocol: Protocol;
};

export type Token = TokenBasic & {
  logo?: string;
  name?: string;
  symbol?: string;
  divisibility: number;
};

export type Quote = {
  provider: Provider;
  from: TokenBasic;
  to: TokenBasic;
  slippageSupported: boolean;
  feePercentage?: string;
  feeFlat?: string;
  identifier?: unknown;
  receiveAmount: string;
};

export type UtxoQuote = {
  provider: Provider;
  from: TokenBasic;
  to: TokenBasic;
  floorRate: string;
  feePercentage?: string;
  feeFlat?: string;
};

export type MarketUtxo = {
  identifier: string;
  token: TokenBasic;
  amount: string;
  price: string;
};

export type GetSourceTokensRequest = {
  /** a list of tokens that the user has in their wallet */
  userTokens: TokenBasic[];
  /** the token that the user wants to swap to */
  to?: TokenBasic;
};

export type GetDestinationTokensRequest = {
  /** a list of tokens that the user has in their wallet */
  userTokens: TokenBasic[];
  /** The protocol to swap to */
  protocol: Protocol;
  /** the token that the user wants to swap from. If specified, this should be one of the userTokens. */
  from?: TokenBasic;
  /** a string which should be used to filter the destination tokens */
  search?: string;
};

export type GetDestinationTokensResponse = {
  /** the list of possible tokens for the user to swap to */
  items: Token[];
};

export type GetQuotesRequest = {
  /** the base token that the user wants to swap from */
  from: TokenBasic;
  /** the counter token that the user wants to swap to */
  to: TokenBasic;
  /** Number as string. The amount of base tokens that they want to swap. */
  amount: string;
};

export type GetQuotesResponse = {
  /** the list of quotes from AMM providers */
  amm: Quote[];
  /** the list of quotes from UTXO providers */
  utxo: UtxoQuote[];
};

export type GetUtxosRequest = {
  /** the code of the provider whose quote is being used */
  providerCode: string;
  /** the base token that the user wants to swap from */
  from: TokenBasic;
  /** the counter token that the user wants to swap to */
  to: TokenBasic;
  /** Number as string. The amount of base tokens that the user wants to swap. */
  amount: string;
};

export type GetUtxosResponse = {
  /** the list of UTXO listings available for the user to purchase */
  items: MarketUtxo[];
};

export type PlaceOrderRequest = {
  /** the code of the provider whose quote is being used */
  providerCode: string;
  /** the base token that the user wants to swap from */
  from: TokenBasic;
  /** the counter token that the user wants to swap to */
  to: TokenBasic;
  /** Number as string. The amount of base tokens that the user wants to swap. */
  sendAmount: string;
  /** Number as string. The amount of counter tokens that the user expects back. */
  receiveAmount: string;
  /** The allowable slippage percentage. Should be a whole number from 0-100. */
  slippage: number;
  /** The fee rate to use for the swap transaction */
  feeRate: number;
  /** The user's btc address */
  btcAddress: string;
  /** The user's btc address's public key */
  btcPubKey: string;
  /** The user's ordinals address */
  ordAddress: string;
  /** The user's ordinals address's public key */
  ordPubKey: string;
  /** If an identifier was passed in with the quote, it should be sent here */
  identifier?: unknown;
};

export type PlaceOrderResponse = {
  /** The ID of the order. Should be sent with the execute request if defined. */
  orderId?: string;
  /** The PSBT that the user needs to sign in order to execute the order */
  psbt: string;
};

export type ExecuteOrderRequest = {
  /** the code of the provider whose quote is being used */
  providerCode: string;
  /** The ID of the order if it was returned with the place order response */
  orderId?: string;
  /** The signed PSBT from the place order response */
  psbt: string;
  /** The user's btc address */
  btcAddress: string;
  /** The user's btc address's public ke. */
  btcPubKey: string;
  /** The user's ordinals address */
  ordAddress: string;
  /** The user's ordinals address's public key */
  ordPubKey: string;
};

export type ExecuteOrderResponse = {
  /** The transaction ID of the executed swap */
  txid: string;
};

export type PlaceUtxoOrderRequest = {
  /** the code of the provider whose quote is being used */
  providerCode: string;
  /** the base token that the user wants to swap from */
  from: TokenBasic;
  /** the counter token that the user wants to swap to */
  to: TokenBasic;
  /** The identifier of the listings being requested for purchase */
  orders: Omit<MarketUtxo, 'token'>[];
  /** The fee rate to use for the swap transaction */
  feeRate: number;
  /** The user's btc address */
  btcAddress: string;
  /** The user's btc address's public key */
  btcPubKey: string;
  /** The user's ordinals address */
  ordAddress: string;
  /** The user's ordinals address's public key */
  ordPubKey: string;
};

export type PlaceUtxoOrderResponse = {
  /** The ID of the order. Should be sent with the execute request if defined. */
  orderID?: string;
  /** The PSBT that the user needs to sign in order to execute the order */
  psbt: string;
  /**
   * The orders/listings which were successfully added to the PSBT.
   * It will either be the full list from the request or a subset if some orders were already taken.
   * */
  validOrders: Omit<MarketUtxo, 'token'>[];
};

export type ExecuteUtxoOrderRequest = {
  /** the code of the provider whose quote is being used */
  providerCode: string;
  /** The ID of the order if it was returned with the place order response */
  orderID?: string;
  /** The signed PSBT from the place order response */
  psbt: string;
  /**
   * The orders/listings which were successfully added to the PSBT.
   * This would have been returned with the place order response.
   * */
  orders: Omit<MarketUtxo, 'token'>[];
  /** The user's btc address */
  btcAddress: string;
  /** The user's btc address's public ke. */
  btcPubKey: string;
  /** The user's ordinals address */
  ordAddress: string;
  /** The user's ordinals address's public key */
  ordPubKey: string;
};

export type ExecuteUtxoOrderResponse = {
  /** The transaction ID of the executed swap */
  txid: string;
};
