import * as btc from '@scure/btc-signer';
import { describe, expect, it, vi } from 'vitest';
import { TransactionContext } from '../context';
import type { WalletContext } from '../types';
import { addresses } from './helpers';

describe('TransactionContext', () => {
  const seedVault = vi.fn() as any;
  const utxoCache = vi.fn() as any;

  const sharedWalletData: WalletContext = {
    btcAddress: addresses[0].nestedSegwit,
    btcPublicKey: addresses[0].nestedSegwitPubKey,
    ordinalsAddress: addresses[0].taproot,
    ordinalsPublicKey: addresses[0].taprootPubKey,
  };

  it('should create correct output address contexts - native segwit and taproot', () => {
    const walletData: WalletContext = {
      btcAddress: addresses[0].nativeSegwit,
      btcPublicKey: addresses[0].nativeSegwitPubKey,
      ordinalsAddress: addresses[0].taproot,
      ordinalsPublicKey: addresses[0].taprootPubKey,
    };

    const context = new TransactionContext(walletData, seedVault, utxoCache, 'Mainnet', 0n);
    expect(context.paymentAddress.constructor.name).toEqual('P2wpkhAddressContext');
    expect(context.ordinalsAddress.constructor.name).toEqual('P2trAddressContext');
  });

  it('should create correct output address contexts - nested segwit and taproot', () => {
    const walletData: WalletContext = {
      btcAddress: addresses[1].nestedSegwit,
      btcPublicKey: addresses[1].nestedSegwitPubKey,
      ordinalsAddress: addresses[1].taproot,
      ordinalsPublicKey: addresses[1].taprootPubKey,
    };

    const context = new TransactionContext(walletData, seedVault, utxoCache, 'Mainnet', 1n);
    expect(context.paymentAddress.constructor.name).toEqual('P2shAddressContext');
    expect(context.ordinalsAddress.constructor.name).toEqual('P2trAddressContext');
  });

  it('should create correct output address contexts - both taproot', () => {
    const walletData: WalletContext = {
      btcAddress: addresses[1].taproot,
      btcPublicKey: addresses[1].taprootPubKey,
      ordinalsAddress: addresses[1].taproot,
      ordinalsPublicKey: addresses[1].taprootPubKey,
    };

    const context = new TransactionContext(walletData, seedVault, utxoCache, 'Mainnet', 1n);
    expect(context.paymentAddress.constructor.name).toEqual('P2trAddressContext');
    expect(context.ordinalsAddress.constructor.name).toEqual('P2trAddressContext');
    expect(context.ordinalsAddress).toEqual(context.paymentAddress);
  });

  it('should store correct network', () => {
    const context = new TransactionContext(sharedWalletData, seedVault, utxoCache, 'Mainnet', 0n);
    expect(context.network).toEqual('Mainnet');
    const context2 = new TransactionContext(sharedWalletData, seedVault, utxoCache, 'Testnet', 0n);
    expect(context2.network).toEqual('Testnet');
  });

  it('should add output to transaction', () => {
    const context = new TransactionContext(sharedWalletData, seedVault, utxoCache, 'Mainnet', 0n);
    const dummyTxn = {
      addOutputAddress: vi.fn(),
    };
    context.addOutputAddress(dummyTxn as any, 'recepientAddress', 10000n);
    expect(dummyTxn.addOutputAddress).toHaveBeenCalledWith('recepientAddress', 10000n, btc.NETWORK);
  });
});
