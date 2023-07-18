// TODO generate these with api schema

export type SponsorInfoResponse = {
  active: boolean;
  sponsor_addresses: string[];
};

export type SponsorTransactionResponse = {
  txid: string;
  rawTx: string;
};

export type SponsorTransactionErrorResponse = {
  status: number;
  message: string;
};
