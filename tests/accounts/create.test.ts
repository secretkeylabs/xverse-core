import { describe, expect, it } from 'vitest';
import { getAccountFromRootNode } from '../../account';
import { WalletId } from '../../vaults';
import { testRootNode, walletAccounts } from '../mocks/restore.mock';

describe('account from seed phrase', () => {
  it('restores expected account', async () => {
    const account = await getAccountFromRootNode({
      rootNode: testRootNode,
      network: 'Mainnet',
      derivationIndex: 0n,
      derivationType: 'index',
      walletId: 'walletId' as WalletId,
    });
    expect(account).toEqual(walletAccounts[0]);
  });

  it('restores expected account at index 1', async () => {
    const account = await getAccountFromRootNode({
      rootNode: testRootNode,
      network: 'Mainnet',
      derivationIndex: 1n,
      derivationType: 'index',
      walletId: 'walletId' as WalletId,
    });
    expect(account).toEqual(walletAccounts[1]);
  });

  it('restores expected account at index 4', async () => {
    const account = await getAccountFromRootNode({
      rootNode: testRootNode,
      network: 'Mainnet',
      derivationIndex: 4n,
      derivationType: 'index',
      walletId: 'walletId' as WalletId,
    });

    expect(account).toEqual({
      id: 4,
      walletId: 'walletId',
      accountType: 'software',
      masterPubKey: '024d30279814a0e609534af1d1969b7c24a6918029e1f9cb2134a427ebfb1f17c3',
      strkAddresses: {
        'argent-x-v0_4_0-with-0-guardians': {
          address: '0x0243daaefed758fb26c5c925f2f63d70cd50c776c4af6d5e4fa805d3174256a0',
        },
      },
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

  it('restores expected account at account index 4', async () => {
    const account = await getAccountFromRootNode({
      rootNode: testRootNode,
      network: 'Mainnet',
      derivationIndex: 4n,
      derivationType: 'account',
      walletId: 'walletId' as WalletId,
    });

    expect(account).toEqual({
      id: 4,
      walletId: 'walletId',
      accountType: 'software',
      masterPubKey: '024d30279814a0e609534af1d1969b7c24a6918029e1f9cb2134a427ebfb1f17c3',
      strkAddresses: {
        'argent-x-v0_4_0-with-0-guardians': {
          address: '0x0243daaefed758fb26c5c925f2f63d70cd50c776c4af6d5e4fa805d3174256a0',
        },
      },
      stxAddress: 'SP27YCF0YG7KRY1X0CFJKYTB3C902ZZ84GS7WJ17G',
      stxPublicKey: '03d83268738daa68ac4e9b5fc13ef20765c315d1dd1efddf49f8d19c1407fbcbce',
      btcAddresses: {
        native: {
          address: 'bc1qa8wj4fm45llms5ery8zeuylpwlfv0dt0veyxua',
          publicKey: '0236fd6823db01d7fa2d8306dc693a8caa3353b9025f45481e380d08c0b7766062',
        },
        nested: {
          address: '37Pf81QGHsZJdL5a3zSMSfz9g1f8f1u4z1',
          publicKey: '023725c60f2689098b0d274b4bc0b619c91582ede1351a4a23676f57e7fb8c1d53',
        },
        taproot: {
          address: 'bc1pgsvake49jefrd0ac0v69293r927ngfgq4r5wu9a5k7syk0avszpqyufg9w',
          publicKey: 'b479cfcb98eafd40a9c0e1b8effc228001672a0716f64b5cd758886d39f2a387',
        },
      },
    });
  });

  it('restores expected account testnet', async () => {
    const account = await getAccountFromRootNode({
      rootNode: testRootNode,
      network: 'Testnet',
      derivationIndex: 0n,
      derivationType: 'index',
      walletId: 'walletId' as WalletId,
    });

    expect(account).toEqual({
      id: 0,
      walletId: 'walletId',
      accountType: 'software',
      masterPubKey: '024d30279814a0e609534af1d1969b7c24a6918029e1f9cb2134a427ebfb1f17c3',
      strkAddresses: {
        'argent-x-v0_4_0-with-0-guardians': {
          address: '0x06462ab7c0b54be2a4efa89fa94b4becfc33c78bb96949e83c9f35a07c488396',
        },
      },
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
