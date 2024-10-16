export type AccountType = 'ledger' | 'software';

export type BtcPaymentType = 'nested' | 'native';

export type BtcAddressType = 'nested' | 'native' | 'taproot';

export type BtcAddress = {
  address: string;
  publicKey: string;
};

export type AccountBtcAddresses = {
  nested?: BtcAddress;
  native?: BtcAddress;
  taproot: BtcAddress;
};

export type Account = {
  id: number;
  deviceAccountIndex?: number;
  masterPubKey: string;
  accountType: AccountType;
  accountName?: string;

  stxAddress: string;
  stxPublicKey: string;
  bnsName?: string;

  btcAddresses: AccountBtcAddresses;
};
