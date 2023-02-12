export interface Account {
    id: number;
    stxAddress: string;
    btcAddress: string;
    ordinalsAddress: string;
    masterPubKey: string;
    stxPublicKey: string;
    btcPublicKey: string;
    bnsName?: string;
  }