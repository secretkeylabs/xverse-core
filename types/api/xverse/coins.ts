export interface Coin {
    id?: number;
    name: string;
    ticker: string;
    contract: string;
    description?: string;
    image?: string;
    decimals?: number;
    supported?: boolean;
    tokenFiatRate?: number | null;
    visible?: boolean;
  }

  export interface SignedUrlResponse {
    signedUrl: string;
  }
  
export type CoinsResponse = Coin[];