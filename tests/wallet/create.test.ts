import { assert, describe, expect, it } from 'vitest';
import { validateMnemonic } from "bip39";
import { newWallet, walletFromSeedPhrase } from '../../wallet'
import { testSeed } from "../mocks";

describe('new wallet', () => {
  it('generates a valid seedPhrase', async () => {
    const wallet = await newWallet();
    expect(wallet.seedPhrase.split(' ').length).toEqual(12);
    expect(validateMnemonic(wallet.seedPhrase)).toBeTruthy();
  });
});

describe('wallet from seed phrase', () => {
  it('restores the same wallet', async () => {
      const wallet = await walletFromSeedPhrase({mnemonic: testSeed, network: 'Mainnet', index: 0n});
      
      expect(wallet.stxAddress).toEqual('SP147ST7ESA3RES888QQMV6AK7GZK93ZR74A0GM7V');
      expect(wallet.btcAddress).toEqual('32A81f7NmkRBq5pYBxGbR989pX3rmSedxr');
      expect(wallet.ordinalsAddress).toEqual('bc1pr09enf3yc43cz8qh7xwaasuv3xzlgfttdr3wn0q2dy9frkhrpdtsk05jqq');
      expect(wallet.masterPubKey).toEqual(
        '024d30279814a0e609534af1d1969b7c24a6918029e1f9cb2134a427ebfb1f17c3'
      );
      expect(wallet.stxPublicKey).toEqual(
        '025df9b0ea2c81e4f8360bf9a16638ed3678bc84dbdc04124f5db86996999aa9a8'
      );
      expect(wallet.btcPublicKey).toEqual(
        '032215d812282c0792c8535c3702cca994f5e3da9cd8502c3e190d422f0066fdff'
      );
      expect(wallet.ordinalsPublicKey).toEqual(
        '5b21869d6643175e0530aeec51d265290d036384990ee60bf089b23ff6b9a367'
      );
    });

    it('restores the same wallet at index 1', async () => {
      const wallet = await walletFromSeedPhrase({mnemonic: testSeed, network: 'Mainnet', index: 1n});

      expect(wallet.stxAddress).toEqual('SP1BKESAFFV8ACW007HACXB93VHRFHP83BT24Z3NF');
      expect(wallet.btcAddress).toEqual('3EMRvkWMLaUfzHPA7Un5qfLZDvbXHn385u');
      expect(wallet.ordinalsAddress).toEqual('bc1pnc669rz0hyncjzxdgfeqm0dfhfr84ues4dwgq4lr47zpltzvekss4ptlxw');
      expect(wallet.masterPubKey).toEqual(
        '024d30279814a0e609534af1d1969b7c24a6918029e1f9cb2134a427ebfb1f17c3'
      );
      expect(wallet.stxPublicKey).toEqual(
        '0302ec9c40f8d5daf319bf4b1556c7f51f1eb449dd96d05e7ed42a1056451dd656'
      );
      expect(wallet.btcPublicKey).toEqual(
        '022e633aba8838c039b2d2214f51ed284d3da7f585744f8975606376c23483d2c1'
      );
      expect(wallet.ordinalsPublicKey).toEqual(
        '380447c41546e736f3d4bf9dc075d2301f5252f33156e3564fd393eeffdaa347'
      );
    });

    it('restores the same wallet at index 4', async () => {
      const wallet = await walletFromSeedPhrase({mnemonic: testSeed, network: 'Mainnet', index: 4n});

      expect(wallet.stxAddress).toEqual('SP1FWDM2J68TZBYCGR0VRTB3FFDAR5GP19PHB7M3Y');
      expect(wallet.btcAddress).toEqual('3Gur3uA5eGsgimFc8DfYbJJ52KjkwfPgp7');
      expect(wallet.ordinalsAddress).toEqual('bc1pt9mfsn7thlck7tlhw6ll2x3xurlclq4gxczrqq99nz9ufsn78j2qlwj50p');
      expect(wallet.masterPubKey).toEqual(
        '024d30279814a0e609534af1d1969b7c24a6918029e1f9cb2134a427ebfb1f17c3'
      );
      expect(wallet.stxPublicKey).toEqual(
        '03b1973efe29dcf47d6afc5d3d813ce7b5354f5a9f04209027a077f79c72aacff5'
      );
      expect(wallet.btcPublicKey).toEqual(
        '02e5ec87babb75a7d8057e961f27f66363000cd9dfd74095fb1cb8ceda27f5e3a8'
      );
      expect(wallet.ordinalsPublicKey).toEqual(
        '8754dc83200dbe5f134e4092cf563d8363cf33e20ab418006d46dd7a6374dc24'
      );
    });
})