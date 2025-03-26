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
  bestMarketplaceProvider?: Provider;
  from: TokenBasic;
  to: TokenBasic;
  slippageSupported: boolean;
  slippageDecimals?: number;
  slippageThreshold?: number;
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

export type StxQuote = {
  provider: Provider;
  from: TokenBasic;
  to: TokenBasic;
  slippageSupported: boolean;
  slippageDecimals?: number;
  slippageThreshold?: number;
  feePercentage?: string;
  feeFlat?: string;
  identifier?: unknown;
  receiveAmount: string;
};

export type MarketUtxo = {
  identifier: string;
  token: TokenBasic;
  amount: string;
  price: string;
};

export type XcQuote = {
  provider: Provider;
  from: TokenBasic;
  to: TokenBasic;
  slippageSupported: boolean;
  feeFlat: string;
  feePercentage: string;
  receiveAmount: string;
  rate: string;
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
  /** The protocol to swap to. If specified, filters based on available tokens from the protocol. */
  protocol?: Protocol;
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
  /** The user's ordinals address for sats-terminal quotes*/
  ordAddress?: string;
};

export type GetQuotesResponse = {
  /** the list of quotes from AMM providers */
  amm: Quote[];
  /** the list of quotes from UTXO providers */
  utxo: UtxoQuote[];
  /** the list of quotes from STX providers */
  stx: StxQuote[];
  /** the list of quotes from Cross Chain providers */
  xc: XcQuote[];
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
  /** If an identifier was passed in with the request, it should be returned here */
  identifier?: unknown;
  /** The time in milliseconds at which the order expires. */
  expiresInMilliseconds: number | null;
  /** The PSBT that the user needs to sign in order to execute the order */
  psbt: string;
};

export type PlaceStxOrderRequest = {
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
  /** The user's btc address */
  stxAddress: string;
  /** The user's btc address's public key */
  stxPublicKey: string;
  /** If an identifier was passed in with the quote, it should be sent here */
  identifier?: unknown;
};

export type PlaceStxOrderResponse = {
  /** The ID of the order. Should be sent with the execute request if defined. */
  orderId?: string;
  /** The transaction that the user needs to sign in order to execute the order */
  unsignedTransaction: string;
};

export type PlaceXcOrderRequest = {
  /** the code of the provider whose quote is being used */
  providerCode: string;
  /** the base token that the user wants to swap from */
  from: TokenBasic;
  /** the counter token that the user wants to swap to */
  to: TokenBasic;
  /** Number as string. The amount of base tokens that the user wants to swap. */
  sendAmount: string;
  /** The Address that is sending the funds */
  fromAddress: string;
  /** The Address that is receiving the funds */
  receiveAddress: string;
};

export type PlaceXcOrderResponse = {
  /** The ID of the order. */
  orderId: string;
  /** Address for a user to send coins to. */
  payinAddress: string;
  /** Transacion status. Will always be `new` when the tx is created. Usually becomes `waiting` after */
  status: XcTransactionStatus;
};

export type ExecuteOrderRequest = {
  /** the code of the provider whose quote is being used */
  providerCode: string;
  /** The ID of the order if it was returned with the place order response */
  orderId?: string;
  /** If an identifier was passed in with the PlaceOrder, it should be sent here */
  identifier?: unknown;
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

export type ExecuteStxOrderRequest = {
  /** the code of the provider whose quote is being used */
  providerCode: string;
  /** The ID of the order if it was returned with the place order response */
  orderId?: string;
  /** The signed transaction from the place order response */
  signedTransaction: string;
};

export type ExecuteStxOrderResponse = {
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
  orderId?: string;
  /** The PSBT that the user needs to sign in order to execute the order */
  psbt: string;
  /**
   * The orders/listings which were successfully added to the PSBT.
   * It will either be the full list from the request or a subset if some orders were already taken.
   * */
  orders: Omit<MarketUtxo, 'token'>[];
  /** The service fee for the order */
  serviceFee: string;
};

export type ExecuteUtxoOrderRequest = {
  /** the code of the provider whose quote is being used */
  providerCode: string;
  /** The ID of the order if it was returned with the place order response */
  orderId?: string;
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

export type GetOrderHistoryRequest = {
  /** the code of the provider whose quote is being used */
  providerCode: string;
  /** payout address. maximum length is 10 */
  payoutAddress: string[];
  /** payin address. maximum length is 10 */
  address?: string[];
  /** Number of records to retrieve. The maximum limit is 100. By default, 10. */
  limit?: number;
  /** Records cursor. */
  offset?: number;
};

export type GetOrderHistoryResponse = {
  /** The ID of the order */
  id: string;
  /** Time in timestamp format (microseconds) when the transaction was created */
  createdAt: string;
  /** Type of transaction. must be either float or fixed */
  type: 'float' | 'fixed';
  /** Number of confirmations */
  payinConfirmations: string;
  /** exchanged rate */
  rate: string;
  /** transaction status */
  status: XcTransactionStatus;
  /** Payin currency ticker */
  currencyFrom: string;
  /** Payout currency ticker */
  currencyTo: string;
  /** Address where the payment is being made */
  payinAddress: string;
  /** Address where the exchange result will be sent to. */
  payoutAddress: string;
  /** expected pay-in amount determined after placing order */
  amountExpectedFrom: string;
  /** expected pay-out amount determined after placing order */
  amountExpectedTo: string;
  /** Actual pay-in amount */
  amountFrom: string;
  /** Actual amount sent to `payoutAddress` */
  amountTo: string;
  /** Total fee in pay-out currency. */
  fee: string;
}[];

export enum XcTransactionStatus {
  New = 'new',
  Waiting = 'waiting',
  Confirming = 'confirming',
  Exchanging = 'exchanging',
  Sending = 'sending',
  Finished = 'finished',
  Failed = 'failed',
  Refunded = 'refunded',
  Hold = 'hold', // AML/KYC issues
  Overdue = 'overdue', // floating rate tx not sent within timeframe
  Expired = 'expired', // fixed rate tx not sent within timeframe
  // Add other statuses as needed
}
