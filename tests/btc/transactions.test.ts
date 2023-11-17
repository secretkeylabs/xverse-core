/* eslint-disable max-len */
import BigNumber from 'bignumber.js';
import { afterEach, describe, expect, it, vi } from 'vitest';
import BitcoinEsploraApiProvider from '../../api/esplora/esploraAPiProvider';
import * as XverseAPIFunctions from '../../api/xverse';
import {
  Recipient,
  calculateFee,
  createTransaction,
  defaultFeeRate,
  filterUtxos,
  getBtcFees,
  getBtcFeesForOrdinalSend,
  getBtcFeesForOrdinalTransaction,
  getFee,
  selectUnspentOutputs,
  signBtcTransaction,
  signOrdinalSendTransaction,
  signOrdinalTransaction,
  sumUnspentOutputs,
} from '../../transactions/btc';
import * as BTCFunctions from '../../transactions/btc.utils';
import { UTXO } from '../../types';
import { getBtcPrivateKey } from '../../wallet';
import { testSeed } from '../mocks/restore.mock';

describe('UTXO selection', () => {
  const createUtxo = (value: number, confirmed: boolean): UTXO => ({
    address: 'address',
    txid: 'txid',
    vout: 0,
    value,
    status: {
      confirmed,
      block_height: confirmed ? 123123 : undefined,
      block_time: confirmed ? 1677048365 : undefined,
      block_hash: confirmed ? 'block_hash' : undefined,
    },
  });

  it('selects UTXO of highest value first', () => {
    const testUtxos = [createUtxo(10000, true), createUtxo(20000, true)];

    const utxos = selectUnspentOutputs(new BigNumber(10000), [...testUtxos], undefined, 22);

    expect(utxos.length).eq(1);
    expect(utxos[0]).toBe(testUtxos[1]);
  });

  it('selects multiple UTXOs if needed', () => {
    const testUtxos = [createUtxo(10000, true), createUtxo(20000, true)];

    const utxos = selectUnspentOutputs(new BigNumber(25000), [...testUtxos], undefined, 22);

    expect(utxos.length).eq(2);
    expect(utxos[0]).toBe(testUtxos[1]);
    expect(utxos[1]).toBe(testUtxos[0]);
  });

  it('deprioritises unconfirmed UTXOs', () => {
    const testUtxos = [createUtxo(10000, true), createUtxo(20000, true), createUtxo(30000, false)];

    const utxos = selectUnspentOutputs(new BigNumber(10000), [...testUtxos], undefined, 22);
    expect(utxos.length).eq(1);
    expect(utxos[0]).toBe(testUtxos[1]);
  });

  it('Uses unconfirmed UTXOs if sats to send high enough', () => {
    const testUtxos = [createUtxo(10000, true), createUtxo(20000, true), createUtxo(30000, false)];

    let utxos = selectUnspentOutputs(new BigNumber(30000), [...testUtxos], undefined, 22);
    expect(utxos.length).eq(2);
    expect(utxos[0]).toBe(testUtxos[1]);
    expect(utxos[1]).toBe(testUtxos[0]);

    utxos = selectUnspentOutputs(new BigNumber(40000), [...testUtxos], undefined, 22);
    expect(utxos.length).eq(3);
    expect(utxos[0]).toBe(testUtxos[1]);
    expect(utxos[1]).toBe(testUtxos[0]);
    expect(utxos[2]).toBe(testUtxos[2]);
  });

  it('Ignores UTXOs if they are dust at desired fee rate', () => {
    const testUtxos = [createUtxo(10000, true), createUtxo(20000, true), createUtxo(30000, false)];

    // This should make the 10000 UTXO dust at the desired fee rate
    // as adding it would increase the fee by 10500 (more than the value of the UTXO)
    const utxos = selectUnspentOutputs(new BigNumber(30000), [...testUtxos], undefined, 150);
    expect(utxos.length).eq(2);
    expect(utxos[0]).toBe(testUtxos[1]);
    expect(utxos[1]).toBe(testUtxos[2]);
  });
});

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
        address: '1H8voHF7NNoyz76h9s6dZSeoypJQamX4xT',
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

    expect(signedTx.inputsLength).eq(1);
    expect(signedTx.outputsLength).eq(2);
    expect(signedTx.getOutput(0).amount).eq(BigInt(recipient1Amount.toNumber()));
    expect(signedTx.getOutput(1).amount).eq(BigInt(new BigNumber(unspent1Value).minus(satsToSend).toNumber()));
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
        address: '1H8voHF7NNoyz76h9s6dZSeoypJQamX4xT',
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
        address: '1H8voHF7NNoyz76h9s6dZSeoypJQamX4xT',
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
        address: '1H8voHF7NNoyz76h9s6dZSeoypJQamX4xT',
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

    expect(signedTx.inputsLength).eq(3);
    expect(signedTx.outputsLength).eq(3);
    expect(signedTx.getOutput(0).amount).eq(BigInt(recipient1Amount.toNumber()));
    expect(signedTx.getOutput(1).amount).eq(BigInt(recipient2Amount.toNumber()));
    expect(signedTx.getOutput(2).amount).eq(BigInt(totalUnspentValue - satsToSend.toNumber()));
  });

  it('can calculate transaction fee legacy function', async () => {
    const network = 'Mainnet';

    const unspent1Value = 100000;
    const unspent2Value = 200000;
    const unspent3Value = 250000;

    const changeAddress = '1H8voHF7NNoyz76h9s6dZSeoypJQamX4xT';

    const utxos: Array<UTXO & { address: string; blockHeight?: number }> = [
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
        address: changeAddress,
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
        address: changeAddress,
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
        address: changeAddress,
      },
    ];

    const recipient1Amount = 200000;
    const recipient2Amount = 100000;

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

    const fetchFeeRateSpy = vi.spyOn(XverseAPIFunctions, 'fetchBtcFeeRate');
    const feeRate = defaultFeeRate;
    fetchFeeRateSpy.mockImplementation(() => Promise.resolve(feeRate));

    const fetchUtxoSpy = vi.spyOn(BitcoinEsploraApiProvider.prototype, 'getUnspentUtxos');
    fetchUtxoSpy.mockImplementation(() => Promise.resolve(utxos));

    const { fee } = await getBtcFees(recipients, changeAddress, network);

    // expect transaction size to be 295 bytes;
    const txSize = 295;
    expect(fee.toNumber()).eq(txSize * feeRate.regular);
  });

  it('can calculate ordinal send transaction fee legacy function', async () => {
    const network = 'Mainnet';

    const ordinalValue = 80000;
    const unspent1Value = 10000;

    const btcAddress = '1H8voHF7NNoyz76h9s6dZSeoypJQamX4xT';
    const recipientAddress = '1QBwMVYH4efRVwxydnwoGwELJoi47FuRvS';
    const ordinalAddress = 'bc1prtztqsgks2l6yuuhgsp36lw5n6dzpkj287lesqnfgktzqajendzq3p9urw';

    const ordinalUtxoHash = '5541ccb688190cefb350fd1b3594a8317c933a75ff9932a0063b6e8b61a00143';
    const ordinalOutputs: Array<UTXO & { address: string; blockHeight?: number }> = [
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
        address: ordinalAddress,
      },
      {
        status: {
          block_hash: '00000000000000000003e6c56ae100b34fcc2967bc1deb53de1a4b9c29ba448f',
          block_height: 797404,
          block_time: 1688626274,
          confirmed: true,
        },
        txid: 'd0dfe638a5be4f220f6435616edb5909a2f93540a7d6975ed0bdf305fb8bf51c',
        value: 1347,
        vout: 0,
        address: ordinalAddress,
      },
    ];

    const utxos: Array<UTXO & { address: string; blockHeight?: number }> = [
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
        address: btcAddress,
      },
      ...ordinalOutputs,
    ];

    const fetchFeeRateSpy = vi.spyOn(XverseAPIFunctions, 'fetchBtcFeeRate');
    const feeRate = defaultFeeRate;
    fetchFeeRateSpy.mockImplementation(() => Promise.resolve(feeRate));

    const fetchUtxoSpy = vi.spyOn(BitcoinEsploraApiProvider.prototype, 'getUnspentUtxos');

    fetchUtxoSpy.mockImplementationOnce(() => Promise.resolve(utxos));
    fetchUtxoSpy.mockImplementationOnce(() => Promise.resolve(ordinalOutputs));

    const ordinalUtxos = [
      {
        status: {
          block_hash: '00000000000000000003e6c56ae100b34fcc2967bc1deb53de1a4b9c29ba448f',
          block_height: 797404,
          block_time: 1688626274,
          confirmed: true,
        },
        txid: 'd0dfe638a5be4f220f6435616edb5909a2f93540a7d6975ed0bdf305fb8bf51c',
        value: 1347,
        vout: 0,
        address: btcAddress,
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
    const txSize = 261;
    expect(fee.toNumber()).eq(txSize * feeRate.regular);
  });

  it('can calculate transaction fee', async () => {
    const network = 'Mainnet';

    const unspent1Value = 100000;
    const unspent2Value = 200000;
    const unspent3Value = 250000;

    const changeAddress = '1H8voHF7NNoyz76h9s6dZSeoypJQamX4xT';

    const utxos: Array<UTXO & { address: string; blockHeight?: number }> = [
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
        address: changeAddress,
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
        address: changeAddress,
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
        address: changeAddress,
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

    // expect transaction size to be 295 bytes;
    const txSize = 295;
    expect(fee.toNumber()).eq(txSize * feeRate.regular);
  });

  it('can create + sign btc transaction', async () => {
    const network = 'Mainnet';

    const unspent1Value = 100000;
    const unspent2Value = 200000;
    const unspent3Value = 1000;
    const unspent4Value = 1000;

    const btcAddress = '1H8voHF7NNoyz76h9s6dZSeoypJQamX4xT';

    const utxos: Array<UTXO & { address: string; blockHeight?: number }> = [
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
        address: btcAddress,
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
        address: btcAddress,
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
        address: btcAddress,
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
        address: btcAddress,
      },
    ];

    const recipient1Amount = 200000;
    const recipient2Amount = 100000;

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
      '020000000001038d9df5a92a53ca644ef51e53dcb51d041779a5e78a2e50b29d374da792bb2b1f0200000017160014883999913cffa58d317d4533c94cb94878788db3ffffffff8c9df5a92a53ca644ef51e53dcb51d041779a5e78a2e50b29d374da792bb2b1f0200000017160014883999913cffa58d317d4533c94cb94878788db3ffffffff8e9df5a92a53ca644ef51e53dcb51d041779a5e78a2e50b29d374da792bb2b1f0200000017160014883999913cffa58d317d4533c94cb94878788db3ffffffff02400d0300000000001976a914fe5c6cac4dd74c23ec8477757298eb137c50ff6388aca0860100000000001976a914574e13c50c3450713ff252a9ad7604db865135e888ac0247304402203ed8176c736118b0862f7e9a5e6851341555ecd85c8f19391793bd0bf1186023022076e76f0bf30523508e4dd9d359d3fad6b190dd7cc9a264a224e3217fde29740c0121032215d812282c0792c8535c3702cca994f5e3da9cd8502c3e190d422f0066fdff0247304402204fbb2f852f21646291b23d902aaa76cf13fc9d54e20b25274435cbac2135940e02200ce01d388b00f89e8166845caddf606263f962ad5f74eeaa4bbcabdcc7d1a4240121032215d812282c0792c8535c3702cca994f5e3da9cd8502c3e190d422f0066fdff02473044022059f01ebad48ba2ccc1a7570832bb4768232b5ed2e7bd307378e7853ed866dab80220648b9f93b6d67800d91a4f8484cab852efa7077197afd3be11422f7ce35870b60121032215d812282c0792c8535c3702cca994f5e3da9cd8502c3e190d422f0066fdff00000000';
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

    const btcAddress = '1H8voHF7NNoyz76h9s6dZSeoypJQamX4xT';

    const utxos: Array<UTXO & { address: string; blockHeight?: number }> = [
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
        address: btcAddress,
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
        address: btcAddress,
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
        address: btcAddress,
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
        address: btcAddress,
      },
    ];

    const recipient1Amount = 200000;
    const recipient2Amount = 100000;

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

    const recipientAddress = '1QBwMVYH4efRVwxydnwoGwELJoi47FuRvS';
    const ordinalAddress = 'bc1prtztqsgks2l6yuuhgsp36lw5n6dzpkj287lesqnfgktzqajendzq3p9urw';
    const btcAddress = '1H8voHF7NNoyz76h9s6dZSeoypJQamX4xT';

    const ordinalUtxoHash = '5541ccb688190cefb350fd1b3594a8317c933a75ff9932a0063b6e8b61a00143';
    const ordinalOutputs: Array<UTXO & { address: string; blockHeight?: number }> = [
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
        address: ordinalAddress,
      },
    ];

    const utxos: Array<UTXO & { address: string; blockHeight?: number }> = [
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
        address: btcAddress,
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
        address: btcAddress,
      },
    ];

    const fetchFeeRateSpy = vi.spyOn(XverseAPIFunctions, 'fetchBtcFeeRate');
    const feeRate = defaultFeeRate;

    fetchFeeRateSpy.mockImplementation(() => Promise.resolve(feeRate));

    const fetchUtxoSpy = vi.spyOn(BitcoinEsploraApiProvider.prototype, 'getUnspentUtxos');

    fetchUtxoSpy.mockImplementationOnce(() => Promise.resolve(utxos));
    fetchUtxoSpy.mockImplementationOnce(() => Promise.resolve(ordinalOutputs));

    const recipients = [
      {
        address: recipientAddress,
        amountSats: new BigNumber(ordinalOutputs[0].value),
      },
    ];

    const filteredUnspentOutputs = filterUtxos(utxos, [ordinalOutputs[0]]);

    const selectedUnspentOutputs = selectUnspentOutputs(
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

  it('can calculate fee for ordinal send transaction', async () => {
    const network = 'Mainnet';

    const ordinalValue = 80000;
    const unspent1Value = 1000;
    const unspent2Value = 10000;

    const ordinal = {
      output: '5541ccb688190cefb350fd1b3594a8317c933a75ff9932a0063b6e8b61a00143:2',
    };

    const recipientAddress = '1QBwMVYH4efRVwxydnwoGwELJoi47FuRvS';
    const ordinalsAddress = 'bc1prtztqsgks2l6yuuhgsp36lw5n6dzpkj287lesqnfgktzqajendzq3p9urw';
    const btcAddress = '1H8voHF7NNoyz76h9s6dZSeoypJQamX4xT';

    const ordinalUtxoHash = '5541ccb688190cefb350fd1b3594a8317c933a75ff9932a0063b6e8b61a00143';
    const ordinalOutputs: Array<UTXO & { address: string; blockHeight?: number }> = [
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
        address: ordinalsAddress,
      },
    ];

    const utxos: Array<UTXO & { address: string; blockHeight?: number }> = [
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
        address: btcAddress,
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
        address: btcAddress,
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

    fetchFeeRateSpy.mockReturnValue(Promise.resolve(feeRate));

    const fetchUtxoSpy = vi.spyOn(BitcoinEsploraApiProvider.prototype, 'getUnspentUtxos');
    fetchUtxoSpy.mockReturnValueOnce(Promise.resolve(utxos)).mockReturnValueOnce(Promise.resolve(utxos));
    const fetchOrdinalsUtxoSpy = vi.spyOn(BTCFunctions, 'getOrdinalsUtxos');
    fetchOrdinalsUtxoSpy.mockReturnValue(Promise.resolve(ordinalOutputs));
    const { fee } = await getBtcFeesForOrdinalTransaction({
      recipientAddress,
      btcAddress,
      ordinalsAddress,
      network,
      ordinal,
    });

    const expectedFee = 2610;

    expect(fee.toNumber()).eq(expectedFee);
  });

  it('can sign ordinal send transaction', async () => {
    const network = 'Mainnet';

    const ordinalValue = 80000;
    const unspent1Value = 1000;
    const unspent2Value = 10000;

    const ordinal = {
      output: '5541ccb688190cefb350fd1b3594a8317c933a75ff9932a0063b6e8b61a00143:2',
    };

    const recipientAddress = '1QBwMVYH4efRVwxydnwoGwELJoi47FuRvS';
    const ordinalsAddress = 'bc1prtztqsgks2l6yuuhgsp36lw5n6dzpkj287lesqnfgktzqajendzq3p9urw';
    const btcAddress = '1H8voHF7NNoyz76h9s6dZSeoypJQamX4xT';

    const ordinalUtxoHash = '5541ccb688190cefb350fd1b3594a8317c933a75ff9932a0063b6e8b61a00143';
    const ordinalOutputs: Array<UTXO & { address: string; blockHeight?: number }> = [
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
        address: ordinalsAddress,
      },
    ];

    const utxos: Array<UTXO & { address: string; blockHeight?: number }> = [
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
        address: btcAddress,
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
        address: btcAddress,
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

    fetchFeeRateSpy.mockReturnValue(Promise.resolve(feeRate));

    const fetchUtxoSpy = vi.spyOn(BitcoinEsploraApiProvider.prototype, 'getUnspentUtxos');
    fetchUtxoSpy.mockReturnValueOnce(Promise.resolve(utxos)).mockReturnValueOnce(Promise.resolve(utxos));
    const fetchOrdinalsUtxoSpy = vi.spyOn(BTCFunctions, 'getOrdinalsUtxos');
    fetchOrdinalsUtxoSpy.mockReturnValue(Promise.resolve(ordinalOutputs));

    const signedTx = await signOrdinalTransaction({
      recipientAddress,
      btcAddress,
      ordinalsAddress,
      accountIndex: 0,
      seedPhrase: testSeed,
      network,
      ordinal,
    });

    const expectedTx =
      '020000000001024301a0618b6e3b06a03299ff753a937c31a894351bfd50b3ef0c1988b6cc41550200000017160014883999913cffa58d317d4533c94cb94878788db3ffffffff8d9df5a92a53ca644ef51e53dcb51d041779a5e78a2e50b29d374da792bb2b1f0200000017160014883999913cffa58d317d4533c94cb94878788db3ffffffff0280380100000000001976a914fe5c6cac4dd74c23ec8477757298eb137c50ff6388acde1c0000000000001976a914b101d5205c77b52f057cb66498572f3ffe16738688ac0247304402204684bb4f6e41515e589b2137f98cff5f487acac52ea99ec7306386faadc1fba1022028a9d444c64a21073dda5b8408369200490de8c47ff7e767c2d430d20d5a4d560121032215d812282c0792c8535c3702cca994f5e3da9cd8502c3e190d422f0066fdff0248304502210085873f21e04b021606aae475dfdbfefd2a13fa3c547a042f488ebf81b8d366a9022008e64cc0a3232cb4ed65fd276ac299e2b8fcea1b7833116c09881e557b4672c80121032215d812282c0792c8535c3702cca994f5e3da9cd8502c3e190d422f0066fdff00000000';
    expect(signedTx.signedTx).eq(expectedTx);
  });

  it('can create and sign ordinal send with ordinal utxo in payment address', async () => {
    const network = 'Mainnet';

    const ordinalValue = 80000;
    const unspent1Value = 1000;
    const unspent2Value = 10000;

    const recipientAddress = '1QBwMVYH4efRVwxydnwoGwELJoi47FuRvS';
    const ordinalAddress = 'bc1prtztqsgks2l6yuuhgsp36lw5n6dzpkj287lesqnfgktzqajendzq3p9urw';
    const btcAddress = '1H8voHF7NNoyz76h9s6dZSeoypJQamX4xT';

    const ordinalUtxoHash = '5541ccb688190cefb350fd1b3594a8317c933a75ff9932a0063b6e8b61a00143';
    const ordinalOutputs: Array<UTXO & { address: string; blockHeight?: number }> = [
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
        address: ordinalAddress,
      },
    ];

    const utxos: Array<UTXO & { address: string; blockHeight?: number }> = [
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
        address: btcAddress,
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
        address: btcAddress,
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
      '020000000001024301a0618b6e3b06a03299ff753a937c31a894351bfd50b3ef0c1988b6cc41550200000017160014883999913cffa58d317d4533c94cb94878788db3ffffffff8d9df5a92a53ca644ef51e53dcb51d041779a5e78a2e50b29d374da792bb2b1f0200000017160014883999913cffa58d317d4533c94cb94878788db3ffffffff0280380100000000001976a914fe5c6cac4dd74c23ec8477757298eb137c50ff6388acde1c0000000000001976a914b101d5205c77b52f057cb66498572f3ffe16738688ac0247304402204684bb4f6e41515e589b2137f98cff5f487acac52ea99ec7306386faadc1fba1022028a9d444c64a21073dda5b8408369200490de8c47ff7e767c2d430d20d5a4d560121032215d812282c0792c8535c3702cca994f5e3da9cd8502c3e190d422f0066fdff0248304502210085873f21e04b021606aae475dfdbfefd2a13fa3c547a042f488ebf81b8d366a9022008e64cc0a3232cb4ed65fd276ac299e2b8fcea1b7833116c09881e557b4672c80121032215d812282c0792c8535c3702cca994f5e3da9cd8502c3e190d422f0066fdff00000000';
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

    const recipientAddress = '1QBwMVYH4efRVwxydnwoGwELJoi47FuRvS';
    const ordinalAddress = 'bc1prtztqsgks2l6yuuhgsp36lw5n6dzpkj287lesqnfgktzqajendzq3p9urw';
    const btcAddress = '1H8voHF7NNoyz76h9s6dZSeoypJQamX4xT';
    const customFeeAmount = new BigNumber(2000);

    const ordinalUtxoHash = '5541ccb688190cefb350fd1b3594a8317c933a75ff9932a0063b6e8b61a00143';
    const ordinalOutputs: Array<UTXO & { address: string; blockHeight?: number }> = [
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
        address: ordinalAddress,
      },
    ];

    const utxos: Array<UTXO & { address: string; blockHeight?: number }> = [
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
        address: btcAddress,
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
        address: btcAddress,
      },
    ];

    const fetchFeeRateSpy = vi.spyOn(XverseAPIFunctions, 'fetchBtcFeeRate');
    const feeRate = defaultFeeRate;

    fetchFeeRateSpy.mockImplementation(() => Promise.resolve(feeRate));

    const fetchUtxoSpy = vi.spyOn(BitcoinEsploraApiProvider.prototype, 'getUnspentUtxos');

    fetchUtxoSpy.mockImplementationOnce(() => Promise.resolve(utxos));
    fetchUtxoSpy.mockImplementationOnce(() => Promise.resolve(ordinalOutputs));

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
