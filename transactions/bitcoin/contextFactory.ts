import { AddressType, getAddressInfo } from 'bitcoin-address-validation';
import EsploraProvider from '../../api/esplora/esploraAPiProvider';
import { UtxoCache } from '../../api/utxoCache';
import { SeedVault } from '../../seedVault';
import type { Account, AccountType, BtcPaymentType, NetworkType } from '../../types';
import {
  AddressContext,
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
  // TODO: switch to btc.Address.decode
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
  btcPaymentAddressType: BtcPaymentType;
};
export const createTransactionContext = (options: TransactionContextOptions) => {
  const { esploraApiProvider, account, seedVault, utxoCache, network, btcPaymentAddressType } = options;

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
  });

  return new TransactionContext(network, esploraApiProvider, paymentAddressContext, ordinalsAddressContext);
};
