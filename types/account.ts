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

export interface Account extends OldAccount {
  isLedgerAccount?: boolean;
  accountName?: string;
}
