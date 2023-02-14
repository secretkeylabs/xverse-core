// import { validateMnemonic } from "bip39";
// import { newWallet, walletFromSeedPhrase } from '../../wallet'
// import { testSeed } from "../mocks";

// describe(newWallet, () => {
//   test('generates a valid seedPhrase', async () => {
//     const wallet = await newWallet();
//     expect(wallet.seedPhrase.split(' ').length).toEqual(12);
//     expect(validateMnemonic(wallet.seedPhrase)).toBeTruthy();
//   });
// });

// describe(walletFromSeedPhrase, () => {
//     test('restores the same wallet', async () => {
//       const wallet = await walletFromSeedPhrase({mnemonic: testSeed, network: 'Mainnet', index: 0n});
//       expect(wallet.stxAddress).toEqual('SP2EQNK8PXF2E9XW0ZMEX3BRGHKY906N12GHXPCPF');
//       expect(wallet.btcAddress).toEqual('3PQ46Fy7FAgXH2RxJxiR2wYZSP5hEiBg9m');
//       expect(wallet.masterPubKey).toEqual(
//         '02cc533996523cc0c769d28c94a27933728ce22ab8e45c38394099259994aa9620'
//       );
//       expect(wallet.masterPubKey).toEqual(
//         '02cc533996523cc0c769d28c94a27933728ce22ab8e45c38394099259994aa9620'
//       );
//       expect(wallet.stxPublicKey).toEqual(
//         '02a4b4b5b425f202794e253d3564d6b7eb4c42b1ac6167e8b34be536eabc1328a6'
//       );
//       expect(wallet.btcPublicKey).toEqual(
//         '026622dc822072e073ecd7a9c29f533167f0f741d9c78b989aecbca700d8f71b30'
//       );
//     });
// })