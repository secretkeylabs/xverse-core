import { AddressType, getAddressInfo } from 'bitcoin-address-validation';
import EsploraProvider from '../../api/esplora/esploraAPiProvider';
import { UtxoCache } from '../../api/utxoCache';
import { SeedVault } from '../../seedVault';
import type { Account, BtcPaymentType, NetworkType } from '../../types';
import {
  AddressContext,
  AddressContextConstructorArgs,
  KeystoneP2trAddressContext,
  KeystoneP2wpkhAddressContext,
  LedgerP2trAddressContext,
  LedgerP2wpkhAddressContext,
  P2shAddressContext,
  P2trAddressContext,
  P2wpkhAddressContext,
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
  }

  if (type === AddressType.p2sh) {
    return new P2shAddressContext(contextConstructorArgs);
  } else if (type === AddressType.p2wpkh) {
    return new P2wpkhAddressContext(contextConstructorArgs);
  } else if (type === AddressType.p2tr) {
    return new P2trAddressContext(contextConstructorArgs);
  } else {
    throw new Error('Unsupported payment address type');
  }
};

export type TransactionContextOptions = {
  esploraApiProvider: EsploraProvider;
  account: Account;
  masterFingerprint?: string;
  seedVault: SeedVault;
  utxoCache: UtxoCache;
  network: NetworkType;
  btcPaymentAddressType: BtcPaymentType;
};
export const createTransactionContext = (options: TransactionContextOptions) => {
  const { esploraApiProvider, account, seedVault, utxoCache, network, btcPaymentAddressType, masterFingerprint } =
    options;

  const accountIndex =
    !account.accountType || account.accountType === 'software' ? account.id : account.deviceAccountIndex;
  if (accountIndex === undefined) {
    throw new Error('Cannot identify the account index');
  }

  const paymentAddress = btcPaymentAddressType === 'nested' ? account.btcAddresses.nested : account.btcAddresses.native;

  if (!paymentAddress) {
    throw new Error('Payment address not found');
  }

  const paymentAddressContext = createAddressContext({
    esploraApiProvider,
    address: paymentAddress.address,
    publicKey: paymentAddress.publicKey,
    network,
    accountIndex,
    seedVault,
    utxoCache,
    accountType: account.accountType,
    masterFingerprint,
  });
  const ordinalsAddressContext = createAddressContext({
    esploraApiProvider,
    address: account.btcAddresses.taproot.address,
    publicKey: account.btcAddresses.taproot.publicKey,
    network,
    accountIndex,
    seedVault,
    utxoCache,
    accountType: account.accountType,
    masterFingerprint,
  });

  return new TransactionContext(network, esploraApiProvider, paymentAddressContext, ordinalsAddressContext);
};
