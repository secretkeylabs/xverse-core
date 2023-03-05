import { afterEach, assert, describe, expect, it, vi } from 'vitest'
import { 
  getSigningDerivationPath,
  signPsbt
} from '../../transactions/psbt';
import { testSeed } from '../mocks';
import * as btc from 'micro-btc-signer';
import { base64 } from '@scure/base';

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

    const nativeSegwitPath = getSigningDerivationPath(
      accounts,
      nativeSegwitAddress2,
      'Mainnet'
    );

    expect(nativeSegwitPath).eq(`m/84'/0'/0'/0/1`);

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

    const psbt = "cHNidP8BAKcCAAAAAqEBTmLbp6WYROm5RV2POvBGoxaLWl+kWIIthS0z/EiwAAAAAAD/////oQFOYtunpZhE6blFXY868EajFotaX6RYgi2FLTP8SLABAAAAAP////8C+CoAAAAAAAAiUSCFOvHlfzDk35H0m5zN8Pm2iyPu5CHv9995x/YNaG8NRpCRAAAAAAAAF6kUE1jqEog/yiSINDzTHIwsjZpOc8+HAAAAAAABASsQJwAAAAAAACJRIJ41ooxPuSeJCM1Ccg29qbpGevMwq1yAV+OvhB+sTM2hARcgOARHxBVG5zbz1L+dwHXSMB9SUvMxVuNWT9OT7v/ao0cAAQEgSJ0AAAAAAAAXqRQTWOoSiD/KJIg0PNMcjCyNmk5zz4ciAgIA4tYyJ/3UzeAsFhouYJHMqtSYLtwGv3o/RDts3IV2wUgwRQIhAIaOl4qa2hmet1MttngonQu5oGj2oPvqhLygFo+l+tHlAiBOolD4s9EPrxmgntBBDy9QzAMuDc7GvlSpj3TlsRcaOAEBBBYAFGe2rUg89HflW7BtR1VH5NREU7RzAAAA";

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

    const tx = btc.Transaction.fromPSBT(base64.decode(signedTx));
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
  
    const psbt = "cHNidP8BAKcCAAAAAn7vdacbKYO+g11+hOMZ+xvsSEXLNPGuQbQm/Mq6I3S7AAAAAAD/////FhvbUDTpNEMX6RHqSy7CBQZAX9mxAhrYBroYLibENVYBAAAAAP////8C0AcAAAAAAAAiUSCFOvHlfzDk35H0m5zN8Pm2iyPu5CHv9995x/YNaG8NRoA+AAAAAAAAF6kUE1jqEog/yiSINDzTHIwsjZpOc8+HAAAAAAABASuIEwAAAAAAACJRIJ41ooxPuSeJCM1Ccg29qbpGevMwq1yAV+OvhB+sTM2hARNAgNiHV72iPBKx0qDN2hoq4RqmSUTuIoyewDGdVu9RuFy44pomhZEK/NMZqy5LTQI1DmAQYUIbmU4Bqplrtqix+wEXIDgER8QVRuc289S/ncB10jAfUlLzMVbjVk/Tk+7/2qNHAAEBIJg6AAAAAAAAF6kUBSBQKKuqKg3km+Yijh8xEx6n8rCHAQQWABSIOZmRPP+ljTF9RTPJTLlIeHiNswAAAA==";
  
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

    expect(signedTx).eq("cHNidP8BAKcCAAAAAn7vdacbKYO+g11+hOMZ+xvsSEXLNPGuQbQm/Mq6I3S7AAAAAAD/////FhvbUDTpNEMX6RHqSy7CBQZAX9mxAhrYBroYLibENVYBAAAAAP////8C0AcAAAAAAAAiUSCFOvHlfzDk35H0m5zN8Pm2iyPu5CHv9995x/YNaG8NRoA+AAAAAAAAF6kUE1jqEog/yiSINDzTHIwsjZpOc8+HAAAAAAABASuIEwAAAAAAACJRIJ41ooxPuSeJCM1Ccg29qbpGevMwq1yAV+OvhB+sTM2hAQhCAUCA2IdXvaI8ErHSoM3aGirhGqZJRO4ijJ7AMZ1W71G4XLjimiaFkQr80xmrLktNAjUOYBBhQhuZTgGqmWu2qLH7AAEBIJg6AAAAAAAAF6kUBSBQKKuqKg3km+Yijh8xEx6n8rCHAQcXFgAUiDmZkTz/pY0xfUUzyUy5SHh4jbMBCGsCRzBEAiAa9oCjnh7YU8RrqkuVdZUqp+OgNs3Teruv+rFLxqaQGwIgcYW8uBz6lK7I7tmn6FcSF2fZtD8d82oVI/hQuowx9acBIQMiFdgSKCwHkshTXDcCzKmU9ePanNhQLD4ZDUIvAGb9/wAAAA==");
    
    const tx = btc.Transaction.fromPSBT(base64.decode(signedTx));
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
  
    const psbt = "cHNidP8BAKcCAAAAAn7vdacbKYO+g11+hOMZ+xvsSEXLNPGuQbQm/Mq6I3S7AAAAAAD/////FhvbUDTpNEMX6RHqSy7CBQZAX9mxAhrYBroYLibENVYBAAAAAP////8CiBMAAAAAAAAiUSCFOvHlfzDk35H0m5zN8Pm2iyPu5CHv9995x/YNaG8NRiBOAAAAAAAAF6kUE1jqEog/yiSINDzTHIwsjZpOc8+HAAAAAAABASuIEwAAAAAAACJRIJ41ooxPuSeJCM1Ccg29qbpGevMwq1yAV+OvhB+sTM2hARNAyHT/rCiRS2H9DOn84wfDS7cyFthI3t8C7HJTCqw6dKKYw0z9MbTTXMu7OTkoadf6SGtFjJixYwRoDhK4i6MxrAEXIDgER8QVRuc289S/ncB10jAfUlLzMVbjVk/Tk+7/2qNHAAEBIJg6AAAAAAAAF6kUBSBQKKuqKg3km+Yijh8xEx6n8rCHAQQWABSIOZmRPP+ljTF9RTPJTLlIeHiNswAAAA==";
  
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

  it('should fail to sign if account does not exist', async () => {
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
        btcAddress: notaddress,
        ordinalsAddress: notaddress,
        masterPubKey: '12345',
        stxPublicKey: '123',
        btcPublicKey: '123',
      }
    ]

    const psbt = "cHNidP8BAKcCAAAAAqEBTmLbp6WYROm5RV2POvBGoxaLWl+kWIIthS0z/EiwAAAAAAD/////oQFOYtunpZhE6blFXY868EajFotaX6RYgi2FLTP8SLABAAAAAP////8C+CoAAAAAAAAiUSCFOvHlfzDk35H0m5zN8Pm2iyPu5CHv9995x/YNaG8NRpCRAAAAAAAAF6kUE1jqEog/yiSINDzTHIwsjZpOc8+HAAAAAAABASsQJwAAAAAAACJRIJ41ooxPuSeJCM1Ccg29qbpGevMwq1yAV+OvhB+sTM2hARcgOARHxBVG5zbz1L+dwHXSMB9SUvMxVuNWT9OT7v/ao0cAAQEgSJ0AAAAAAAAXqRQTWOoSiD/KJIg0PNMcjCyNmk5zz4ciAgIA4tYyJ/3UzeAsFhouYJHMqtSYLtwGv3o/RDts3IV2wUgwRQIhAIaOl4qa2hmet1MttngonQu5oGj2oPvqhLygFo+l+tHlAiBOolD4s9EPrxmgntBBDy9QzAMuDc7GvlSpj3TlsRcaOAEBBBYAFGe2rUg89HflW7BtR1VH5NREU7RzAAAA";

    await expect(async () => {
      await signPsbt(
        testSeed,
        accounts,
        [{
          address: taprootAddress2,
          signingIndexes: [0],
        }],
        psbt,
        true
      )
    }).rejects.toThrowError(new Error(`Error signing PSBT Error: Address not found`));
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

    const psbt = "cHNidP8BAPACAAAAA5Evp8km1CNBDBIsYggniR/NvUUDBDb6WcuD1DOQsJPUAAAAAAD/////5qwEb0oAGOwAnAR5OLeWLYd6S/SR3sD/X7CbE/e/rhoAAAAAAP////+xBuF/9xcpWDltvahghJUCKL9w3dsIfOSAiILPfJES4AAAAAAA/////wOIEwAAAAAAACJRIIU68eV/MOTfkfSbnM3w+baLI+7kIe/333nH9g1obw1GcBcAAAAAAAAXqRTTBnT+7Rl0Jgm/IVcCmMbXWrT674fECQAAAAAAABepFBNY6hKIP8okiDQ80xyMLI2aTnPPhwAAAAAAAQEfiBMAAAAAAAAWABRJ5yvtU5VOYtvrMzePMJ8uAeH3lgEDBIMAAAAAAQEfcBcAAAAAAAAWABRJ5yvtU5VOYtvrMzePMJ8uAeH3lgEDBIMAAAAAAQEgiBMAAAAAAAAXqRQFIFAoq6oqDeSb5iKOHzETHqfysIciAgMiFdgSKCwHkshTXDcCzKmU9ePanNhQLD4ZDUIvAGb9/0gwRQIhALUopoKdNUWQvldE0hUblLXtpHyOIesrWWZM33iduIFCAiBEJBIL7m1HIldljYZ3zQuka4nAjq/jadmz/d/+mvNXWIMBAwSDAAAAAQQWABSIOZmRPP+ljTF9RTPJTLlIeHiNswAAAAA=";

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

    const tx = btc.Transaction.fromPSBT(base64.decode(signedTx));

    expect(tx.inputs.length).eq(3)
    expect(tx.outputs.length).eq(3)
    expect(tx.outputs[0].amount === 5000)
    expect(tx.outputs[1].amount === 6000)
    expect(tx.outputs[2].amount === 2500)
    expect(signedTx).eq("cHNidP8BAPACAAAAA5Evp8km1CNBDBIsYggniR/NvUUDBDb6WcuD1DOQsJPUAAAAAAD/////5qwEb0oAGOwAnAR5OLeWLYd6S/SR3sD/X7CbE/e/rhoAAAAAAP////+xBuF/9xcpWDltvahghJUCKL9w3dsIfOSAiILPfJES4AAAAAAA/////wOIEwAAAAAAACJRIIU68eV/MOTfkfSbnM3w+baLI+7kIe/333nH9g1obw1GcBcAAAAAAAAXqRTTBnT+7Rl0Jgm/IVcCmMbXWrT674fECQAAAAAAABepFBNY6hKIP8okiDQ80xyMLI2aTnPPhwAAAAAAAQEfiBMAAAAAAAAWABRJ5yvtU5VOYtvrMzePMJ8uAeH3lgEIawJHMEQCIFEYfP/zcvesjerNv9BjZdg0xP3ibEPFoIAsCdZoChulAiBiterMyi5ZwdawGJp6IVxejBtD1mvwqbr9KaqbvPGV04MhAjU3oy1aszimulLxNwjqRcHjyzPCav8/oYLZxm/Utjb/AAEBH3AXAAAAAAAAFgAUSecr7VOVTmLb6zM3jzCfLgHh95YBCGsCRzBEAiBePDGZlesvy66Hj+Sn32gN54PSypIbyYJrngkNNa56IAIgOF7ilSXzITsh3HGKEu17dKUg5U3BxiZyfdxG9LtpJQODIQI1N6MtWrM4prpS8TcI6kXB48szwmr/P6GC2cZv1LY2/wABASCIEwAAAAAAABepFAUgUCirqioN5JvmIo4fMRMep/KwhwEHFxYAFIg5mZE8/6WNMX1FM8lMuUh4eI2zAQhsAkgwRQIhALUopoKdNUWQvldE0hUblLXtpHyOIesrWWZM33iduIFCAiBEJBIL7m1HIldljYZ3zQuka4nAjq/jadmz/d/+mvNXWIMhAyIV2BIoLAeSyFNcNwLMqZT149qc2FAsPhkNQi8AZv3/AAAAAA==")
  })

});
