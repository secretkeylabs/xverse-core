import AppClient from 'ledger-bitcoin';

export type Transport = ConstructorParameters<typeof AppClient>[0];

export type Bip32Derivation = {
  masterFingerprint: Buffer;
  path: string;
  pubkey: Buffer;
};

export interface TapBip32Derivation extends Bip32Derivation {
  leafHashes: Buffer[];
}

export interface LedgerStxJWTAuthProfile {
  stxAddress: {
    mainnet: string;
    testnet: string;
  };
}
