import * as btc from '@scure/btc-signer';
import { Transport } from '../../ledger/types';
import { RareSatsType } from '../../types';
import { ExtendedUtxo } from './context';

export type SupportedAddressType = 'p2tr' | 'p2sh' | 'p2wpkh';

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
  combinable?: boolean;
  spendable?: boolean;
};

export type SplitUtxoAction =
  | {
      type: ActionType.SPLIT_UTXO;
      toAddress: string;
      location: string;
      spendable?: false;
    }
  | {
      type: ActionType.SPLIT_UTXO;
      location: string;
      spendable: true;
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
  ledgerTransport?: Transport;
  excludeOutpointList?: string[];
  useEffectiveFeeRate?: boolean;
  allowUnconfirmedInput?: boolean;
};

export type PSBTCompilationOptions = {
  ledgerTransport?: Transport;
  finalize?: boolean;
  allowedSighash?: btc.SigHash[];
};

export type IOInscription = {
  id: string;
  offset: number;
  fromAddress: string;
};

export type IOSatribute = {
  types: RareSatsType[];
  amount: number;
  offset: number;
  fromAddress: string;
};

export type TransactionOutput = {
  address: string;
  amount: number;
  inscriptions: IOInscription[];
  satributes: IOSatribute[];
};

export type TransactionFeeOutput = Omit<TransactionOutput, 'address'>;

export type TransactionScriptOutput = {
  script: string[];
};

export type EnhancedInput = {
  extendedUtxo: ExtendedUtxo;
  inscriptions: IOInscription[];
  satributes: IOSatribute[];
  sigHash?: btc.SigHash | undefined;
};
export type EnhancedOutput = TransactionOutput | TransactionScriptOutput;
