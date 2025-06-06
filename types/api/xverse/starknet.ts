export interface StarknetTransactionListRequest {
  address: string;
  offset?: number;
  limit?: number;
}

export interface StarknetTransaction {
  transactionHash: string;
  transactionIndex: number;
  blockHash: string;
}

// https://docs.blastapi.io/blast-documentation/apis-documentation/builder-api/starknet/transaction/gettransaction-1
export interface StarknetTransactionListResponse {
  transactions: StarknetTransaction[];
  count: number;
  nextPageKey: string;
}

export interface StarknetTokenBalancesRequest {
  walletAddress: string;
}

// htps://docs.blastapi.io/blast-documentation/apis-documentation/builder-api/starknet/wallet/getwallettokenbalances
export interface StarknetTokenBalance {
  contractAddress: string;
  contractDecimals: string;
  contractName: string;
  contractSymbol: string;
  balance: string;
  blockHash: string;
  blockTimestamp: string;
  transactionHash: string;
  transactionIndex: number;
  logIndex: number;
}

export interface StarknetTokenBalancesResponse {
  walletAddress: string;
  count: number;
  nextPageKey: string;
  tokenBalances: StarknetTokenBalance[];
}
