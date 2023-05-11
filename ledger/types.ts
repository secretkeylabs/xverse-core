import { StacksNetwork } from '@stacks/network';
import { AnchorMode } from '@stacks/transactions';
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

export type TxPayload = {
  recipient: string;
  memo: string | undefined;
  amount: string;
  network: StacksNetwork | undefined;
  anchorMode: AnchorMode;
};

export type UnsignedArgs = {
  txData: TxPayload;
  publicKey: string;
  fee: number | string;
  nonce?: number;
};

export interface LedgerStxJWTAuthProfile {
  stxAddress: {
    mainnet: string;
    testnet: string;
  };
}
