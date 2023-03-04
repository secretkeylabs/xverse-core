import { afterEach, assert, describe, expect, it, vi } from 'vitest'
import { 
  getSigningDerivationPath,
  signPsbt
} from '../../transactions/psbt';
import { testSeed } from '../mocks';
import * as btc from 'micro-btc-signer';
import { hex } from '@scure/base';

describe('Bitcoin PSBT tests', () => {
  it('can get signing BTC derivation path from address', async () => {
    const wrappedSegwitAddress1 = '32yeCmBbC2TNopvkogAkk5yhpjiFMPCjcA';
    const taprootAddress1 = 'bc1pgkwmp9u9nel8c36a2t7jwkpq0hmlhmm8gm00kpdxdy864ew2l6zqw2l6vh';

    const nativeSegwitAddress2 = 'bc1q8agphg8kkn8ndvd5am8f44n3uzedcuaz437qdu';
    const taprootAddress2 = 'bc1pzsm9pu47e7npkvxh9dcd0dc2qwqshxt2a9tt7aq3xe9krpl8e82sx6phdj';
    
    const wrappedSegwitAddress3 = '3Gve89xYfW9RZRgRdN7hzCjXAHMDc7QRDf';
    const taprootAddress3 = 'bc1pyzfhlkq29sylwlv72ve52w8mn7hclefzhyay3dxh32r0322yx6uqajvr3y';
    
    const accounts = [
      {
        id: 0,
        stxAddress: 'STXADDRESS1',
        btcAddress: wrappedSegwitAddress1,
        ordinalsAddress: taprootAddress1,
        masterPubKey: '12345',
        stxPublicKey: '123',
        btcPublicKey: '123',
      },
      {
        id: 1,
        stxAddress: 'STXADDRESS2',
        btcAddress: nativeSegwitAddress2,
        ordinalsAddress: taprootAddress2,
        masterPubKey: '12345',
        stxPublicKey: '123',
        btcPublicKey: '123',
      },
      {
        id: 2,
        stxAddress: 'STXADDRESS3',
        btcAddress: wrappedSegwitAddress3,
        ordinalsAddress: taprootAddress3,
        masterPubKey: '12345',
        stxPublicKey: '123',
        btcPublicKey: '123',
      }
    ]

    const wrappedSegwitPath = getSigningDerivationPath(
      accounts,
      wrappedSegwitAddress1,
      'Mainnet'
    );

    expect(wrappedSegwitPath).eq(`m/49'/0'/0'/0/0`);

    const testnetWrappedSegwitPath = getSigningDerivationPath(
      accounts,
      wrappedSegwitAddress1,
      'Testnet'
    );

    expect(testnetWrappedSegwitPath).eq(`m/49'/1'/0'/0/0`);

    // expect(() => getSigningDerivationPath(
    //   accounts,
    //   nativeSegwitAddress2,
    //   'Mainnet'
    // )).toThrowError();

    const taprootPath = getSigningDerivationPath(
      accounts,
      taprootAddress3,
      'Mainnet'
    );

    expect(taprootPath).eq(`m/86'/0'/0'/0/2`);
  })

  it('can sign taproot psbt', async () => {
    const wrappedSegwitAddress2 = '32yeCmBbC2TNopvkogAkk5yhpjiFMPCjcA';
    const taprootAddress2 = 'bc1pnc669rz0hyncjzxdgfeqm0dfhfr84ues4dwgq4lr47zpltzvekss4ptlxw';

    const notaddress = "bc1p60h0xp5c69qxvjarv09xa5r7f0pk5pzsfreytcxrurnuz37vxq9qz6nyrp";

    const accounts = [
      {
        id: 0,
        stxAddress: 'STXADDRESS1',
        btcAddress: notaddress,
        ordinalsAddress: notaddress,
        masterPubKey: '12345',
        stxPublicKey: '123',
        btcPublicKey: '123',
      },
      {
        id: 1,
        stxAddress: 'STXADDRESS2',
        btcAddress: wrappedSegwitAddress2,
        ordinalsAddress: taprootAddress2,
        masterPubKey: '12345',
        stxPublicKey: '123',
        btcPublicKey: '123',
      }
    ]

    const psbt = "70736274ff0100a70200000002a1014e62dba7a59844e9b9455d8f3af046a3168b5a5fa458822d852d33fc48b00000000000ffffffffa1014e62dba7a59844e9b9455d8f3af046a3168b5a5fa458822d852d33fc48b00100000000ffffffff02f82a000000000000225120853af1e57f30e4df91f49b9ccdf0f9b68b23eee421eff7df79c7f60d686f0d46909100000000000017a9141358ea12883fca2488343cd31c8c2c8d9a4e73cf87000000000001012b10270000000000002251209e35a28c4fb9278908cd42720dbda9ba467af330ab5c8057e3af841fac4ccda1011720380447c41546e736f3d4bf9dc075d2301f5252f33156e3564fd393eeffdaa34700010120489d00000000000017a9141358ea12883fca2488343cd31c8c2c8d9a4e73cf8722020200e2d63227fdd4cde02c161a2e6091ccaad4982edc06bf7a3f443b6cdc8576c1483045022100868e978a9ada199eb7532db678289d0bb9a068f6a0fbea84bca0168fa5fad1e502204ea250f8b3d10faf19a09ed0410f2f50cc032e0dcec6be54a98f74e5b1171a3801010416001467b6ad483cf477e55bb06d475547e4d44453b473000000";

    const signedTx = await signPsbt(
      testSeed,
      accounts,
      [{
        address: taprootAddress2,
        signingIndexes: [0],
      }],
      psbt,
      true
    )

    const tx = btc.Transaction.fromRaw(hex.decode(signedTx));
    expect(tx.inputs.length).eq(2);
    expect(tx.outputs.length).eq(2);
  })

  it('can sign p2sh psbt', async () => {
    const wrappedSegwitAddress1 = '32A81f7NmkRBq5pYBxGbR989pX3rmSedxr';
    const taprootAddress1 = 'bc1pnc669rz0hyncjzxdgfeqm0dfhfr84ues4dwgq4lr47zpltzvekss4ptlxw';
  
    const accounts = [
      {
        id: 0,
        stxAddress: 'STXADDRESS1',
        btcAddress: wrappedSegwitAddress1,
        ordinalsAddress: taprootAddress1,
        masterPubKey: '12345',
        stxPublicKey: '123',
        btcPublicKey: '123',
      }
    ]
  
    const psbt = "70736274ff0100a702000000027eef75a71b2983be835d7e84e319fb1bec4845cb34f1ae41b426fccaba2374bb0000000000ffffffff161bdb5034e9344317e911ea4b2ec20506405fd9b1021ad806ba182e26c435560100000000ffffffff02d007000000000000225120853af1e57f30e4df91f49b9ccdf0f9b68b23eee421eff7df79c7f60d686f0d46803e00000000000017a9141358ea12883fca2488343cd31c8c2c8d9a4e73cf87000000000001012b88130000000000002251209e35a28c4fb9278908cd42720dbda9ba467af330ab5c8057e3af841fac4ccda101134080d88757bda23c12b1d2a0cdda1a2ae11aa64944ee228c9ec0319d56ef51b85cb8e29a2685910afcd319ab2e4b4d02350e601061421b994e01aa996bb6a8b1fb011720380447c41546e736f3d4bf9dc075d2301f5252f33156e3564fd393eeffdaa34700010120983a00000000000017a91405205028abaa2a0de49be6228e1f31131ea7f2b0870104160014883999913cffa58d317d4533c94cb94878788db3000000";
  
    const signedTx = await signPsbt(
      testSeed,
      accounts,
      [{
        address: wrappedSegwitAddress1,
        signingIndexes: [1],
      }],
      psbt,
      true
    )

    expect(signedTx).eq("020000000001027eef75a71b2983be835d7e84e319fb1bec4845cb34f1ae41b426fccaba2374bb0000000000ffffffff161bdb5034e9344317e911ea4b2ec20506405fd9b1021ad806ba182e26c435560100000017160014883999913cffa58d317d4533c94cb94878788db3ffffffff02d007000000000000225120853af1e57f30e4df91f49b9ccdf0f9b68b23eee421eff7df79c7f60d686f0d46803e00000000000017a9141358ea12883fca2488343cd31c8c2c8d9a4e73cf87014080d88757bda23c12b1d2a0cdda1a2ae11aa64944ee228c9ec0319d56ef51b85cb8e29a2685910afcd319ab2e4b4d02350e601061421b994e01aa996bb6a8b1fb0247304402201af680a39e1ed853c46baa4b9575952aa7e3a036cdd37abbaffab14bc6a6901b02207185bcb81cfa94aec8eed9a7e857121767d9b43f1df36a1523f850ba8c31f5a70121032215d812282c0792c8535c3702cca994f5e3da9cd8502c3e190d422f0066fdff00000000");
    
    const tx = btc.Transaction.fromRaw(hex.decode(signedTx));
    expect(tx.inputs.length).eq(2);
    expect(tx.outputs.length).eq(2);
  })

  it('should fail to sign psbt if insufficient balance', async () => {
    const wrappedSegwitAddress1 = '32A81f7NmkRBq5pYBxGbR989pX3rmSedxr';
    const taprootAddress1 = 'bc1pnc669rz0hyncjzxdgfeqm0dfhfr84ues4dwgq4lr47zpltzvekss4ptlxw';
  
    const accounts = [
      {
        id: 0,
        stxAddress: 'STXADDRESS1',
        btcAddress: wrappedSegwitAddress1,
        ordinalsAddress: taprootAddress1,
        masterPubKey: '12345',
        stxPublicKey: '123',
        btcPublicKey: '123',
      }
    ]
  
    const psbt = "70736274ff0100a702000000027eef75a71b2983be835d7e84e319fb1bec4845cb34f1ae41b426fccaba2374bb0000000000ffffffff161bdb5034e9344317e911ea4b2ec20506405fd9b1021ad806ba182e26c435560100000000ffffffff028813000000000000225120853af1e57f30e4df91f49b9ccdf0f9b68b23eee421eff7df79c7f60d686f0d46204e00000000000017a9141358ea12883fca2488343cd31c8c2c8d9a4e73cf87000000000001012b88130000000000002251209e35a28c4fb9278908cd42720dbda9ba467af330ab5c8057e3af841fac4ccda1011340c874ffac28914b61fd0ce9fce307c34bb73216d848dedf02ec72530aac3a74a298c34cfd31b4d35ccbbb39392869d7fa486b458c98b16304680e12b88ba331ac011720380447c41546e736f3d4bf9dc075d2301f5252f33156e3564fd393eeffdaa34700010120983a00000000000017a91405205028abaa2a0de49be6228e1f31131ea7f2b0870104160014883999913cffa58d317d4533c94cb94878788db3000000";
  
    await expect(async () => {
      await signPsbt(
        testSeed,
        accounts,
        [{
          address: wrappedSegwitAddress1,
          signingIndexes: [1],
        }],
        psbt,
        true
      )
    }).rejects.toThrowError(new Error(`Error signing PSBT Error: Outputs spends more than inputs amount`));
  })

  it('can sign native segwit psbt with multi input + sighash', async () => {
    const btcAddress = 'bc1qf8njhm2nj48x9kltxvmc7vyl9cq7raukwg6mjk';
    const taprootAddress = 'bc1pnc669rz0hyncjzxdgfeqm0dfhfr84ues4dwgq4lr47zpltzvekss4ptlxw';

    const accounts = [
      {
        id: 0,
        stxAddress: 'STXADDRESS1',
        btcAddress: btcAddress,
        ordinalsAddress: taprootAddress,
        masterPubKey: '12345',
        stxPublicKey: '123',
        btcPublicKey: '123',
      }
    ]

    const psbt = "70736274ff0100f00200000003912fa7c926d423410c122c620827891fcdbd45030436fa59cb83d43390b093d40000000000ffffffffe6ac046f4a0018ec009c047938b7962d877a4bf491dec0ff5fb09b13f7bfae1a0000000000ffffffffb106e17ff7172958396dbda86084950228bf70dddb087ce4808882cf7c9112e00000000000ffffffff038813000000000000225120853af1e57f30e4df91f49b9ccdf0f9b68b23eee421eff7df79c7f60d686f0d46701700000000000017a914d30674feed19742609bf21570298c6d75ab4faef87c40900000000000017a9141358ea12883fca2488343cd31c8c2c8d9a4e73cf87000000000001011f881300000000000016001449e72bed53954e62dbeb33378f309f2e01e1f796010304830000000001011f701700000000000016001449e72bed53954e62dbeb33378f309f2e01e1f7960103048300000000010120881300000000000017a91405205028abaa2a0de49be6228e1f31131ea7f2b0872202032215d812282c0792c8535c3702cca994f5e3da9cd8502c3e190d422f0066fdff483045022100b528a6829d354590be5744d2151b94b5eda47c8e21eb2b59664cdf789db8814202204424120bee6d472257658d8677cd0ba46b89c08eafe369d9b3fddffe9af3575883010304830000000104160014883999913cffa58d317d4533c94cb94878788db300000000";

    const signedTx = await signPsbt(
      testSeed,
      accounts,
      [{
        address: btcAddress,
        signingIndexes: [0, 1],
        sigHash: btc.SignatureHash.SINGLE|btc.SignatureHash.ANYONECANPAY
      }],
      psbt,
      true
    )

    const tx = btc.Transaction.fromRaw(hex.decode(signedTx));

    expect(tx.inputs.length).eq(3)
    expect(tx.outputs.length).eq(3)
    expect(tx.outputs[0].amount === 5000)
    expect(tx.outputs[1].amount === 6000)
    expect(tx.outputs[2].amount === 2500)
    expect(signedTx).eq("02000000000103912fa7c926d423410c122c620827891fcdbd45030436fa59cb83d43390b093d40000000000ffffffffe6ac046f4a0018ec009c047938b7962d877a4bf491dec0ff5fb09b13f7bfae1a0000000000ffffffffb106e17ff7172958396dbda86084950228bf70dddb087ce4808882cf7c9112e00000000017160014883999913cffa58d317d4533c94cb94878788db3ffffffff038813000000000000225120853af1e57f30e4df91f49b9ccdf0f9b68b23eee421eff7df79c7f60d686f0d46701700000000000017a914d30674feed19742609bf21570298c6d75ab4faef87c40900000000000017a9141358ea12883fca2488343cd31c8c2c8d9a4e73cf8702473044022051187cfff372f7ac8deacdbfd06365d834c4fde26c43c5a0802c09d6680a1ba5022062b5eaccca2e59c1d6b0189a7a215c5e8c1b43d66bf0a9bafd29aa9bbcf195d38321023537a32d5ab338a6ba52f13708ea45c1e3cb33c26aff3fa182d9c66fd4b636ff0247304402205e3c319995eb2fcbae878fe4a7df680de783d2ca921bc9826b9e090d35ae7a200220385ee29525f3213b21dc718a12ed7b74a520e54dc1c626727ddc46f4bb6925038321023537a32d5ab338a6ba52f13708ea45c1e3cb33c26aff3fa182d9c66fd4b636ff02483045022100b528a6829d354590be5744d2151b94b5eda47c8e21eb2b59664cdf789db8814202204424120bee6d472257658d8677cd0ba46b89c08eafe369d9b3fddffe9af357588321032215d812282c0792c8535c3702cca994f5e3da9cd8502c3e190d422f0066fdff00000000")
  })

});
