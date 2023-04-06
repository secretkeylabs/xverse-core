import AppClient from 'ledger-bitcoin';

export type Transport = ConstructorParameters<typeof AppClient>[0];

export type Bip32Derivation = {
  masterFingerprint: Buffer;
  path: string;
  pubkey: Buffer;
};
