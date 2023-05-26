export interface Account {
  id: number;
  stxAddress: string;
  btcAddress: string;
  mainBtcAddress: string;
  mainBtcPublicKey: string;
  ordinalsAddress: string;
  masterPubKey: string;
  stxPublicKey: string;
  btcPublicKey: string;
  ordinalsPublicKey: string;
  bnsName?: string;
}
