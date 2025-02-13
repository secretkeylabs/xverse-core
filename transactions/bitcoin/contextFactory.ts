import { AddressType, getAddressInfo } from 'bitcoin-address-validation';
import EsploraProvider from '../../api/esplora/esploraAPiProvider';
import { UtxoCache } from '../../api/utxoCache';
import type { Account, BtcPaymentType, NetworkType } from '../../types';
import { DerivationType, SeedVault, WalletId } from '../../vaults';
import {
  AddressContext,
  AddressContextConstructorArgs,
  KeystoneP2trAddressContext,
  KeystoneP2wpkhAddressContext,
  LedgerP2trAddressContext,
  LedgerP2wpkhAddressContext,
  SoftwareP2shAddressContext,
  SoftwareP2trAddressContext,
  SoftwareP2wpkhAddressContext,
  TransactionContext,
} from './context';

const createAddressContext = (contextConstructorArgs: AddressContextConstructorArgs): AddressContext => {
  // TODO: switch to btc.Address.decode
  const { type } = getAddressInfo(contextConstructorArgs.address);

  if (contextConstructorArgs.accountType === 'ledger') {
    if (type === AddressType.p2wpkh) {
      return new LedgerP2wpkhAddressContext(contextConstructorArgs);
    }
    if (type === AddressType.p2tr) {
      return new LedgerP2trAddressContext(contextConstructorArgs);
    } else {
      throw new Error(`Ledger support for this type of address not implemented: ${type}`);
    }
  } else if (contextConstructorArgs.accountType === 'keystone') {
    if (type === AddressType.p2wpkh) {
      return new KeystoneP2wpkhAddressContext(contextConstructorArgs);
    }
    if (type === AddressType.p2tr) {
      return new KeystoneP2trAddressContext(contextConstructorArgs);
    } else {
      throw new Error(`Keystone support for this type of address not implemented: ${type}`);
    }
  } else if (!contextConstructorArgs.accountType || contextConstructorArgs.accountType === 'software') {
    if (type === AddressType.p2sh) {
      return new SoftwareP2shAddressContext(contextConstructorArgs);
    } else if (type === AddressType.p2wpkh) {
      return new SoftwareP2wpkhAddressContext(contextConstructorArgs);
    } else if (type === AddressType.p2tr) {
      return new SoftwareP2trAddressContext(contextConstructorArgs);
    }
  }

  throw new Error('Unsupported payment address type');
};

export type TransactionContextOptions = {
  esploraApiProvider: EsploraProvider;
  account: Account;
  masterFingerprint?: string;
  seedVault: SeedVault;
  utxoCache: UtxoCache;
  network: NetworkType;
  btcPaymentAddressType: BtcPaymentType;
  derivationType: DerivationType;
  walletId?: WalletId;
};

export const createTransactionContext = (options: TransactionContextOptions) => {
  const {
    esploraApiProvider,
    account,
    seedVault,
    utxoCache,
    network,
    btcPaymentAddressType,
    masterFingerprint,
    walletId,
    derivationType,
  } = options;

  const accountIndex =
    !account.accountType || account.accountType === 'software' ? account.id : account.deviceAccountIndex;
  if (accountIndex === undefined) {
    throw new Error('Cannot identify the account index');
  }

  const paymentAddress = btcPaymentAddressType === 'nested' ? account.btcAddresses.nested : account.btcAddresses.native;

  if (!paymentAddress) {
    throw new Error('Payment address not found');
  }

  const accountType = account.accountType;
  const baseAddressContextArgs = { esploraApiProvider, network, derivationType, accountIndex, seedVault, utxoCache };
  let paymentAddressContextArgs: AddressContextConstructorArgs;
  let ordinalsAddressContextArgs: AddressContextConstructorArgs;

  if (accountType === 'ledger' || accountType === 'keystone') {
    paymentAddressContextArgs = {
      ...baseAddressContextArgs,
      address: paymentAddress.address,
      publicKey: paymentAddress.publicKey,
      accountType,
      masterFingerprint,
    };
    ordinalsAddressContextArgs = {
      ...baseAddressContextArgs,
      address: account.btcAddresses.taproot.address,
      publicKey: account.btcAddresses.taproot.publicKey,
      accountType,
      masterFingerprint,
    };
  } else if (!accountType || accountType === 'software') {
    if (!walletId) {
      throw new Error('WalletId is required for software account');
    }

    paymentAddressContextArgs = {
      ...baseAddressContextArgs,
      address: paymentAddress.address,
      publicKey: paymentAddress.publicKey,
      accountType,
      walletId,
    };
    ordinalsAddressContextArgs = {
      ...baseAddressContextArgs,
      address: account.btcAddresses.taproot.address,
      publicKey: account.btcAddresses.taproot.publicKey,
      accountType,
      walletId,
    };
  } else {
    throw new Error('Unsupported account type');
  }

  const paymentAddressContext = createAddressContext(paymentAddressContextArgs);
  const ordinalsAddressContext = createAddressContext(ordinalsAddressContextArgs);

  return new TransactionContext(network, esploraApiProvider, paymentAddressContext, ordinalsAddressContext);
};
