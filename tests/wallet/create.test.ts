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
      expect(wallet.stxAddress).toEqual('SP2EQNK8PXF2E9XW0ZMEX3BRGHKY906N12GHXPCPF');
      expect(wallet.btcAddress).toEqual('3PQ46Fy7FAgXH2RxJxiR2wYZSP5hEiBg9m');
      expect(wallet.ordinalsAddress).toEqual('bc1ppyxnqk6c9gjx9leg9eajtwv2ntlmvte66k6yv9jq42xtzwzc8trsqsdg9s');
      expect(wallet.masterPubKey).toEqual(
        '02cc533996523cc0c769d28c94a27933728ce22ab8e45c38394099259994aa9620'
      );
      expect(wallet.stxPublicKey).toEqual(
        '02a4b4b5b425f202794e253d3564d6b7eb4c42b1ac6167e8b34be536eabc1328a6'
      );
      expect(wallet.btcPublicKey).toEqual(
        '026622dc822072e073ecd7a9c29f533167f0f741d9c78b989aecbca700d8f71b30'
      );
    });

    it('restores the same wallet at index 1', async () => {
      const wallet = await walletFromSeedPhrase({mnemonic: testSeed, network: 'Mainnet', index: 1n});
      expect(wallet.stxAddress).toEqual('SP26Z225PX6E3KDPKR544052VRNNAZXGXYNWYPFHH');
      expect(wallet.btcAddress).toEqual('3D2QAjo7kQxQ2Xfi4XWr2hCFkfTfA61dYx');
      expect(wallet.ordinalsAddress).toEqual('bc1pnmq0yyugku3mn4d7cwr8wn9tr2sm8c5n9n69nn4r8g9aq4a7c9xq2wz06h');
      expect(wallet.masterPubKey).toEqual(
        '02cc533996523cc0c769d28c94a27933728ce22ab8e45c38394099259994aa9620'
      );
      expect(wallet.stxPublicKey).toEqual(
        '0391bf22b7f9db01476c160a9a0d980f6facf0f8de63916cb56b69cbb079b9ca28'
      );
      expect(wallet.btcPublicKey).toEqual(
        '0299b760303bf4b8bf335b4452d405ee84206b1078a7f8040b58d6c5bd9a577c39'
      );
    });

    it('restores the same wallet at index 4', async () => {
      const wallet = await walletFromSeedPhrase({mnemonic: testSeed, network: 'Mainnet', index: 4n});
      console.log(wallet);
      expect(wallet.stxAddress).toEqual('SP2MJ475EZFR113YFVVZ8FQG1MSF7W1E4FSZJ66JZ');
      expect(wallet.btcAddress).toEqual('32gRtcuUNvkfhAcvPoZGMj2pPEMLZ5ZXRx');
      expect(wallet.ordinalsAddress).toEqual('bc1p2zhm3vr5zqv6l65av7stzlpyjtalxksl9fy93uzk353c4kw8zr7sx08pqq');
      expect(wallet.masterPubKey).toEqual(
        '02cc533996523cc0c769d28c94a27933728ce22ab8e45c38394099259994aa9620'
      );
      expect(wallet.stxPublicKey).toEqual(
        '02d25922bedc2668c68cea75c4e4e51eea13b33ded9bf472cb84e697e76b3241bc'
      );
      expect(wallet.btcPublicKey).toEqual(
        '03601fd4e78bc1aef62fa84b97b7192d85d2237ec585f78ed6cf5829f84f260e0d'
      );
    });
})