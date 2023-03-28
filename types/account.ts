export interface Account {
  id: number;
  stxAddress: string;
  btcAddress: string;
  dlcBtcAddress: string;
  dlcBtcPublicKey: string;
  ordinalsAddress: string;
  masterPubKey: string;
  stxPublicKey: string;
  btcPublicKey: string;
  ordinalsPublicKey: string;
  bnsName?: string;
}
