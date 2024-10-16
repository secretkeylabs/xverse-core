import { describe, expect, it } from 'vitest';
import { getAccountFromSeedPhrase } from '../../account';
import { testSeed, walletAccounts } from '../mocks/restore.mock';

describe('account from seed phrase', () => {
  it('restores expected account', async () => {
    const account = await getAccountFromSeedPhrase({
      mnemonic: testSeed,
      network: 'Mainnet',
      index: 0n,
    });

    expect(account).toEqual(walletAccounts[0]);
  });

  it('restores expected account at index 1', async () => {
    const account = await getAccountFromSeedPhrase({
      mnemonic: testSeed,
      network: 'Mainnet',
      index: 1n,
    });

    expect(account).toEqual(walletAccounts[1]);
  });

  it('restores expected account at index 4', async () => {
    const wallet = await getAccountFromSeedPhrase({
      mnemonic: testSeed,
      network: 'Mainnet',
      index: 4n,
    });

    expect(wallet).toEqual({
      id: 4,
      accountType: 'software',
      masterPubKey: '024d30279814a0e609534af1d1969b7c24a6918029e1f9cb2134a427ebfb1f17c3',
      stxAddress: 'SP1FWDM2J68TZBYCGR0VRTB3FFDAR5GP19PHB7M3Y',
      stxPublicKey: '03b1973efe29dcf47d6afc5d3d813ce7b5354f5a9f04209027a077f79c72aacff5',
      btcAddresses: {
        native: {
          address: 'bc1qalxed68xk6qgz8yk8hv9wyz89ajal2v3usvhpe',
          publicKey: '03f122458c4de24e148c63b5c33907d137ffaa146d6825aadd9139176fa137b636',
        },
        nested: {
          address: '3Gur3uA5eGsgimFc8DfYbJJ52KjkwfPgp7',
          publicKey: '02e5ec87babb75a7d8057e961f27f66363000cd9dfd74095fb1cb8ceda27f5e3a8',
        },
        taproot: {
          address: 'bc1pt9mfsn7thlck7tlhw6ll2x3xurlclq4gxczrqq99nz9ufsn78j2qlwj50p',
          publicKey: '8754dc83200dbe5f134e4092cf563d8363cf33e20ab418006d46dd7a6374dc24',
        },
      },
    });
  });

  it('restores expected account testnet', async () => {
    const wallet = await getAccountFromSeedPhrase({
      mnemonic: testSeed,
      network: 'Testnet',
      index: 0n,
    });

    expect(wallet).toEqual({
      id: 0,
      accountType: 'software',
      masterPubKey: '024d30279814a0e609534af1d1969b7c24a6918029e1f9cb2134a427ebfb1f17c3',
      stxAddress: 'ST147ST7ESA3RES888QQMV6AK7GZK93ZR75HPGC8G',
      stxPublicKey: '025df9b0ea2c81e4f8360bf9a16638ed3678bc84dbdc04124f5db86996999aa9a8',
      btcAddresses: {
        native: {
          address: 'tb1qgnwyumq2y6rdhgjg4g3dxk4lk04pjfzlc8407c',
          publicKey: '03d984bebdd8e13a4c550f396e70f815ea95b73c4430ae89b71b8fba36f852cc59',
        },
        nested: {
          address: '2N2FTDg7yCJ58TxgovxpDYUZ3THYHZ2AuXT',
          publicKey: '03b814fb54bdcc420406d5567716871c25b23edab8e42c36c91906a5ddcbf1b8de',
        },
        taproot: {
          address: 'tb1p4raql9qqc67e593dk8h8y307tenl8lghev8x8y5xx8u4rqldlksqrx8cc3',
          publicKey: '7db4ed7080ebc1a2769ae5567d57849f558aae256f9f3eabaa79282e32bc8721',
        },
      },
    });
  });
});
