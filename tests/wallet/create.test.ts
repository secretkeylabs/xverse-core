import { describe, expect, it } from 'vitest';
import { validateMnemonic } from 'bip39';
import { newWallet, walletFromSeedPhrase } from '../../wallet';
import { testSeed, walletAccounts } from '../mocks/restore.mock';

describe('new wallet', () => {
  it('generates a valid seedPhrase', async () => {
    const wallet = await newWallet();
    expect(wallet.seedPhrase.split(' ').length).toEqual(12);
    expect(validateMnemonic(wallet.seedPhrase)).toBeTruthy();
  });
});

describe('wallet from seed phrase', () => {
  it('restores the same wallet', async () => {
    const wallet = await walletFromSeedPhrase({ mnemonic: testSeed, network: 'Mainnet', index: 0n });

    expect(wallet.stxAddress).toEqual(walletAccounts[0].stxAddress);
    expect(wallet.btcAddress).toEqual(walletAccounts[0].btcAddress);
    expect(wallet.ordinalsAddress).toEqual(walletAccounts[0].ordinalsAddress);
    expect(wallet.masterPubKey).toEqual(walletAccounts[0].masterPubKey);
    expect(wallet.stxPublicKey).toEqual(walletAccounts[0].stxPublicKey);
    expect(wallet.btcPublicKey).toEqual(walletAccounts[0].btcPublicKey);
    expect(wallet.ordinalsPublicKey).toEqual(walletAccounts[0].ordinalsPublicKey);
  });

  it('restores the same wallet at index 1', async () => {
    const wallet = await walletFromSeedPhrase({ mnemonic: testSeed, network: 'Mainnet', index: 1n });

    expect(wallet.stxAddress).toEqual(walletAccounts[1].stxAddress);
    expect(wallet.btcAddress).toEqual(walletAccounts[1].btcAddress);
    expect(wallet.ordinalsAddress).toEqual(walletAccounts[1].ordinalsAddress);
    expect(wallet.masterPubKey).toEqual(walletAccounts[1].masterPubKey);
    expect(wallet.stxPublicKey).toEqual(walletAccounts[1].stxPublicKey);
    expect(wallet.btcPublicKey).toEqual(walletAccounts[1].btcPublicKey);
    expect(wallet.ordinalsPublicKey).toEqual(walletAccounts[1].ordinalsPublicKey);
  });

  it('restores the same wallet at index 4', async () => {
    const wallet = await walletFromSeedPhrase({ mnemonic: testSeed, network: 'Mainnet', index: 4n });

    expect(wallet.stxAddress).toEqual('SP1FWDM2J68TZBYCGR0VRTB3FFDAR5GP19PHB7M3Y');
    expect(wallet.btcAddress).toEqual('3Gur3uA5eGsgimFc8DfYbJJ52KjkwfPgp7');
    expect(wallet.ordinalsAddress).toEqual('bc1pt9mfsn7thlck7tlhw6ll2x3xurlclq4gxczrqq99nz9ufsn78j2qlwj50p');
    expect(wallet.masterPubKey).toEqual('024d30279814a0e609534af1d1969b7c24a6918029e1f9cb2134a427ebfb1f17c3');
    expect(wallet.stxPublicKey).toEqual('03b1973efe29dcf47d6afc5d3d813ce7b5354f5a9f04209027a077f79c72aacff5');
    expect(wallet.btcPublicKey).toEqual('02e5ec87babb75a7d8057e961f27f66363000cd9dfd74095fb1cb8ceda27f5e3a8');
    expect(wallet.ordinalsPublicKey).toEqual('8754dc83200dbe5f134e4092cf563d8363cf33e20ab418006d46dd7a6374dc24');
  });

  it('restores the same wallet testnet', async () => {
    const wallet = await walletFromSeedPhrase({ mnemonic: testSeed, network: 'Testnet', index: 0n });

    expect(wallet.stxAddress).toEqual('ST147ST7ESA3RES888QQMV6AK7GZK93ZR75HPGC8G');
    expect(wallet.btcAddress).toEqual('2N2FTDg7yCJ58TxgovxpDYUZ3THYHZ2AuXT');
    expect(wallet.ordinalsAddress).toEqual('tb1p4raql9qqc67e593dk8h8y307tenl8lghev8x8y5xx8u4rqldlksqrx8cc3');
    expect(wallet.masterPubKey).toEqual('024d30279814a0e609534af1d1969b7c24a6918029e1f9cb2134a427ebfb1f17c3');
    expect(wallet.stxPublicKey).toEqual('025df9b0ea2c81e4f8360bf9a16638ed3678bc84dbdc04124f5db86996999aa9a8');
    expect(wallet.btcPublicKey).toEqual('03b814fb54bdcc420406d5567716871c25b23edab8e42c36c91906a5ddcbf1b8de');
    expect(wallet.ordinalsPublicKey).toEqual('7db4ed7080ebc1a2769ae5567d57849f558aae256f9f3eabaa79282e32bc8721');
  });
});
