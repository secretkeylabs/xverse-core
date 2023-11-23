import BigNumber from 'bignumber.js';
import { Recipient } from '../../transactions/btc';
import { UTXO } from '../../types';

import { utxo10k, utxo384k, utxo3k, utxo792k } from './btc.data';

type FixtureName = string;
type FeeRate = number;

type SelectUtxoSendSuccessExpected = {
  selectedUtxos: UTXO[];
  change: number;
  fee: number;
};

type FixtureInput = {
  recipients: Recipient[];
  feeRate: FeeRate;
  expected: SelectUtxoSendSuccessExpected;
};

type SelectUtxoSendSuccessFixture = [FixtureName, FixtureInput];

export const recipientAddress1 = 'bc1pgkwmp9u9nel8c36a2t7jwkpq0hmlhmm8gm00kpdxdy864ew2l6zqw2l6vh';
export const recipientAddress2 = 'bc1pyzfhlkq29sylwlv72ve52w8mn7hclefzhyay3dxh32r0322yx6uqajvr3y';

export const selectUtxosForSendSuccessFixtures: SelectUtxoSendSuccessFixture[] = [
  [
    'Large output, prefer largest UTXO with largest change',
    {
      recipients: [
        {
          address: recipientAddress1,
          amountSats: new BigNumber(60000),
        },
      ],
      feeRate: 10,
      expected: {
        selectedUtxos: [utxo792k],
        change: 730120,
        fee: 1880,
      },
    },
  ],
  [
    'Small output, prefer largest UTXO with largest change',
    {
      recipients: [
        {
          address: recipientAddress1,
          amountSats: new BigNumber(5000),
        },
      ],
      feeRate: 10,
      expected: {
        selectedUtxos: [utxo792k],
        change: 785120,
        fee: 1880,
      },
    },
  ],
  [
    'Exact change output, prefer smaller UTXO with no change',
    {
      recipients: [
        {
          address: recipientAddress1,
          amountSats: new BigNumber(8170),
        },
      ],
      feeRate: 10,
      expected: {
        selectedUtxos: [utxo10k],
        change: 0,
        fee: 1830,
      },
    },
  ],
  [
    'Multiple inputs, prefer large change',
    {
      recipients: [
        {
          address: recipientAddress1,
          amountSats: new BigNumber(792000),
        },
      ],
      feeRate: 10,
      expected: {
        selectedUtxos: [utxo792k, utxo384k],
        change: 381210,
        fee: 2790,
      },
    },
  ],
  [
    'Exact change inputs, multiple UTXOs, prefer no change',
    {
      recipients: [
        {
          address: recipientAddress1,
          amountSats: new BigNumber(799570),
        },
      ],
      feeRate: 10,
      expected: {
        selectedUtxos: [utxo792k, utxo10k],
        change: 0,
        fee: 2430,
      },
    },
  ],
  [
    'All inputs, exclude dust',
    {
      recipients: [
        {
          address: recipientAddress1,
          amountSats: new BigNumber(1184000),
        },
      ],
      feeRate: 10,
      expected: {
        selectedUtxos: [utxo792k, utxo384k, utxo10k, utxo3k],
        change: 0,
        fee: 5000,
      },
    },
  ],
  [
    'Multiple recipients, prefer large change',
    {
      recipients: [
        {
          address: recipientAddress1,
          amountSats: new BigNumber(20000),
        },
        {
          address: recipientAddress2,
          amountSats: new BigNumber(30000),
        },
      ],
      feeRate: 10,
      expected: {
        selectedUtxos: [utxo792k],
        change: 739690,
        fee: 2310,
      },
    },
  ],
  [
    'Multiple recipients, low value, prefer high change',
    {
      recipients: [
        {
          address: recipientAddress1,
          amountSats: new BigNumber(5000),
        },
        {
          address: recipientAddress2,
          amountSats: new BigNumber(1200),
        },
      ],
      feeRate: 10,
      expected: {
        selectedUtxos: [utxo792k],
        change: 783490,
        fee: 2310,
      },
    },
  ],
  [
    'Multiple recipients, exact value, prefer no change',
    {
      recipients: [
        {
          address: recipientAddress1,
          amountSats: new BigNumber(5000),
        },
        {
          address: recipientAddress2,
          amountSats: new BigNumber(2900),
        },
      ],
      feeRate: 10,
      expected: {
        selectedUtxos: [utxo10k],
        change: 0,
        fee: 2100,
      },
    },
  ],
];
