export interface OldAccount {
  id: number;
  stxAddress: string;
  btcAddress: string;
  ordinalsAddress: string;
  masterPubKey: string;
  stxPublicKey: string;
  btcPublicKey: string;
  ordinalsPublicKey: string;
  bnsName?: string;
}

export type AccountType = 'ledger' | 'software';
export interface Account extends OldAccount {
  accountType?: AccountType;
  accountName?: string;
}
