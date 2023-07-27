import { describe, expect, it } from 'vitest';

import BigNumber from 'bignumber.js';
import { selectUtxosForSend } from '../../transactions/btc';
import { utxos } from './btc.data';
import { recipientAddress1, selectUtxosForSendSuccessFixtures } from './btc.fixtures';

const dummyChangeAddress = 'bc1pzsm9pu47e7npkvxh9dcd0dc2qwqshxt2a9tt7aq3xe9krpl8e82sx6phdj';

describe('selectUtxosForSend', () => {
  it.each(selectUtxosForSendSuccessFixtures)(
    'should select utxos for send: %s',
    (_testName, recipients, feeRate, expected) => {
      const selectedUtxoData = selectUtxosForSend(dummyChangeAddress, recipients, utxos, feeRate);

      expect(selectedUtxoData).toBeDefined();

      const { feeRate: actualFeeRate, ...selectedWithoutFeeRate } = selectedUtxoData || {};
      expect(selectedWithoutFeeRate).toEqual(expected);
      expect(actualFeeRate).toBeGreaterThanOrEqual(feeRate);
    },
  );

  it('should return undefined if no utxos', () => {
    const selectedUtxoData = selectUtxosForSend(
      dummyChangeAddress,
      [{ address: recipientAddress1, amountSats: new BigNumber(1000) }],
      [],
      10,
    );

    expect(selectedUtxoData).toBeUndefined();
  });

  it('should return undefined if not enough value in utxos', () => {
    const selectedUtxoData = selectUtxosForSend(
      dummyChangeAddress,
      [{ address: recipientAddress1, amountSats: new BigNumber(10000000) }],
      utxos,
      10,
    );

    expect(selectedUtxoData).toBeUndefined();
  });

  it('should throw if no recipients', () => {
    expect(() => selectUtxosForSend(dummyChangeAddress, [], utxos, 10)).toThrow('Must have at least one recipient');
  });

  it('should throw if fee rate not a positive number', () => {
    const recipients = [{ address: recipientAddress1, amountSats: new BigNumber(10000000) }];
    expect(() => selectUtxosForSend(dummyChangeAddress, recipients, utxos, 0)).toThrow(
      'Fee rate must be a positive number',
    );
    expect(() => selectUtxosForSend(dummyChangeAddress, recipients, utxos, -1)).toThrow(
      'Fee rate must be a positive number',
    );
  });
});
