import { walletFromSeedPhrase } from '../../wallet';
import { restoreWalletWithAccounts } from '../../account';
import { StacksMainnet } from '@stacks/network';
import { assert, describe, expect, it } from 'vitest';

describe('bitcoin transactions', () => {
  it('empty test', async () => {

  });

  // it('restore wallet accounts', async () => {
  //   const wallet = await walletFromSeedPhrase({
  //     mnemonic: testSeed,
  //     index: 0n,
  //     network: 'Mainnet',
  //   });
  //   const accounts = await restoreWalletWithAccounts(
  //     wallet.seedPhrase,
  //     {
  //       type: 'Mainnet',
  //       address: 'https://stacks-node-api.mainnet.stacks.co',
  //     },
  //     new StacksMainnet(),
  //     [{ ...wallet, id: 0 }]
  //   );
  //   expect(accounts.length).toEqual(4);
  // });
})