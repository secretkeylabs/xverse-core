// branded type to ensure we don't mix up wallet ids with other strings
export type WalletId = string & { [' _walletId']: never };

export type DerivationType = 'account' | 'index';
