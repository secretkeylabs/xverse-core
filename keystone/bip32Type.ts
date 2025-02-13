export type Bip32Derivation = {
  masterFingerprint: Buffer;
  path: string;
  pubkey: Buffer;
};

export interface TapBip32Derivation extends Bip32Derivation {
  leafHashes: Buffer[];
}
