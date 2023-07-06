import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  Recipient,
  createTransaction,
  calculateFee,
  signBtcTransaction,
  signOrdinalSendTransaction,
  getBtcFees,
  getBtcFeesForOrdinalSend,
  defaultFeeRate,
  selectUnspentOutputs,
  getFee,
  sumUnspentOutputs,
  filterUtxos,
} from '../../transactions/btc';
import { getBtcPrivateKey } from '../../wallet';
import { testSeed } from '../mocks/restore.mock';
import { UTXO } from '../../types';
import BigNumber from 'bignumber.js';
import * as XverseAPIFunctions from '../../api/xverse';
import BitcoinEsploraApiProvider from '../../api/esplora/esploraAPiProvider';

describe('bitcoin transactions', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('can create a wrapped segwit transaction single recipient', async () => {
    const network = 'Mainnet';
    const privateKey = await getBtcPrivateKey({
      seedPhrase: testSeed,
      index: BigInt(0),
      network,
    });
    const unspent1Value = 10000;
    const selectedUnspentOutputs: Array<UTXO> = [
      {
        txid: '1f2bbb92a74d379db2502e8ae7a57917041db5dc531ef54e64ca532aa9f59d8c',
        vout: 2,
        status: {
          confirmed: true,
          block_height: 123123,
          block_time: 1677048365,
          block_hash: '000000000000000000072266ee093771d806cc9cb384461841f9edd40b52b67f',
        },
        value: unspent1Value,
      },
    ];

    const satsToSend = new BigNumber(8000);
    const recipient1Amount = new BigNumber(6000);
    const recipients: Array<Recipient> = [
      {
        address: '1QBwMVYH4efRVwxydnwoGwELJoi47FuRvS',
        amountSats: recipient1Amount,
      },
    ];

    const changeAddress = '1H8voHF7NNoyz76h9s6dZSeoypJQamX4xT';

    const signedTx = createTransaction(
      privateKey,
      selectedUnspentOutputs,
      satsToSend,
      recipients,
      changeAddress,
      network,
    );

    expect(signedTx.inputs.length).eq(1);
    expect(signedTx.outputs.length).eq(2);
    expect(signedTx.outputs[0].amount).eq(BigInt(recipient1Amount.toNumber()));
    expect(signedTx.outputs[1].amount).eq(BigInt(new BigNumber(unspent1Value).minus(satsToSend)));
  });

  it('can create a wrapped segwit transaction multi recipient', async () => {
    const network = 'Mainnet';
    const privateKey = await getBtcPrivateKey({
      seedPhrase: testSeed,
      index: BigInt(0),
      network,
    });
    const unspent1Value = 100000;
    const unspent2Value = 200000;
    const unspent3Value = 300000;
    const totalUnspentValue = unspent1Value + unspent2Value + unspent3Value;

    const selectedUnspentOutputs: Array<UTXO> = [
      {
        txid: '1f2bbb92a74d379db2502e8ae7a57917041db5dc531ef54e64ca532aa9f59d8c',
        vout: 2,
        status: {
          confirmed: true,
          block_height: 123123,
          block_time: 1677048365,
          block_hash: '000000000000000000072266ee093771d806cc9cb384461841f9edd40b52b67f',
        },
        value: unspent1Value,
      },
      {
        txid: '1f2bbb92a74d379db2502e8ae7a57917041db5dc531ef54e64ca532aa9f59d8d',
        vout: 2,
        status: {
          confirmed: true,
          block_height: 123123,
          block_time: 1677048365,
          block_hash: '000000000000000000072266ee093771d806cc9cb384461841f9edd40b52b67f',
        },
        value: unspent2Value,
      },
      {
        txid: '1f2bbb92a74d379db2502e8ae7a57917041db5dc531ef54e64ca532aa9f59d8e',
        vout: 2,
        status: {
          confirmed: true,
          block_height: 123123,
          block_time: 1677048365,
          block_hash: '000000000000000000072266ee093771d806cc9cb384461841f9edd40b52b67f',
        },
        value: unspent3Value,
      },
    ];

    const satsToSend = new BigNumber(300800);
    const recipient1Amount = new BigNumber(200000);
    const recipient2Amount = new BigNumber(100000);

    const recipients: Array<Recipient> = [
      {
        address: '1QBwMVYH4efRVwxydnwoGwELJoi47FuRvS',
        amountSats: recipient1Amount,
      },
      {
        address: '18xdKbDgTKjTZZ9jpbrPax8X4qZeHG6b65',
        amountSats: recipient2Amount,
      },
    ];

    const changeAddress = '1H8voHF7NNoyz76h9s6dZSeoypJQamX4xT';

    const signedTx = createTransaction(
      privateKey,
      selectedUnspentOutputs,
      satsToSend,
      recipients,
      changeAddress,
      network,
    );

    expect(signedTx.inputs.length).eq(3);
    expect(signedTx.outputs.length).eq(3);
    expect(signedTx.outputs[0].amount).eq(BigInt(recipient1Amount.toNumber()));
    expect(signedTx.outputs[1].amount).eq(BigInt(recipient2Amount.toNumber()));
    expect(signedTx.outputs[2].amount).eq(BigInt(totalUnspentValue - satsToSend));
  });

  it('can calculate transaction fee legacy function', async () => {
    const network = 'Mainnet';

    const unspent1Value = 100000;
    const unspent2Value = 200000;
    const unspent3Value = 250000;
    const totalUnspentValue = unspent1Value + unspent2Value + unspent3Value;

    const utxos: Array<UTXO> = [
      {
        txid: '1f2bbb92a74d379db2502e8ae7a57917041db5dc531ef54e64ca532aa9f59d8c',
        vout: 2,
        status: {
          confirmed: true,
          block_height: 123123,
          block_time: 1677048365,
          block_hash: '000000000000000000072266ee093771d806cc9cb384461841f9edd40b52b67f',
        },
        value: unspent1Value,
      },
      {
        txid: '1f2bbb92a74d379db2502e8ae7a57917041db5dc531ef54e64ca532aa9f59d8d',
        vout: 2,
        status: {
          confirmed: true,
          block_height: 123123,
          block_time: 1677048365,
          block_hash: '000000000000000000072266ee093771d806cc9cb384461841f9edd40b52b67f',
        },
        value: unspent2Value,
      },
      {
        txid: '1f2bbb92a74d379db2502e8ae7a57917041db5dc531ef54e64ca532aa9f59d8e',
        vout: 2,
        status: {
          confirmed: true,
          block_height: 123123,
          block_time: 1677048365,
          block_hash: '000000000000000000072266ee093771d806cc9cb384461841f9edd40b52b67f',
        },
        value: unspent3Value,
      },
    ];

    const recipient1Amount = 200000;
    const recipient2Amount = 100000;
    const satsToSend = recipient1Amount + recipient2Amount;

    const recipients: Array<Recipient> = [
      {
        address: '1QBwMVYH4efRVwxydnwoGwELJoi47FuRvS',
        amountSats: new BigNumber(recipient1Amount),
      },
      {
        address: '18xdKbDgTKjTZZ9jpbrPax8X4qZeHG6b65',
        amountSats: new BigNumber(recipient2Amount),
      },
    ];

    const changeAddress = '1H8voHF7NNoyz76h9s6dZSeoypJQamX4xT';

    const fetchFeeRateSpy = vi.spyOn(XverseAPIFunctions, 'fetchBtcFeeRate');
    const feeRate = defaultFeeRate;
    fetchFeeRateSpy.mockImplementation(() => Promise.resolve(feeRate));

    const fetchUtxoSpy = vi.spyOn(BitcoinEsploraApiProvider.prototype, 'getUnspentUtxos');
    fetchUtxoSpy.mockImplementation(() => Promise.resolve(utxos));

    const { fee } = await getBtcFees(recipients, changeAddress, network);

    // expect transaction size to be 385 bytes;
    const txSize = 385;
    expect(fee.toNumber()).eq(txSize * feeRate.regular);
  });

  it('can calculate ordinal send transaction fee legacy function', async () => {
    const network = 'Mainnet';

    const ordinalValue = 80000;
    const unspent1Value = 10000;

    const ordinalUtxoHash = '5541ccb688190cefb350fd1b3594a8317c933a75ff9932a0063b6e8b61a00143';
    const ordinalOutputs: Array<UTXO> = [
      {
        txid: ordinalUtxoHash,
        vout: 2,
        status: {
          confirmed: true,
          block_height: 123123,
          block_time: 1677048365,
          block_hash: '000000000000000000072266ee093771d806cc9cb384461841f9edd40b52b67f',
        },
        value: ordinalValue,
      },
    ];

    const utxos: Array<UTXO> = [
      {
        txid: '1f2bbb92a74d379db2502e8ae7a57917041db5dc531ef54e64ca532aa9f59d8c',
        vout: 2,
        status: {
          confirmed: true,
          block_height: 123123,
          block_time: 1677048365,
          block_hash: '000000000000000000072266ee093771d806cc9cb384461841f9edd40b52b67f',
        },
        value: unspent1Value,
      },
    ];

    const fetchFeeRateSpy = vi.spyOn(XverseAPIFunctions, 'fetchBtcFeeRate');
    const feeRate = defaultFeeRate;
    fetchFeeRateSpy.mockImplementation(() => Promise.resolve(feeRate));

    const fetchUtxoSpy = vi.spyOn(BitcoinEsploraApiProvider.prototype, 'getUnspentUtxos');

    fetchUtxoSpy.mockImplementationOnce(() => Promise.resolve(utxos));
    fetchUtxoSpy.mockImplementationOnce(() => Promise.resolve(ordinalOutputs));

    const recipientAddress = '1QBwMVYH4efRVwxydnwoGwELJoi47FuRvS';
    const ordinalAddress = 'bc1prtztqsgks2l6yuuhgsp36lw5n6dzpkj287lesqnfgktzqajendzq3p9urw';
    const btcAddress = '1H8voHF7NNoyz76h9s6dZSeoypJQamX4xT';

    const ordinalUtxos = [
      {
        address: '3BMxVoc3NVt8BHakAh28WZrpQqQKCxV28U',
        blockHeight: 797404,
        status: {
          block_hash: '00000000000000000003e6c56ae100b34fcc2967bc1deb53de1a4b9c29ba448f',
          block_height: 797404,
          block_time: 1688626274,
          confirmed: true,
        },
        txid: 'd0dfe638a5be4f220f6435616edb5909a2f93540a7d6975ed0bdf305fb8bf51c',
        value: 1347,
        vout: 0,
      },
    ];

    const { fee } = await getBtcFeesForOrdinalSend(
      recipientAddress,
      ordinalOutputs[0],
      btcAddress,
      network,
      ordinalUtxos,
    );

    // expect transaction size to be 260 bytes;
    const txSize = 260;
    expect(fee.toNumber()).eq(txSize * feeRate.regular);
  });

  it('can calculate transaction fee', async () => {
    const network = 'Mainnet';

    const unspent1Value = 100000;
    const unspent2Value = 200000;
    const unspent3Value = 250000;
    const totalUnspentValue = unspent1Value + unspent2Value + unspent3Value;

    const utxos: Array<UTXO> = [
      {
        txid: '1f2bbb92a74d379db2502e8ae7a57917041db5dc531ef54e64ca532aa9f59d8c',
        vout: 2,
        status: {
          confirmed: true,
          block_height: 123123,
          block_time: 1677048365,
          block_hash: '000000000000000000072266ee093771d806cc9cb384461841f9edd40b52b67f',
        },
        value: unspent1Value,
      },
      {
        txid: '1f2bbb92a74d379db2502e8ae7a57917041db5dc531ef54e64ca532aa9f59d8d',
        vout: 2,
        status: {
          confirmed: true,
          block_height: 123123,
          block_time: 1677048365,
          block_hash: '000000000000000000072266ee093771d806cc9cb384461841f9edd40b52b67f',
        },
        value: unspent2Value,
      },
      {
        txid: '1f2bbb92a74d379db2502e8ae7a57917041db5dc531ef54e64ca532aa9f59d8e',
        vout: 2,
        status: {
          confirmed: true,
          block_height: 123123,
          block_time: 1677048365,
          block_hash: '000000000000000000072266ee093771d806cc9cb384461841f9edd40b52b67f',
        },
        value: unspent3Value,
      },
    ];

    const recipient1Amount = 200000;
    const recipient2Amount = 100000;
    const satsToSend = recipient1Amount + recipient2Amount;

    const recipients: Array<Recipient> = [
      {
        address: '1QBwMVYH4efRVwxydnwoGwELJoi47FuRvS',
        amountSats: new BigNumber(recipient1Amount),
      },
      {
        address: '18xdKbDgTKjTZZ9jpbrPax8X4qZeHG6b65',
        amountSats: new BigNumber(recipient2Amount),
      },
    ];

    const changeAddress = '1H8voHF7NNoyz76h9s6dZSeoypJQamX4xT';

    const feeRate = defaultFeeRate;

    const selectedUnspentOutputs = selectUnspentOutputs(new BigNumber(satsToSend), utxos);

    const fee = await calculateFee(
      selectedUnspentOutputs,
      new BigNumber(satsToSend),
      recipients,
      new BigNumber(feeRate.regular),
      changeAddress,
      network,
    );

    // expect transaction size to be 385 bytes;
    const txSize = 261;
    expect(fee.toNumber()).eq(txSize * feeRate.regular);
  });

  it('can create + sign btc transaction', async () => {
    const network = 'Mainnet';

    const unspent1Value = 100000;
    const unspent2Value = 200000;
    const unspent3Value = 1000;
    const unspent4Value = 1000;
    const totalUnspentValue = unspent1Value + unspent2Value + unspent3Value + unspent4Value;

    const utxos: Array<UTXO> = [
      {
        txid: '1f2bbb92a74d379db2502e8ae7a57917041db5dc531ef54e64ca532aa9f59d8c',
        vout: 2,
        status: {
          confirmed: true,
          block_height: 123123,
          block_time: 1677048365,
          block_hash: '000000000000000000072266ee093771d806cc9cb384461841f9edd40b52b67f',
        },
        value: unspent1Value,
      },
      {
        txid: '1f2bbb92a74d379db2502e8ae7a57917041db5dc531ef54e64ca532aa9f59d8d',
        vout: 2,
        status: {
          confirmed: true,
          block_height: 123123,
          block_time: 1677048365,
          block_hash: '000000000000000000072266ee093771d806cc9cb384461841f9edd40b52b67f',
        },
        value: unspent2Value,
      },
      {
        txid: '1f2bbb92a74d379db2502e8ae7a57917041db5dc531ef54e64ca532aa9f59d8e',
        vout: 2,
        status: {
          confirmed: true,
          block_height: 123123,
          block_time: 1677048365,
          block_hash: '000000000000000000072266ee093771d806cc9cb384461841f9edd40b52b67f',
        },
        value: unspent3Value,
      },
      {
        txid: '1f2bbb92a74d379db2502e8ae7a57917041db5dc531ef54e64ca532aa9f59d8f',
        vout: 2,
        status: {
          confirmed: true,
          block_height: 123123,
          block_time: 1677048365,
          block_hash: '000000000000000000072266ee093771d806cc9cb384461841f9edd40b52b67f',
        },
        value: unspent4Value,
      },
    ];

    const recipient1Amount = 200000;
    const recipient2Amount = 100000;
    const satsToSend = recipient1Amount + recipient2Amount;

    const recipients: Array<Recipient> = [
      {
        address: '1QBwMVYH4efRVwxydnwoGwELJoi47FuRvS',
        amountSats: new BigNumber(recipient1Amount),
      },
      {
        address: '18xdKbDgTKjTZZ9jpbrPax8X4qZeHG6b65',
        amountSats: new BigNumber(recipient2Amount),
      },
    ];

    const btcAddress = '1H8voHF7NNoyz76h9s6dZSeoypJQamX4xT';

    const fetchFeeRateSpy = vi.spyOn(XverseAPIFunctions, 'fetchBtcFeeRate');
    const feeRate = {
      limits: {
        min: 1,
        max: 5,
      },
      regular: 2,
      priority: 30,
    };
    fetchFeeRateSpy.mockImplementation(() => Promise.resolve(feeRate));

    const fetchUtxoSpy = vi.spyOn(BitcoinEsploraApiProvider.prototype, 'getUnspentUtxos');
    fetchUtxoSpy.mockImplementation(() => Promise.resolve(utxos));

    const signedTx = await signBtcTransaction(recipients, btcAddress, 0, testSeed, network);

    const tx =
      '020000000001038c9df5a92a53ca644ef51e53dcb51d041779a5e78a2e50b29d374da792bb2b1f0200000017160014883999913cffa58d317d4533c94cb94878788db3ffffffff8d9df5a92a53ca644ef51e53dcb51d041779a5e78a2e50b29d374da792bb2b1f0200000017160014883999913cffa58d317d4533c94cb94878788db3ffffffff8e9df5a92a53ca644ef51e53dcb51d041779a5e78a2e50b29d374da792bb2b1f0200000017160014883999913cffa58d317d4533c94cb94878788db3ffffffff02400d0300000000001976a914fe5c6cac4dd74c23ec8477757298eb137c50ff6388aca0860100000000001976a914574e13c50c3450713ff252a9ad7604db865135e888ac0247304402206b7ba706045ca6c7f01d06372dac86533dff9eeeeb53fb2a2adb56fec612a02502206f9a4984cfab9a9b1eb7b6638e27f2a2fb9d492c6896dce12fbacec4edbb3e620121032215d812282c0792c8535c3702cca994f5e3da9cd8502c3e190d422f0066fdff024830450221008295d854087321da8567e948815c9e15c762c1bb7e2f60fdc67d357e23d49bd90220173b4f1f3955899aa1a916e8423caeca7900dfbe9433027d25eeb5374fdc63810121032215d812282c0792c8535c3702cca994f5e3da9cd8502c3e190d422f0066fdff0247304402201dfd030dfb936406f5bb0d1c94af5bc3dde3eeaa37b05e15ea3479cd43e407ba022048b790d54e400784451991f6df67f35652e577978701d75224b12add0f17ffc80121032215d812282c0792c8535c3702cca994f5e3da9cd8502c3e190d422f0066fdff00000000';
    expect(fetchFeeRateSpy).toHaveBeenCalledTimes(1);
    expect(fetchUtxoSpy).toHaveBeenCalledTimes(1);
    expect(signedTx.fee.toNumber()).eq(signedTx.tx.vsize * feeRate.regular);
    expect(signedTx.signedTx).toEqual(tx);
  });

  it('can create + sign btc transaction with custom fees', async () => {
    const network = 'Mainnet';

    const unspent1Value = 100000;
    const unspent2Value = 200000;
    const unspent3Value = 1000;
    const unspent4Value = 1000;
    const totalUnspentValue = unspent1Value + unspent2Value + unspent3Value + unspent4Value;

    const utxos: Array<UTXO> = [
      {
        txid: '1f2bbb92a74d379db2502e8ae7a57917041db5dc531ef54e64ca532aa9f59d8c',
        vout: 2,
        status: {
          confirmed: true,
          block_height: 123123,
          block_time: 1677048365,
          block_hash: '000000000000000000072266ee093771d806cc9cb384461841f9edd40b52b67f',
        },
        value: unspent1Value,
      },
      {
        txid: '1f2bbb92a74d379db2502e8ae7a57917041db5dc531ef54e64ca532aa9f59d8d',
        vout: 2,
        status: {
          confirmed: true,
          block_height: 123123,
          block_time: 1677048365,
          block_hash: '000000000000000000072266ee093771d806cc9cb384461841f9edd40b52b67f',
        },
        value: unspent2Value,
      },
      {
        txid: '1f2bbb92a74d379db2502e8ae7a57917041db5dc531ef54e64ca532aa9f59d8e',
        value: unspent3Value,
        vout: 2,
        status: {
          confirmed: true,
          block_height: 123123,
          block_time: 1677048365,
          block_hash: '000000000000000000072266ee093771d806cc9cb384461841f9edd40b52b67f',
        },
      },
      {
        txid: '1f2bbb92a74d379db2502e8ae7a57917041db5dc531ef54e64ca532aa9f59d8f',
        value: unspent4Value,
        vout: 2,
        status: {
          confirmed: true,
          block_height: 123123,
          block_time: 1677048365,
          block_hash: '000000000000000000072266ee093771d806cc9cb384461841f9edd40b52b67f',
        },
      },
    ];

    const recipient1Amount = 200000;
    const recipient2Amount = 100000;
    const satsToSend = recipient1Amount + recipient2Amount;

    const recipients: Array<Recipient> = [
      {
        address: '1QBwMVYH4efRVwxydnwoGwELJoi47FuRvS',
        amountSats: new BigNumber(recipient1Amount),
      },
      {
        address: '18xdKbDgTKjTZZ9jpbrPax8X4qZeHG6b65',
        amountSats: new BigNumber(recipient2Amount),
      },
    ];

    const btcAddress = '1H8voHF7NNoyz76h9s6dZSeoypJQamX4xT';

    const fetchFeeRateSpy = vi.spyOn(XverseAPIFunctions, 'fetchBtcFeeRate');
    const feeRate = defaultFeeRate;
    fetchFeeRateSpy.mockImplementation(() => Promise.resolve(feeRate));

    const fetchUtxoSpy = vi.spyOn(BitcoinEsploraApiProvider.prototype, 'getUnspentUtxos');
    fetchUtxoSpy.mockImplementation(() => Promise.resolve(utxos));
    const customFees = new BigNumber(500);

    const signedTx = await signBtcTransaction(recipients, btcAddress, 0, testSeed, network, customFees);

    expect(fetchFeeRateSpy).toHaveBeenCalledTimes(0);
    expect(fetchUtxoSpy).toHaveBeenCalledTimes(1);
    expect(signedTx.fee.toNumber()).eq(customFees.toNumber());
  });

  it('fails to create transaction when insufficient balance after adding fees', async () => {
    const network = 'Mainnet';

    const utxos: Array<UTXO & { address: string; blockHeight?: number }> = [
      {
        address: '3Codr66EYyhkhWy1o2RLmrER7TaaHmtrZe',
        blockHeight: 794533,
        status: {
          block_hash: '0000000000000000000437fc3765a3685b4dc7e2568221ef73a6642bc3ce09fb',
          block_height: 794533,
          block_time: 1686877112,
          confirmed: true,
        },
        txid: '357cd8a47fb6c5b9820c8fa9e7dd5ea1a588ada41761b303f87464d8faa352cd',
        value: 5500,
        vout: 0,
      },
      {
        address: '3Codr66EYyhkhWy1o2RLmrER7TaaHmtrZe',
        blockHeight: 793556,
        status: {
          block_hash: '00000000000000000000a46de80f72757343c538d13be3a992aa733fe33bc4bb',
          block_height: 793556,
          block_time: 1686310361,
          confirmed: true,
        },
        txid: '8b330459af5329c06f8950fda313bbf2e51afc868e3b31c0e1a7acbca2fdffe6',
        value: 3911,
        vout: 1,
      },
      {
        address: '3Codr66EYyhkhWy1o2RLmrER7TaaHmtrZe',
        blockHeight: 793974,
        status: {
          block_hash: '000000000000000000048adca1cd3d995e783f8dda3ce094d0feb0fa7ad35926',
          block_height: 793974,
          block_time: 1686540100,
          confirmed: true,
        },
        txid: '30ff5258040579963b58f066a48daeed5f695329c0afb89c055f72e166a69f42',
        value: 941,
        vout: 12,
      },
      {
        address: '3Codr66EYyhkhWy1o2RLmrER7TaaHmtrZe',
        blockHeight: 793556,
        status: {
          block_hash: '00000000000000000000a46de80f72757343c538d13be3a992aa733fe33bc4bb',
          block_height: 793556,
          block_time: 1686310361,
          confirmed: true,
        },
        txid: '8b330459af5329c06f8950fda313bbf2e51afc868e3b31c0e1a7acbca2fdffe6',
        value: 5700,
        vout: 0,
      },
      {
        address: '3Codr66EYyhkhWy1o2RLmrER7TaaHmtrZe',
        blockHeight: 792930,
        status: {
          block_hash: '0000000000000000000026351fde98eb0b9a3e6e3ea8feceef13186e719c91f5',
          block_height: 792930,
          block_time: 1685945805,
          confirmed: true,
        },
        txid: 'c761835d87e382037e2628431821cfa9a56811a02a0cb4032eb81b72ae9c6b32',
        value: 1510,
        vout: 1,
      },
    ];

    const recipient1Amount = 60000;
    const recipient2Amount = 50000;
    const satsToSend = recipient1Amount + recipient2Amount;

    const recipients: Array<Recipient> = [
      {
        address: '3FijEEhojeNqpt62bKbTbj3zvwghfwcPwK',
        amountSats: new BigNumber(recipient1Amount),
      },
    ];

    const btcAddress = '3Codr66EYyhkhWy1o2RLmrER7TaaHmtrZe';

    const fetchFeeRateSpy = vi.spyOn(XverseAPIFunctions, 'fetchBtcFeeRate');
    expect(fetchFeeRateSpy.getMockName()).toEqual('fetchBtcFeeRate');
    const feeRate = defaultFeeRate;

    fetchFeeRateSpy.mockImplementation(() => Promise.resolve(feeRate));

    const fetchUtxoSpy = vi.spyOn(BitcoinEsploraApiProvider.prototype, 'getUnspentUtxos');
    fetchUtxoSpy.mockImplementation(() => Promise.resolve(utxos));

    await expect(async () => {
      await signBtcTransaction(recipients, btcAddress, 0, testSeed, network);
    }).rejects.toThrowError('601');

    expect(fetchFeeRateSpy).toHaveBeenCalledTimes(1);
    expect(fetchUtxoSpy).toHaveBeenCalledTimes(1);
  });

  it('can create and sign ordinal send transaction', async () => {
    const network = 'Mainnet';

    const ordinalValue = 80000;
    const unspent1Value = 1000;
    const unspent2Value = 10000;

    const ordinalUtxoHash = '5541ccb688190cefb350fd1b3594a8317c933a75ff9932a0063b6e8b61a00143';
    const ordinalOutputs: Array<UTXO> = [
      {
        txid: ordinalUtxoHash,
        value: ordinalValue,
        vout: 2,
        status: {
          confirmed: true,
          block_height: 123123,
          block_time: 1677048365,
          block_hash: '000000000000000000072266ee093771d806cc9cb384461841f9edd40b52b67f',
        },
      },
    ];

    const utxos: Array<UTXO> = [
      {
        txid: '1f2bbb92a74d379db2502e8ae7a57917041db5dc531ef54e64ca532aa9f59d8c',
        value: unspent1Value,
        vout: 2,
        status: {
          confirmed: true,
          block_height: 123123,
          block_time: 1677048365,
          block_hash: '000000000000000000072266ee093771d806cc9cb384461841f9edd40b52b67f',
        },
      },
      {
        txid: '1f2bbb92a74d379db2502e8ae7a57917041db5dc531ef54e64ca532aa9f59d8d',
        value: unspent2Value,
        vout: 2,
        status: {
          confirmed: true,
          block_height: 123123,
          block_time: 1677048365,
          block_hash: '000000000000000000072266ee093771d806cc9cb384461841f9edd40b52b67f',
        },
      },
    ];

    const fetchFeeRateSpy = vi.spyOn(XverseAPIFunctions, 'fetchBtcFeeRate');
    const feeRate = defaultFeeRate;

    fetchFeeRateSpy.mockImplementation(() => Promise.resolve(feeRate));

    const fetchUtxoSpy = vi.spyOn(BitcoinEsploraApiProvider.prototype, 'getUnspentUtxos');

    fetchUtxoSpy.mockImplementationOnce(() => Promise.resolve(utxos));
    fetchUtxoSpy.mockImplementationOnce(() => Promise.resolve(ordinalOutputs));

    const recipientAddress = '1QBwMVYH4efRVwxydnwoGwELJoi47FuRvS';
    const ordinalAddress = 'bc1prtztqsgks2l6yuuhgsp36lw5n6dzpkj287lesqnfgktzqajendzq3p9urw';
    const btcAddress = '1H8voHF7NNoyz76h9s6dZSeoypJQamX4xT';

    const recipients = [
      {
        address: recipientAddress,
        amountSats: new BigNumber(ordinalOutputs[0].value),
      },
    ];

    const filteredUnspentOutputs = filterUtxos(utxos, [ordinalOutputs[0]]);

    let selectedUnspentOutputs = selectUnspentOutputs(
      new BigNumber(ordinalOutputs[0].value),
      filteredUnspentOutputs,
      ordinalOutputs[0],
    );

    const sumSelectedOutputs = sumUnspentOutputs(selectedUnspentOutputs);

    const signedTx = await signOrdinalSendTransaction(
      recipientAddress,
      ordinalOutputs[0],
      btcAddress,
      0,
      testSeed,
      network,
      [ordinalOutputs[0]],
    );

    const { fee } = await getFee(
      filteredUnspentOutputs,
      selectedUnspentOutputs,
      sumSelectedOutputs,
      new BigNumber(ordinalOutputs[0].value),
      recipients,
      feeRate,
      btcAddress,
      network,
      ordinalOutputs[0],
    );

    expect(fetchFeeRateSpy).toHaveBeenCalledTimes(1);
    expect(fetchUtxoSpy).toHaveBeenCalledTimes(1);

    // Needs a better transaction size calculator
    expect(signedTx.fee.toNumber()).eq(fee.toNumber());
  });

  it('can create and sign ordinal send with ordinal utxo in payment address', async () => {
    const network = 'Mainnet';

    const ordinalValue = 80000;
    const unspent1Value = 1000;
    const unspent2Value = 10000;

    const ordinalUtxoHash = '5541ccb688190cefb350fd1b3594a8317c933a75ff9932a0063b6e8b61a00143';
    const ordinalOutputs: Array<UTXO> = [
      {
        txid: ordinalUtxoHash,
        vout: 2,
        status: {
          confirmed: true,
          block_height: 123123,
          block_time: 1677048365,
          block_hash: '000000000000000000072266ee093771d806cc9cb384461841f9edd40b52b67f',
        },
        value: ordinalValue,
      },
    ];

    const utxos: Array<UTXO> = [
      ordinalOutputs[0],
      {
        txid: '1f2bbb92a74d379db2502e8ae7a57917041db5dc531ef54e64ca532aa9f59d8c',
        value: unspent1Value,
        vout: 2,
        status: {
          confirmed: true,
          block_height: 123123,
          block_time: 1677048365,
          block_hash: '000000000000000000072266ee093771d806cc9cb384461841f9edd40b52b67f',
        },
      },
      {
        txid: '1f2bbb92a74d379db2502e8ae7a57917041db5dc531ef54e64ca532aa9f59d8d',
        value: unspent2Value,
        vout: 2,
        status: {
          confirmed: true,
          block_height: 123123,
          block_time: 1677048365,
          block_hash: '000000000000000000072266ee093771d806cc9cb384461841f9edd40b52b67f',
        },
      },
    ];

    const fetchFeeRateSpy = vi.spyOn(XverseAPIFunctions, 'fetchBtcFeeRate');
    const feeRate = {
      limits: {
        min: 1,
        max: 5,
      },
      regular: 10,
      priority: 30,
    };

    fetchFeeRateSpy.mockImplementation(() => Promise.resolve(feeRate));

    const fetchUtxoSpy = vi.spyOn(BitcoinEsploraApiProvider.prototype, 'getUnspentUtxos');

    fetchUtxoSpy.mockImplementationOnce(() => Promise.resolve(utxos));
    fetchUtxoSpy.mockImplementationOnce(() => Promise.resolve(ordinalOutputs));

    const recipientAddress = '1QBwMVYH4efRVwxydnwoGwELJoi47FuRvS';
    const btcAddress = '1H8voHF7NNoyz76h9s6dZSeoypJQamX4xT';

    const signedTx = await signOrdinalSendTransaction(
      recipientAddress,
      ordinalOutputs[0],
      btcAddress,
      0,
      testSeed,
      network,
      [ordinalOutputs[0]],
    );

    const expectedTx =
      '020000000001034301a0618b6e3b06a03299ff753a937c31a894351bfd50b3ef0c1988b6cc41550200000017160014883999913cffa58d317d4533c94cb94878788db3ffffffff8c9df5a92a53ca644ef51e53dcb51d041779a5e78a2e50b29d374da792bb2b1f0200000017160014883999913cffa58d317d4533c94cb94878788db3ffffffff8d9df5a92a53ca644ef51e53dcb51d041779a5e78a2e50b29d374da792bb2b1f0200000017160014883999913cffa58d317d4533c94cb94878788db3ffffffff0280380100000000001976a914fe5c6cac4dd74c23ec8477757298eb137c50ff6388ac421d0000000000001976a914b101d5205c77b52f057cb66498572f3ffe16738688ac024730440220496debceec57ca0b6a9d681d5dcff892b3bdc177a2229464da3d7a2a54955211022078818d398f75905c9c28c9a9e40fc27006fc29435d1d86f5380cc1a9574660cd0121032215d812282c0792c8535c3702cca994f5e3da9cd8502c3e190d422f0066fdff02473044022001f76914fbbbc9e3c4d182f4522ee0f1c10c7b63e7977085700ce42736485284022041dd076c1b4906d69130d3096d875fea2ec20e17f43e020557be2ce60038b88d0121032215d812282c0792c8535c3702cca994f5e3da9cd8502c3e190d422f0066fdff024730440220104a1278f54d395cf432ec9f7bc22846a7d0345940562bb50ca441600e799b9302202d6782eb54413150283d210ca5ea674ef84cd9eb059de6091c61218b3a8ae62c0121032215d812282c0792c8535c3702cca994f5e3da9cd8502c3e190d422f0066fdff00000000';
    expect(fetchFeeRateSpy).toHaveBeenCalledTimes(1);
    expect(fetchUtxoSpy).toHaveBeenCalledTimes(1);
    expect(signedTx.signedTx).eq(expectedTx);
    // Needs a better transaction size calculator
    expect(signedTx.fee.toNumber()).eq(signedTx.tx.vsize * feeRate.regular);
  });

  it('can create and sign oridnal transaction with custom fees', async () => {
    const network = 'Mainnet';

    const ordinalValue = 80000;
    const unspent1Value = 1000;
    const unspent2Value = 10000;

    const ordinalUtxoHash = '5541ccb688190cefb350fd1b3594a8317c933a75ff9932a0063b6e8b61a00143';
    const ordinalOutputs: Array<UTXO> = [
      {
        txid: ordinalUtxoHash,
        value: ordinalValue,
        vout: 2,
        status: {
          confirmed: true,
          block_height: 123123,
          block_time: 1677048365,
          block_hash: '000000000000000000072266ee093771d806cc9cb384461841f9edd40b52b67f',
        },
      },
    ];

    const utxos: Array<UTXO> = [
      {
        txid: '1f2bbb92a74d379db2502e8ae7a57917041db5dc531ef54e64ca532aa9f59d8c',
        value: unspent1Value,
        vout: 2,
        status: {
          confirmed: true,
          block_height: 123123,
          block_time: 1677048365,
          block_hash: '000000000000000000072266ee093771d806cc9cb384461841f9edd40b52b67f',
        },
      },
      {
        txid: '1f2bbb92a74d379db2502e8ae7a57917041db5dc531ef54e64ca532aa9f59d8d',
        value: unspent2Value,
        vout: 2,
        status: {
          confirmed: true,
          block_height: 123123,
          block_time: 1677048365,
          block_hash: '000000000000000000072266ee093771d806cc9cb384461841f9edd40b52b67f',
        },
      },
    ];

    const fetchFeeRateSpy = vi.spyOn(XverseAPIFunctions, 'fetchBtcFeeRate');
    const feeRate = defaultFeeRate;

    fetchFeeRateSpy.mockImplementation(() => Promise.resolve(feeRate));

    const fetchUtxoSpy = vi.spyOn(BitcoinEsploraApiProvider.prototype, 'getUnspentUtxos');

    fetchUtxoSpy.mockImplementationOnce(() => Promise.resolve(utxos));
    fetchUtxoSpy.mockImplementationOnce(() => Promise.resolve(ordinalOutputs));

    const recipientAddress = '1QBwMVYH4efRVwxydnwoGwELJoi47FuRvS';
    const ordinalAddress = 'bc1prtztqsgks2l6yuuhgsp36lw5n6dzpkj287lesqnfgktzqajendzq3p9urw';
    const btcAddress = '1H8voHF7NNoyz76h9s6dZSeoypJQamX4xT';
    const customFeeAmount = new BigNumber(2000);

    const signedTx = await signOrdinalSendTransaction(
      recipientAddress,
      ordinalOutputs[0],
      btcAddress,
      0,
      testSeed,
      network,
      [ordinalOutputs[0]],
      customFeeAmount,
    );

    expect(fetchFeeRateSpy).toHaveBeenCalledTimes(0);
    expect(fetchUtxoSpy).toHaveBeenCalledTimes(1);
    expect(signedTx.fee.toNumber()).eq(customFeeAmount.toNumber());
  });
});
