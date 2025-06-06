import Transport from '@ledgerhq/hw-transport';

export type LedgerTransport = Transport;

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

export enum LedgerErrors {
  NO_PUBLIC_KEY = 'No public key returned from Ledger device',
}
