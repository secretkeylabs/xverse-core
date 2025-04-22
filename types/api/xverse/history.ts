import BigNumber from 'bignumber.js';

// API Types
export type ApiAddressTransaction = {
  txid: string;
  blockHeight: number;
  blockTime: number;

  ownActivity: BtcOwnAddressActivity[];
  totalOut: number;
  totalIn: number;

  addressList: {
    hasMore: boolean;
    items: AddressDestination[];
  };

  runes: RunesActivity;
  inscriptions: PartialInscriptionEvents;
};

export type RunesActivity = {
  ownActivity: RunesOwnActivity;
  allActivity: RunesAllActivity;
};

export type BtcOwnAddressActivity = {
  address: string;
  sent: number;
  received: number;
  outgoing: number;
  incoming: number;
};

export type RunesAllEvent = {
  runeId: string;
  outgoing: string;
  incoming: string;
  isMint: boolean;
  isEtch: boolean;
  isBurn: boolean;
};

export type AddressDestination = {
  address?: string;
  type: string;
  isInput: boolean;
  isOutput: boolean;
};

export type RunesAllActivity = {
  items: RunesAllEvent[];
  hasMore: boolean;
};

export type RunesOwnActivity = {
  items: RuneIO[];
  hasMore: boolean;
};

export type PartialInscriptionEvents = {
  items: InscriptionEvent[];
  hasMore: boolean;
};

export type RuneIO = {
  runeId: string;
  address: string;
  sent: string;
  received: string;
  outgoing: string;
  incoming: string;
};

export type InscriptionEvent = {
  inscriptionId: string;
  contentType?: string;
  address: string;
  sent: boolean;
  received: boolean;
  inscribed: boolean;
  burned: boolean;
};

export type ApiAddressHistoryResult = {
  transactions: ApiAddressTransaction[];
  offset: number;
  limit: number;
};

// Enhanced Types
export type EnhancedRunesOwnActivity = {
  items: EnhancedRuneIO[];
  hasMore: boolean;
};

export type RuneInfo = {
  symbol: string;
  name: string;
  divisibility: BigNumber;
  inscriptionId: string;
};

export type EnhancedRuneIO = RuneIO & Partial<RuneInfo>;

// The way the enhanced tx works is by having a single tx type for different assets
// Which allows clients to handle different ui based in the transfer direction by each asset
// Depending on the asset type, the schema changes a bit to accommodate the different needs of each asset

export type AssetInTx = 'btc' | 'inscriptions' | 'runes' | 'multipleAssets';

export type BaseTxType = 'send' | 'receive';

export type BtcTxType = BaseTxType | 'consolidate';

export type InscriptionTxType = BaseTxType | 'inscribe' | 'burn' | 'trade';

export type RunesTxType = BaseTxType | 'mint' | 'mintBurn' | 'etch' | 'burn' | 'consolidate' | 'trade';

export type MultipleAssetsTxType = BaseTxType | 'burn' | 'trade' | 'etch';

export type EnhancedTx = {
  id: string;
  fees: number;
  satsAmount: number;
  addressesInTx: {
    hasMore: boolean;
    external: AddressDestination[];
    isOwnTaproot: boolean;
    isOwnNested: boolean;
    isOwnNative: boolean;
  } | null;
  blockHeight: number;
  blockTime: number;
} & (
  | { assetInTx: 'btc'; txType: BtcTxType }
  | { assetInTx: 'inscriptions'; txType: InscriptionTxType; inscriptions: PartialInscriptionEvents }
  | { assetInTx: 'runes'; txType: RunesTxType; runes: EnhancedRunesOwnActivity }
  | {
      assetInTx: 'multipleAssets';
      txType: MultipleAssetsTxType;
      inscriptions: PartialInscriptionEvents;
      runes: EnhancedRunesOwnActivity;
    }
);

export type BtcTxHistory = {
  transactions: EnhancedTx[];
  offset: number;
  limit: number;
};
