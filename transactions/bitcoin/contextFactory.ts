import { AddressType, getAddressInfo } from 'bitcoin-address-validation';
import EsploraProvider from '../../api/esplora/esploraAPiProvider';
import { UtxoCache } from '../../api/utxoCache';
import { SeedVault } from '../../seedVault';
import type { Account, AccountType, NetworkType } from '../../types';
import {
  AddressContext,
  KeystoneP2trAddressContext,
  KeystoneP2wpkhAddressContext,
  LedgerP2trAddressContext,
  LedgerP2wpkhAddressContext,
  P2shAddressContext,
  P2trAddressContext,
  P2wpkhAddressContext,
  TransactionContext,
} from './context';

type CreateAddressContextProps = {
  esploraApiProvider: EsploraProvider;
  address: string;
  publicKey: string;
  network: NetworkType;
  accountIndex: number;
  seedVault: SeedVault;
  utxoCache: UtxoCache;
  accountType?: AccountType;
};
const createAddressContext = ({
  esploraApiProvider,
  address,
  publicKey,
  network,
  accountIndex,
  seedVault,
  utxoCache,
  accountType,
}: CreateAddressContextProps): AddressContext => {
  const { type } = getAddressInfo(address);

  if (accountType === 'ledger') {
    if (type === AddressType.p2wpkh) {
      return new LedgerP2wpkhAddressContext(
        address,
        publicKey,
        network,
        accountIndex,
        seedVault,
        utxoCache,
        esploraApiProvider,
      );
    }
    if (type === AddressType.p2tr) {
      return new LedgerP2trAddressContext(
        address,
        publicKey,
        network,
        accountIndex,
        seedVault,
        utxoCache,
        esploraApiProvider,
      );
    } else {
      throw new Error(`Ledger support for this type of address not implemented: ${type}`);
    }
  } else if (accountType === 'keystone') {
    if (type === AddressType.p2wpkh) {
      return new KeystoneP2wpkhAddressContext(
        address,
        publicKey,
        network,
        accountIndex,
        seedVault,
        utxoCache,
        esploraApiProvider,
      );
    }
    if (type === AddressType.p2tr) {
      return new KeystoneP2trAddressContext(
        address,
        publicKey,
        network,
        accountIndex,
        seedVault,
        utxoCache,
        esploraApiProvider,
      );
    } else {
      throw new Error(`Keystone support for this type of address not implemented: ${type}`);
    }
  }

  if (type === AddressType.p2sh) {
    return new P2shAddressContext(address, publicKey, network, accountIndex, seedVault, utxoCache, esploraApiProvider);
  } else if (type === AddressType.p2wpkh) {
    return new P2wpkhAddressContext(
      address,
      publicKey,
      network,
      accountIndex,
      seedVault,
      utxoCache,
      esploraApiProvider,
    );
  } else if (type === AddressType.p2tr) {
    return new P2trAddressContext(address, publicKey, network, accountIndex, seedVault, utxoCache, esploraApiProvider);
  } else {
    throw new Error('Unsupported payment address type');
  }
};

export type TransactionContextOptions = {
  esploraApiProvider: EsploraProvider;
  account: Account;
  seedVault: SeedVault;
  utxoCache: UtxoCache;
  network: NetworkType;
};
export const createTransactionContext = (options: TransactionContextOptions) => {
  const { esploraApiProvider, account, seedVault, utxoCache, network } = options;

  const accountIndex =
    !account.accountType || account.accountType === 'software' ? account.id : account.deviceAccountIndex;
  if (accountIndex === undefined) {
    throw new Error('Cannot identify the account index');
  }
  const paymentAddress = createAddressContext({
    esploraApiProvider,
    address: account.btcAddress,
    publicKey: account.btcPublicKey,
    network,
    accountIndex,
    seedVault: seedVault,
    utxoCache: utxoCache,
    accountType: account.accountType,
  });
  const ordinalsAddress =
    account.btcAddress === account.ordinalsAddress
      ? paymentAddress
      : createAddressContext({
          esploraApiProvider,
          address: account.ordinalsAddress,
          publicKey: account.ordinalsPublicKey,
          network,
          accountIndex,
          seedVault: seedVault,
          utxoCache: utxoCache,
          accountType: account.accountType,
        });

  return new TransactionContext(network, paymentAddress, ordinalsAddress);
};
