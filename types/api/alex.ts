export type AlexSupportedFungibleToken = {
  type: 'fungibleToken';
  id: string;
  displayPrecision: number;
  icon: string;
  availableInSwap: boolean;
  contractAddress: string;
  decimals: number;
};

// extend supported types here with |
export type AlexSupportedToken = AlexSupportedFungibleToken;

export type AlexTokenListResponse = AlexSupportedToken[];
