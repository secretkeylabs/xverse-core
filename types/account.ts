export interface Account {
    id: number;
    stxAddress: string;
    btcAddress: string;
    dlcBtcAddress: string;
    masterPubKey: string;
    stxPublicKey: string;
    btcPublicKey: string;
    bnsName?: string;
  }
