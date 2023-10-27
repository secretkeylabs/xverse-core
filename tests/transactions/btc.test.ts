import { describe, expect, it } from 'vitest';

import BigNumber from 'bignumber.js';
import { selectUtxosForSend } from '../../transactions/btc';
import { utxo3k, utxo792k, utxos } from './btc.data';
import { recipientAddress1, selectUtxosForSendSuccessFixtures } from './btc.fixtures';

const dummyChangeAddress = 'bc1pzsm9pu47e7npkvxh9dcd0dc2qwqshxt2a9tt7aq3xe9krpl8e82sx6phdj';

describe('selectUtxosForSend', () => {
  it.each(selectUtxosForSendSuccessFixtures)(
    'should select utxos for send: %s',
    (_testName, { recipients, feeRate, expected }) => {
      const selectedUtxoData = selectUtxosForSend({
        changeAddress: dummyChangeAddress,
        recipients,
        availableUtxos: utxos,
        feeRate,
        network: 'Mainnet',
      });

      expect(selectedUtxoData).toBeDefined();

      const { feeRate: actualFeeRate, ...selectedWithoutFeeRate } = selectedUtxoData || {};
      expect(selectedWithoutFeeRate).toEqual(expected);
      expect(actualFeeRate).toBeGreaterThanOrEqual(feeRate);
    },
  );

  it('should force select pinned UTXOs', () => {
    const selectedUtxoData = selectUtxosForSend({
      changeAddress: dummyChangeAddress,
      recipients: [{ address: recipientAddress1, amountSats: new BigNumber(50000) }],
      availableUtxos: utxos,
      feeRate: 10,
      pinnedUtxos: [utxo3k],
      network: 'Mainnet',
    });

    expect(selectedUtxoData).toEqual({
      selectedUtxos: [utxo3k, utxo792k],
      change: 742210,
      fee: 2790,
      feeRate: 10,
    });
  });

  it('should return undefined if no utxos', () => {
    const selectedUtxoData = selectUtxosForSend({
      changeAddress: dummyChangeAddress,
      recipients: [{ address: recipientAddress1, amountSats: new BigNumber(1000) }],
      availableUtxos: [],
      feeRate: 10,
      network: 'Mainnet',
    });

    expect(selectedUtxoData).toBeUndefined();
  });

  it('should return undefined if not enough value in utxos', () => {
    const selectedUtxoData = selectUtxosForSend({
      changeAddress: dummyChangeAddress,
      recipients: [{ address: recipientAddress1, amountSats: new BigNumber(10000000) }],
      availableUtxos: utxos,
      feeRate: 10,
      network: 'Mainnet',
    });

    expect(selectedUtxoData).toBeUndefined();
  });

  it('should throw if no recipients', () => {
    expect(() =>
      selectUtxosForSend({
        changeAddress: dummyChangeAddress,
        recipients: [],
        availableUtxos: utxos,
        feeRate: 10,
        network: 'Mainnet',
      }),
    ).toThrow('Must have at least one recipient');
  });

  it('should throw if fee rate not a positive number', () => {
    const recipients = [{ address: recipientAddress1, amountSats: new BigNumber(10000000) }];
    expect(() =>
      selectUtxosForSend({
        changeAddress: dummyChangeAddress,
        recipients: recipients,
        availableUtxos: utxos,
        feeRate: 0,
        network: 'Mainnet',
      }),
    ).toThrow('Fee rate must be a positive number');
    expect(() =>
      selectUtxosForSend({
        changeAddress: dummyChangeAddress,
        recipients: recipients,
        availableUtxos: utxos,
        feeRate: -1,
        network: 'Mainnet',
      }),
    ).toThrow('Fee rate must be a positive number');
  });
});
