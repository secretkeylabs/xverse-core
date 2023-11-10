import { vi } from 'vitest';
import { UtxoCache } from '../../../../api';
import EsploraProvider from '../../../../api/esplora/esploraAPiProvider';
import SeedVault from '../../../../seedVault';
import { AddressContext } from '../../../../transactions/bitcoin/context';
import type { SupportedAddressType } from '../../../../transactions/bitcoin/types';

export const seedPhrase = 'action action action action action action action action action action action action';
export const addresses = [
  {
    nativeSegwit: 'bc1qx4kug8qk3npq2te0jattrwdpjutz3x5866e5qc',
    nativeSegwitPubKey: '0235ed87c83ab9c09c6ef51f8d17c5b10c3bb5647ab8e1925ff81220d7aee4e302',
    nestedSegwit: '3Aog9TGrjGtjFvZ1K675c7sHGkiiYKuV8K',
    nestedSegwitPubKey: '03449642532ff90cc0b2d8bbc56c6fefb4ef3f4b387a70ba77eb9787c825db50fb',
    taproot: 'bc1pxau0prcas6r24l2jy5gtfy8mcmjkmd7zchynqd3cq7mh788xywys02dn56',
    taprootPubKey: 'cdaa9d72d179e41b0b3c8df66b9a07df6cda38d48134fbee7d09f518f27845f1',
  },
  {
    nativeSegwit: 'bc1qgcgud7qguagzq656xwwkrc3wkjhe80z27fxrmy',
    nativeSegwitPubKey: '0315e9fd1e5b16f297ada82f8b247080f0552792e425786d45e3da615cec1fef70',
    nestedSegwit: '33bbC6BdnAzSBs69j8nEnaShXeXsHNadc2',
    nestedSegwitPubKey: '0352473d093fb8bc77c40111a7c561e6c199d5c7d2e7b3021b95a4efbc830fe73a',
    taproot: 'bc1p2wh6hzh26lg0zjmeh0ygxspfjjg4guc39x2ndd24h5xdc6y0f6wqhk8ghp',
    taprootPubKey: '9532e4d9168d235d5c253be414e197ee62598ef549efd104667599c7ee65831a',
  },
];

export class TestAddressContext extends AddressContext {
  constructor(
    type: SupportedAddressType,
    address: string,
    publicKey: string,
    accountIndex: bigint,
    seedVault: SeedVault,
    utxoCache: UtxoCache,
  ) {
    const esploraProvider = new EsploraProvider({ network: 'Mainnet' });
    super(type, address, publicKey, 'Mainnet', accountIndex, seedVault, utxoCache, esploraProvider);
  }

  getUtxos = vi.fn();

  getUnindexedUtxos = vi.fn();

  getCommonUtxos = vi.fn();

  getEmbellishedUtxos = vi.fn();

  getUtxo = vi.fn();

  getPrivateKey = vi.fn();

  getDerivationPath = vi.fn();

  addInput = vi.fn();

  signInputs = vi.fn();

  toDummyInputs = vi.fn();
}
