export interface BaseWallet {
  stxAddress: string;
  btcAddress: string;
  masterPubKey: string;
  stxPublicKey: string;
  btcPublicKey: string;
  configPrivateKey: string;
  seedPhrase: string;
}
