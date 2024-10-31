// This module contains utilities to work with account IDs. Notably, the IDs are
// generated using the master public key, making them unique across seeds.
//
// The IDs are branded with the intention of preventing random strings from
// being used as IDs. If branding proves be inconvenient, it can be removed.

import { sha256 } from '@noble/hashes/sha256';
import { bytesToHex } from '@noble/hashes/utils';
import * as v from 'valibot';
import { Account, NetworkType } from '../../types';

export type MakeAccountIdOptions = {
  masterPubKey: Account['masterPubKey'];
  accountId: Account['id'];
  networkType: NetworkType;
};

export const accountIdBrandName = 'AccountId';

export const accountIdSchema = v.pipe(v.string(), v.brand(accountIdBrandName));

export type AccountId = v.InferOutput<typeof accountIdSchema>;

export function makeAccountId(options: MakeAccountIdOptions) {
  return v.parse(
    accountIdSchema,
    bytesToHex(
      sha256(
        `account-${options.masterPubKey}-${
          // NOTE: This "account ID" is actually the ~account~ address index from BIP-44.
          options.accountId
        }-${options.networkType}`,
      ),
    ),
  );
}
