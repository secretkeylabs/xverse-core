import { testSeed } from './mocks';
import { restoreWalletWithAccounts, walletFromSeedPhrase } from '../../wallet';

test('restore wallet accounts', async () => {
  const wallet = await walletFromSeedPhrase({
    mnemonic: testSeed,
    index: 0n,
    network: 'Mainnet',
  });
  const accounts = await restoreWalletWithAccounts(wallet.seedPhrase, {
    type: 'Mainnet',
    address: 'https://stacks-node-api.mainnet.stacks.co'
}
  ,[{...wallet, id: 0}]);
  expect(accounts.length).toBeGreaterThan(0);
});
