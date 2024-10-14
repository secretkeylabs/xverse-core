export type AccountType = 'ledger' | 'keystone' | 'software';

export interface Account {
  id: number;
  stxAddress: string;
  btcAddress: string;
  ordinalsAddress: string;
  masterPubKey: string;
  stxPublicKey: string;
  btcPublicKey: string;
  ordinalsPublicKey: string;
  btcXpub?: string;
  ordinalsXpub?: string;
  bnsName?: string;
  accountType?: AccountType;
  accountName?: string;
  deviceAccountIndex?: number;
}

export type NotificationBanner = {
  id: string;
  name: string;
  url: string;
  icon: string;
  description: string;
};
