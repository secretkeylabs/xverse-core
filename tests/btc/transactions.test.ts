import { afterEach, assert, describe, expect, it, vi } from 'vitest'
import { 
  Recipient, 
  createTransaction, 
  calculateFee, 
  signBtcTransaction,
  signOrdinalSendTransaction
} from '../../transactions/btc';
import { getBtcPrivateKey } from '../../wallet'
import { testSeed } from '../mocks';
import { 
  BtcUtxoDataResponse, 
  ErrorCodes, 
  NetworkType, 
  ResponseError 
} from '../../types';
import BigNumber from 'bignumber.js';
import * as XverseAPIFunctions from '../../api/xverse';
import * as BTCAPIFunctions from '../../api/btc';

describe('bitcoin transactions', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('can create a wrapped segwit transaction single recipient', async () => {
    const network = "Mainnet";
    const privateKey = await getBtcPrivateKey({ 
      seedPhrase: testSeed, 
      index: BigInt(0), 
      network
    });
    const unspent1Value = 10000;
    const selectedUnspentOutputs: Array<BtcUtxoDataResponse> = [
      { 
        tx_hash: '1f2bbb92a74d379db2502e8ae7a57917041db5dc531ef54e64ca532aa9f59d8c',
        block_height: 123123,
        tx_input_n: -1,
        tx_output_n: 2,
        value: unspent1Value,
        ref_balance: 123123123,
        spent: false,
        confirmations: 100000,
        confirmed: "2020-02-20T02:02:22Z",
        double_spend: false,
        double_spend_tx: "asdf",
      }
    ]

    const satsToSend = new BigNumber(8000);
    const recipient1Amount = new BigNumber(6000);
    const recipients: Array<Recipient> = [
      {
        address: "1QBwMVYH4efRVwxydnwoGwELJoi47FuRvS",
        amountSats: recipient1Amount,
      }
    ]

    const changeAddress = "1H8voHF7NNoyz76h9s6dZSeoypJQamX4xT";

    const signedTx = createTransaction(
      privateKey,
      selectedUnspentOutputs,
      satsToSend,
      recipients,
      changeAddress,
      network
    );

    expect(signedTx.inputs.length).eq(1);
    expect(signedTx.outputs.length).eq(2);
    expect(signedTx.outputs[0].amount).eq(BigInt(recipient1Amount.toNumber()));
    expect(signedTx.outputs[1].amount).eq(BigInt(new BigNumber(unspent1Value).minus(satsToSend)));
  })

  it('can create a wrapped segwit transaction multi recipient', async () => {
    const network = "Mainnet";
    const privateKey = await getBtcPrivateKey({ 
      seedPhrase: testSeed, 
      index: BigInt(0), 
      network
    });
    const unspent1Value = 100000;
    const unspent2Value = 200000;
    const unspent3Value = 300000;
    const totalUnspentValue = unspent1Value + unspent2Value + unspent3Value;

    const selectedUnspentOutputs: Array<BtcUtxoDataResponse> = [
      { 
        tx_hash: '1f2bbb92a74d379db2502e8ae7a57917041db5dc531ef54e64ca532aa9f59d8c',
        block_height: 123123,
        tx_input_n: -1,
        tx_output_n: 2,
        value: unspent1Value,
        ref_balance: 123123123,
        spent: false,
        confirmations: 100000,
        confirmed: "2020-02-20T02:02:22Z",
        double_spend: false,
        double_spend_tx: "asdf",
      },
      { 
        tx_hash: '1f2bbb92a74d379db2502e8ae7a57917041db5dc531ef54e64ca532aa9f59d8d',
        block_height: 123123,
        tx_input_n: -1,
        tx_output_n: 2,
        value: unspent2Value,
        ref_balance: 123123123,
        spent: false,
        confirmations: 100000,
        confirmed: "2020-02-20T02:02:22Z",
        double_spend: false,
        double_spend_tx: "asdf",
      },
      { 
        tx_hash: '1f2bbb92a74d379db2502e8ae7a57917041db5dc531ef54e64ca532aa9f59d8e',
        block_height: 123123,
        tx_input_n: -1,
        tx_output_n: 2,
        value: unspent3Value,
        ref_balance: 123123123,
        spent: false,
        confirmations: 100000,
        confirmed: "2020-02-20T02:02:22Z",
        double_spend: false,
        double_spend_tx: "asdf",
      }
    ]

    const satsToSend = new BigNumber(300800);
    const recipient1Amount = new BigNumber(200000);
    const recipient2Amount = new BigNumber(100000);

    const recipients: Array<Recipient> = [
      {
        address: "1QBwMVYH4efRVwxydnwoGwELJoi47FuRvS",
        amountSats: recipient1Amount,
      },
      {
        address: "18xdKbDgTKjTZZ9jpbrPax8X4qZeHG6b65",
        amountSats: recipient2Amount,
      }
    ]

    const changeAddress = "1H8voHF7NNoyz76h9s6dZSeoypJQamX4xT";

    const signedTx = createTransaction(
      privateKey,
      selectedUnspentOutputs,
      satsToSend,
      recipients,
      changeAddress,
      network
    );

    expect(signedTx.inputs.length).eq(3);
    expect(signedTx.outputs.length).eq(3);
    expect(signedTx.outputs[0].amount).eq(BigInt(recipient1Amount.toNumber()));
    expect(signedTx.outputs[1].amount).eq(BigInt(recipient2Amount.toNumber()));
    expect(signedTx.outputs[2].amount).eq(BigInt(totalUnspentValue-satsToSend));
  })

  it('can calculate transaction fee', async () => {
    const network = "Mainnet";
    const privateKey = await getBtcPrivateKey({ 
      seedPhrase: testSeed, 
      index: BigInt(0), 
      network
    });

    const unspent1Value = 100000;
    const unspent2Value = 200000;
    const unspent3Value = 250000;
    const totalUnspentValue = unspent1Value + unspent2Value + unspent3Value;

    const selectedUnspentOutputs: Array<BtcUtxoDataResponse> = [
      { 
        tx_hash: '1f2bbb92a74d379db2502e8ae7a57917041db5dc531ef54e64ca532aa9f59d8c',
        block_height: 123123,
        tx_input_n: -1,
        tx_output_n: 2,
        value: unspent1Value,
        ref_balance: 123123123,
        spent: false,
        confirmations: 100000,
        confirmed: "2020-02-20T02:02:22Z",
        double_spend: false,
        double_spend_tx: "asdf",
      },
      { 
        tx_hash: '1f2bbb92a74d379db2502e8ae7a57917041db5dc531ef54e64ca532aa9f59d8d',
        block_height: 123123,
        tx_input_n: -1,
        tx_output_n: 2,
        value: unspent2Value,
        ref_balance: 123123123,
        spent: false,
        confirmations: 100000,
        confirmed: "2020-02-20T02:02:22Z",
        double_spend: false,
        double_spend_tx: "asdf",
      },
      { 
        tx_hash: '1f2bbb92a74d379db2502e8ae7a57917041db5dc531ef54e64ca532aa9f59d8e',
        block_height: 123123,
        tx_input_n: -1,
        tx_output_n: 2,
        value: unspent3Value,
        ref_balance: 123123123,
        spent: false,
        confirmations: 100000,
        confirmed: "2020-02-20T02:02:22Z",
        double_spend: false,
        double_spend_tx: "asdf",
      }
    ]

    const recipient1Amount = 200000;
    const recipient2Amount = 100000;
    const satsToSend = recipient1Amount+recipient2Amount;

    const recipients: Array<Recipient> = [
      {
        address: "1QBwMVYH4efRVwxydnwoGwELJoi47FuRvS",
        amountSats: new BigNumber(recipient1Amount),
      },
      {
        address: "18xdKbDgTKjTZZ9jpbrPax8X4qZeHG6b65",
        amountSats: new BigNumber(recipient2Amount),
      }
    ]

    const changeAddress = "1H8voHF7NNoyz76h9s6dZSeoypJQamX4xT";

    const feeRate = {
      limits: {
        min: 1,
        max: 5,
      },
      regular: 10,
      priority: 30
    }

    const fee = await calculateFee(
      selectedUnspentOutputs,
      new BigNumber(satsToSend),
      recipients,
      feeRate,
      changeAddress,
      network
    );

    // expect transaction size to be 385 bytes;
    const txSize = 385;
    expect(fee.toNumber()).eq(txSize*feeRate.regular);
  })

  it('can create + sign btc transaction', async () => {
    const network = "Mainnet";

    const unspent1Value = 100000;
    const unspent2Value = 200000;
    const unspent3Value = 1000;
    const unspent4Value = 1000;
    const totalUnspentValue = unspent1Value + unspent2Value + unspent3Value + unspent4Value;

    const utxos: Array<BtcUtxoDataResponse> = [
      { 
        tx_hash: '1f2bbb92a74d379db2502e8ae7a57917041db5dc531ef54e64ca532aa9f59d8c',
        block_height: 123123,
        tx_input_n: -1,
        tx_output_n: 2,
        value: unspent1Value,
        ref_balance: 123123123,
        spent: false,
        confirmations: 100000,
        confirmed: "2020-02-20T02:02:22Z",
        double_spend: false,
        double_spend_tx: "asdf",
      },
      { 
        tx_hash: '1f2bbb92a74d379db2502e8ae7a57917041db5dc531ef54e64ca532aa9f59d8d',
        block_height: 123123,
        tx_input_n: -1,
        tx_output_n: 2,
        value: unspent2Value,
        ref_balance: 123123123,
        spent: false,
        confirmations: 100000,
        confirmed: "2020-02-20T02:02:22Z",
        double_spend: false,
        double_spend_tx: "asdf",
      },
      { 
        tx_hash: '1f2bbb92a74d379db2502e8ae7a57917041db5dc531ef54e64ca532aa9f59d8e',
        block_height: 123123,
        tx_input_n: -1,
        tx_output_n: 2,
        value: unspent3Value,
        ref_balance: 123123123,
        spent: false,
        confirmations: 100000,
        confirmed: "2020-02-20T02:02:22Z",
        double_spend: false,
        double_spend_tx: "asdf",
      },
      { 
        tx_hash: '1f2bbb92a74d379db2502e8ae7a57917041db5dc531ef54e64ca532aa9f59d8f',
        block_height: 123123,
        tx_input_n: -1,
        tx_output_n: 2,
        value: unspent4Value,
        ref_balance: 123123123,
        spent: false,
        confirmations: 100000,
        confirmed: "2020-02-20T02:02:22Z",
        double_spend: false,
        double_spend_tx: "asdf",
      }
    ]

    const recipient1Amount = 200000;
    const recipient2Amount = 100000;
    const satsToSend = recipient1Amount+recipient2Amount;

    const recipients: Array<Recipient> = [
      {
        address: "1QBwMVYH4efRVwxydnwoGwELJoi47FuRvS",
        amountSats: new BigNumber(recipient1Amount),
      },
      {
        address: "18xdKbDgTKjTZZ9jpbrPax8X4qZeHG6b65",
        amountSats: new BigNumber(recipient2Amount),
      }
    ]

    const btcAddress = "1H8voHF7NNoyz76h9s6dZSeoypJQamX4xT";

    const fetchFeeRateSpy = vi.spyOn(XverseAPIFunctions, 'fetchBtcFeeRate')
    const feeRate = {
      limits: {
        min: 1,
        max: 5,
      },
      regular: 2,
      priority: 30
    }
    fetchFeeRateSpy.mockImplementation(() => Promise.resolve(feeRate))

    const fetchUtxoSpy = vi.spyOn(BTCAPIFunctions, 'fetchBtcAddressUnspent')
    fetchUtxoSpy.mockImplementation(() => Promise.resolve(utxos))

    const signedTx = await signBtcTransaction(
      recipients,
      btcAddress,
      0,
      testSeed,
      network
    )

    const tx = "020000000001038c9df5a92a53ca644ef51e53dcb51d041779a5e78a2e50b29d374da792bb2b1f0200000017160014883999913cffa58d317d4533c94cb94878788db3ffffffff8d9df5a92a53ca644ef51e53dcb51d041779a5e78a2e50b29d374da792bb2b1f0200000017160014883999913cffa58d317d4533c94cb94878788db3ffffffff8e9df5a92a53ca644ef51e53dcb51d041779a5e78a2e50b29d374da792bb2b1f0200000017160014883999913cffa58d317d4533c94cb94878788db3ffffffff02400d0300000000001976a914fe5c6cac4dd74c23ec8477757298eb137c50ff6388aca0860100000000001976a914574e13c50c3450713ff252a9ad7604db865135e888ac0247304402206b7ba706045ca6c7f01d06372dac86533dff9eeeeb53fb2a2adb56fec612a02502206f9a4984cfab9a9b1eb7b6638e27f2a2fb9d492c6896dce12fbacec4edbb3e620121032215d812282c0792c8535c3702cca994f5e3da9cd8502c3e190d422f0066fdff024830450221008295d854087321da8567e948815c9e15c762c1bb7e2f60fdc67d357e23d49bd90220173b4f1f3955899aa1a916e8423caeca7900dfbe9433027d25eeb5374fdc63810121032215d812282c0792c8535c3702cca994f5e3da9cd8502c3e190d422f0066fdff0247304402201dfd030dfb936406f5bb0d1c94af5bc3dde3eeaa37b05e15ea3479cd43e407ba022048b790d54e400784451991f6df67f35652e577978701d75224b12add0f17ffc80121032215d812282c0792c8535c3702cca994f5e3da9cd8502c3e190d422f0066fdff00000000"
    expect(fetchFeeRateSpy).toHaveBeenCalledTimes(1)
    expect(fetchUtxoSpy).toHaveBeenCalledTimes(1)
    expect(signedTx.fee.toNumber()).eq(signedTx.tx.vsize*feeRate.regular);
    expect(signedTx.signedTx).toEqual(tx);
  })

  it('fails to create transaction when insufficient balance after adding fees', async () => {
    const network = "Mainnet";

    const unspent1Value = 100000;
    const unspent2Value = 1800;
    const unspent3Value = 1000;
    const totalUnspentValue = unspent1Value +  + unspent2Value + unspent3Value;

    const utxos: Array<BtcUtxoDataResponse> = [
      { 
        tx_hash: '1f2bbb92a74d379db2502e8ae7a57917041db5dc531ef54e64ca532aa9f59d8c',
        block_height: 123123,
        tx_input_n: -1,
        tx_output_n: 2,
        value: unspent1Value,
        ref_balance: 123123123,
        spent: false,
        confirmations: 100000,
        confirmed: "2020-02-20T02:02:22Z",
        double_spend: false,
        double_spend_tx: "asdf",
      },
      { 
        tx_hash: '1f2bbb92a74d379db2502e8ae7a57917041db5dc531ef54e64ca532aa9f59d8d',
        block_height: 123123,
        tx_input_n: -1,
        tx_output_n: 2,
        value: unspent2Value,
        ref_balance: 123123123,
        spent: false,
        confirmations: 100000,
        confirmed: "2020-02-20T02:02:22Z",
        double_spend: false,
        double_spend_tx: "asdf",
      },
      { 
        tx_hash: '1f2bbb92a74d379db2502e8ae7a57917041db5dc531ef54e64ca532aa9f59d8e',
        block_height: 123123,
        tx_input_n: -1,
        tx_output_n: 2,
        value: unspent3Value,
        ref_balance: 123123123,
        spent: false,
        confirmations: 100000,
        confirmed: "2020-02-20T02:02:22Z",
        double_spend: false,
        double_spend_tx: "asdf",
      }
    ]

    const recipient1Amount = 50000;
    const recipient2Amount = 50000;
    const satsToSend = recipient1Amount+recipient2Amount;

    const recipients: Array<Recipient> = [
      {
        address: "1QBwMVYH4efRVwxydnwoGwELJoi47FuRvS",
        amountSats: new BigNumber(recipient1Amount),
      },
      {
        address: "18xdKbDgTKjTZZ9jpbrPax8X4qZeHG6b65",
        amountSats: new BigNumber(recipient2Amount),
      }
    ]

    const btcAddress = "1H8voHF7NNoyz76h9s6dZSeoypJQamX4xT";

    const fetchFeeRateSpy = vi.spyOn(XverseAPIFunctions, 'fetchBtcFeeRate')
    expect(fetchFeeRateSpy.getMockName()).toEqual('fetchBtcFeeRate')
    const feeRate = {
      limits: {
        min: 1,
        max: 5,
      },
      regular: 10,
      priority: 30
    }

    fetchFeeRateSpy.mockImplementation(() => Promise.resolve(feeRate))

    const fetchUtxoSpy = vi.spyOn(BTCAPIFunctions, 'fetchBtcAddressUnspent')
    fetchUtxoSpy.mockImplementation(() => Promise.resolve(utxos))

    await expect(async () => {
      await signBtcTransaction(
        recipients,
        btcAddress,
        0,
        testSeed,
        network
      )
    }).rejects.toThrowError(new ResponseError(ErrorCodes.InSufficientBalanceWithTxFee));

    expect(fetchFeeRateSpy).toHaveBeenCalledTimes(1)
    expect(fetchUtxoSpy).toHaveBeenCalledTimes(1)
  })

  it('can create and sign ordinal send transaction', async () => {
    const network = "Mainnet";

    const ordinalValue = 80000;
    const unspent1Value = 1000;
    const unspent2Value = 10000;

    const ordinalUtxoHash = "5541ccb688190cefb350fd1b3594a8317c933a75ff9932a0063b6e8b61a00143";
    const ordinalOutputs: Array<BtcUtxoDataResponse> = [
      { 
        tx_hash: 'notordinal111114d379db2502e8ae7a57917041db5dc531ef54e64ca532aa9f59abc',
        block_height: 123123,
        tx_input_n: -1,
        tx_output_n: 2,
        value: ordinalValue,
        ref_balance: 123123123,
        spent: false,
        confirmations: 100000,
        confirmed: "2020-02-20T02:02:22Z",
        double_spend: false,
        double_spend_tx: "asdf",
      },
      { 
        tx_hash: ordinalUtxoHash,
        block_height: 123123,
        tx_input_n: -1,
        tx_output_n: 2,
        value: ordinalValue,
        ref_balance: 123123123,
        spent: false,
        confirmations: 100000,
        confirmed: "2020-02-20T02:02:22Z",
        double_spend: false,
        double_spend_tx: "asdf",
      }
    ];

    const utxos: Array<BtcUtxoDataResponse> = [
      { 
        tx_hash: '1f2bbb92a74d379db2502e8ae7a57917041db5dc531ef54e64ca532aa9f59d8c',
        block_height: 123123,
        tx_input_n: -1,
        tx_output_n: 2,
        value: unspent1Value,
        ref_balance: 123123123,
        spent: false,
        confirmations: 100000,
        confirmed: "2020-02-20T02:02:22Z",
        double_spend: false,
        double_spend_tx: "asdf",
      },
      { 
        tx_hash: '1f2bbb92a74d379db2502e8ae7a57917041db5dc531ef54e64ca532aa9f59d8d',
        block_height: 123123,
        tx_input_n: -1,
        tx_output_n: 2,
        value: unspent2Value,
        ref_balance: 123123123,
        spent: false,
        confirmations: 100000,
        confirmed: "2020-02-20T02:02:22Z",
        double_spend: false,
        double_spend_tx: "asdf",
      },
    ]

    const fetchFeeRateSpy = vi.spyOn(XverseAPIFunctions, 'fetchBtcFeeRate')
    const feeRate = {
      limits: {
        min: 1,
        max: 5,
      },
      regular: 10,
      priority: 30
    }

    fetchFeeRateSpy.mockImplementation(() => Promise.resolve(feeRate))

    const fetchUtxoSpy = vi.spyOn(BTCAPIFunctions, 'fetchBtcAddressUnspent')

    fetchUtxoSpy.mockImplementationOnce(() => Promise.resolve(utxos))
    fetchUtxoSpy.mockImplementationOnce(() => Promise.resolve(ordinalOutputs))

    const recipientAddress = "1QBwMVYH4efRVwxydnwoGwELJoi47FuRvS";
    const ordinalAddress = "bc1prtztqsgks2l6yuuhgsp36lw5n6dzpkj287lesqnfgktzqajendzq3p9urw";
    const btcAddress = "1H8voHF7NNoyz76h9s6dZSeoypJQamX4xT";

    const signedTx = await signOrdinalSendTransaction(
      recipientAddress,
      ordinalAddress,
      ordinalUtxoHash,
      btcAddress,
      0,
      testSeed,
      network
    )

    expect(fetchFeeRateSpy).toHaveBeenCalledTimes(1)
    expect(fetchUtxoSpy).toHaveBeenCalledTimes(2)
    // expect(signedTx.signedTx).eq(expectedTx)
    // Needs a better transaction size calculator
    // expect(signedTx.fee.toNumber()).eq(signedTx.tx.vsize*feeRate.regular);
  })
})
