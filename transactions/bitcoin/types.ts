import * as btc from '@scure/btc-signer';
import { Transport } from '../../ledger';
import { Account, Artifact, RareSatsType } from '../../types';
import { ExtendedDummyUtxo, ExtendedUtxo } from './extendedUtxo';
import { TransportWebUSB } from '@keystonehq/hw-transport-webusb';

type ScriptOpArray = Parameters<typeof btc.Script.encode>[0];

export type SupportedAddressType = 'p2tr' | 'p2sh' | 'p2wpkh';

export enum ActionType {
  SEND_BTC = 'sendBtc',
  SEND_UTXO = 'sendUtxo',
  SPLIT_UTXO = 'splitUtxo',
  SCRIPT = 'script',
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

export type ScriptAction = {
  type: ActionType.SCRIPT;
  script: ScriptOpArray | Uint8Array;
};

export type Action = SendBtcAction | SendUtxoAction | SplitUtxoAction | ScriptAction;

type ActionTypeToActionMap = {
  [ActionType.SEND_BTC]: SendBtcAction;
  [ActionType.SEND_UTXO]: SendUtxoAction;
  [ActionType.SPLIT_UTXO]: SplitUtxoAction;
  [ActionType.SCRIPT]: ScriptAction;
};

export type ActionMap = {
  [K in ActionType]: ActionTypeToActionMap[K][];
} & {
  [K in Action['type']]: Action[];
};

export type TransactionOptions = {
  /** This is a list of UTXOs to use in the transaction. They will be added
   * as inputs at the end for spending and fees, so add this list with care. */
  forceIncludeOutpointList?: string[];
  excludeOutpointList?: string[];
  useEffectiveFeeRate?: boolean;
  allowUnconfirmedInput?: boolean;
  allowUnknownInputs?: boolean;
  allowUnknownOutputs?: boolean;
  /** All change from the transaction will go to this address. This is used
   * for things like send max. */
  overrideChangeAddress?: string;
};

export type CompilationOptions = {
  rbfEnabled?: boolean;
  selectedAccount?: Account;
  ledgerTransport?: Transport;
  keystoneTransport?: TransportWebUSB;
};

export type TransactionSummary = {
  fee: bigint;
  feeRate: number;
  effectiveFeeRate: number | undefined;
  vsize: number;
  inputs: EnhancedInput[];
  outputs: EnhancedOutput[];
  feeOutput: TransactionFeeOutput;
  dustValue: bigint;
  runeOp?: Artifact;
};

export type PSBTCompilationOptions = {
  ledgerTransport?: Transport;
  keystoneTransport?: TransportWebUSB;
  selectedAccount?: Account;
  finalize?: boolean;
};

export type IOInscription = {
  id: string;
  offset: number;
  fromAddress: string;
  number: number;
  contentType: string;
};

export type IOSatribute = {
  types: RareSatsType[]; // the satribute combo on the sats in this group of sats
  amount: number; // total amount of sats in this group
  offset: number;
  fromAddress: string;
};

export type TransactionOutput = {
  type: 'address';
  script: string[];
  scriptHex: string;
  address: string;
  amount: number;
  inscriptions: IOInscription[];
  satributes: IOSatribute[];
};

export type TransactionPubKeyOutput = {
  type: 'pk' | 'ms' | 'tr_ms' | 'tr_ns';
  script: string[];
  scriptHex: string;
  pubKeys: string[];
  amount: number;
  inscriptions: IOInscription[];
  satributes: IOSatribute[];
  m: number;
};

export type TransactionFeeOutput = Omit<TransactionOutput, 'address' | 'type' | 'script' | 'scriptHex'> & {
  type: 'fee';
};

export type TransactionScriptOutput = {
  type: 'script';
  script: string[];
  scriptHex: string;
  amount: number;
};

export type EnhancedInput = {
  extendedUtxo: ExtendedUtxo | ExtendedDummyUtxo;
  inscriptions: IOInscription[];
  satributes: IOSatribute[];
  sigHash?: btc.SigHash | undefined;
  walletWillSign: boolean;
};
export type EnhancedOutput = TransactionOutput | TransactionPubKeyOutput | TransactionScriptOutput;

export type PsbtSummary = {
  inputs: EnhancedInput[];
  outputs: EnhancedOutput[];
  feeOutput?: TransactionFeeOutput;
  hasSigHashNone: boolean;
  hasSigHashSingle: boolean;
  isFinal: boolean;
  runeOp?: Artifact;
  feeRate?: number;
};

export type InputMetadata = {
  inputs: {
    extendedUtxo: ExtendedUtxo | ExtendedDummyUtxo;
    sigHash?: btc.SigHash | undefined;
  }[];
  isSigHashAll: boolean;
  hasSigHashNone: boolean;
  hasSigHashSingle: boolean;
  inputTotal: number;
};
