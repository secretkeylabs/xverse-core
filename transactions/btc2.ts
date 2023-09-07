import { Transaction } from '@scure/btc-signer';
import { BaseWallet } from '../types/wallet';

type SupportedAddressType = 'p2tr' | 'p2sh';

class AddressContext {
  private _type!: SupportedAddressType;

  private _address!: string;

  private _publicKey!: string;

  get type(): SupportedAddressType {
    return this._type;
  }

  get address(): string {
    return this._address;
  }

  constructor(type: SupportedAddressType, address: string, publicKey: string) {
    this._type = type;
    this._address = address;
    this._publicKey = publicKey;
  }
}

class TransactionContext {
  private _paymentAddress!: AddressContext;

  private _ordinalsAddress!: AddressContext;

  get paymentAddress(): AddressContext {
    return this._paymentAddress;
  }

  get ordinalsAddress(): AddressContext {
    return this._ordinalsAddress;
  }

  constructor(wallet: BaseWallet) {
    this._paymentAddress = new AddressContext('p2sh', wallet.btcAddress, wallet.btcPublicKey);
    this._ordinalsAddress = new AddressContext('p2tr', wallet.ordinalsAddress, wallet.ordinalsPublicKey);
  }
}

interface BaseAction {
  type: string;
}

interface SendBtcAction extends BaseAction {
  type: 'sendBtc';
  recipient: { toAddress: string; amount: number };
}

const compileTransaction = async (context: TransactionContext, actions: BaseAction[]) => {
  // order actions by type. Send Ordinals first, then Ordinal extraction, then payment
  // create transaction processing pipeline of actions
  const txn = new Transaction();
};

/**
 * send bitcoin
 * send bitcoin to multiple recipients
 */
const sendBtc = async (context: TransactionContext, recipients: { toAddress: string; amount: number }[]) => {};

/**
 * send inscription
 * send multiple inscription to 1 recipient
 * send multiple inscription to multiple recipients
 * send sat
 * send multiple sats to 1 recipient
 * send multiple sats to multiple recipients
 */
// TODO: minOutputSatsAmount or outputSatsAmount?
const sendOrdinal = async (
  context: TransactionContext,
  recipients: { toAddress: string; location: string; minOutputSatsAmount: number; moveToZeroOffset?: boolean }[],
) => {};

const recoverBitcoin = async (context: TransactionContext, outpoint?: string) => {};

const recoverOrdinal = async (context: TransactionContext, outpoint?: string) => {};

const extractOrdinal = async (
  context: TransactionContext,
  sats: { location: string; minOutputSatsAmount: number }[],
) => {
  const recipients = sats.map((sat) => ({
    ...sat,
    toAddress: context.ordinalsAddress.address,
    moveToZeroOffset: true,
  }));
  return sendOrdinal(context, recipients);
};
