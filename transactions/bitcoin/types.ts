export type SupportedAddressType = 'p2tr' | 'p2sh' | 'p2wpkh';

export type WalletContext = {
  btcAddress: string;
  ordinalsAddress: string;
  btcPublicKey: string;
  ordinalsPublicKey: string;
};

export enum ActionType {
  SEND_BTC = 'sendBtc',
  SEND_UTXO = 'sendUtxo',
  SPLIT_UTXO = 'splitUtxo',
}

export type SendBtcAction = {
  type: ActionType.SEND_BTC;
  toAddress: string;
  amount: bigint;
  combinable: boolean;
};

export type SendUtxoAction = {
  type: ActionType.SEND_UTXO;
  toAddress: string;
  outpoint: string;
  combinable: boolean;
  spendable: boolean;
};

export type SplitUtxoAction = {
  type: ActionType.SPLIT_UTXO;
  toAddress: string;
  location: string;
};

export type Action = SendBtcAction | SendUtxoAction | SplitUtxoAction;

type ActionTypeToActionMap = {
  [ActionType.SEND_BTC]: SendBtcAction;
  [ActionType.SEND_UTXO]: SendUtxoAction;
  [ActionType.SPLIT_UTXO]: SplitUtxoAction;
};

export type ActionMap = {
  [K in ActionType]: ActionTypeToActionMap[K][];
} & {
  [K in Action['type']]: Action[];
};

export type CompilationOptions = {
  rbfEnabled?: boolean;
};
