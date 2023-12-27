import { describe, expect, it, vi } from 'vitest';
import { Action, ActionType } from '../../../transactions/bitcoin/types';
import {
  areByteArraysEqual,
  extractActionMap,
  extractOutputInscriptionsAndSatributes,
  extractUsedOutpoints,
  getOffsetFromLocation,
  getOutpoint,
  getOutpointFromLocation,
  getOutpointFromUtxo,
  getSortedAvailablePaymentUtxos,
  getTransactionTotals,
} from '../../../transactions/bitcoin/utils';

describe('areByteArraysEqual', () => {
  it('returns true for equal arrays', () => {
    const a = new Uint8Array([0, 1, 2, 3]);
    const b = new Uint8Array([0, 1, 2, 3]);
    expect(areByteArraysEqual(a, b)).toBe(true);
  });

  it('returns false for unequal arrays', () => {
    const a = new Uint8Array([0, 1, 2, 3]);
    const b = new Uint8Array([0, 1, 2, 4]);
    expect(areByteArraysEqual(a, b)).toBe(false);
    expect(areByteArraysEqual(b, a)).toBe(false);
  });

  it('returns false for unequal lengths', () => {
    const a = new Uint8Array([0, 1, 2, 3]);
    const b = new Uint8Array([0, 1, 2, 3, 4]);
    expect(areByteArraysEqual(a, b)).toBe(false);
    expect(areByteArraysEqual(b, a)).toBe(false);
  });

  it('returns false for undefined arrays', () => {
    const a = new Uint8Array([0, 1, 2, 3]);
    const b = undefined;
    expect(areByteArraysEqual(a, b)).toBe(false);
    expect(areByteArraysEqual(b, a)).toBe(false);
  });
});

describe('getOutpoint', () => {
  it('returns the correct outpoint', () => {
    const txid = '1234';
    const vout = 1;
    expect(getOutpoint(txid, vout)).toBe(`${txid}:${vout}`);
    expect(getOutpoint(txid, `${vout}`)).toBe(`${txid}:${vout}`);
  });
});

describe('getOutpointFromLocation', () => {
  it('returns the correct outpoint', () => {
    let txid = '1234';
    let vout = 1;
    let offset = 0;
    expect(getOutpointFromLocation(`${txid}:${vout}:${offset}`)).toBe(`${txid}:${vout}`);

    txid = '1234234';
    vout = 2;
    offset = 10;
    expect(getOutpointFromLocation(`${txid}:${vout}:${offset}`)).toBe(`${txid}:${vout}`);
  });
});

describe('getOffsetFromLocation', () => {
  it('returns the correct offset', () => {
    const txid = '1234';
    const vout = 1;
    let offset = 0;
    expect(getOffsetFromLocation(`${txid}:${vout}:${offset}`)).toBe(offset);

    offset = 1;
    expect(getOffsetFromLocation(`${txid}:${vout}:${offset}`)).toBe(offset);
  });
});

describe('getOutpointFromUtxo', () => {
  it('returns the correct outpoint', () => {
    let txid = '1234';
    let vout = 1;
    expect(getOutpointFromUtxo({ txid, vout } as any)).toBe(`${txid}:${vout}`);

    txid = '12345';
    vout = 10;
    expect(getOutpointFromUtxo({ txid, vout } as any)).toBe(`${txid}:${vout}`);
  });
});

describe('extractActionMap', () => {
  it('returns the correct action map', () => {
    const actions: Action[] = [
      {
        type: ActionType.SEND_UTXO,
        outpoint: '1234:1',
        toAddress: 'address1',
      },
      {
        type: ActionType.SPLIT_UTXO,
        location: '1234:0:100',
        toAddress: 'address1',
      },
      {
        type: ActionType.SEND_UTXO,
        outpoint: '12345:0',
        toAddress: 'address2',
      },
      {
        type: ActionType.SEND_BTC,
        toAddress: 'address1',
        amount: 100n,
        combinable: true,
      },
      {
        type: ActionType.SEND_UTXO,
        outpoint: '1234:2',
        toAddress: 'address3',
      },
      {
        type: ActionType.SPLIT_UTXO,
        location: '1234:0:1000',
        toAddress: 'address3',
      },
      {
        type: ActionType.SEND_BTC,
        toAddress: 'address1',
        amount: 200n,
        combinable: true,
      },
      {
        type: ActionType.SPLIT_UTXO,
        location: '1234:0:2000',
        toAddress: 'address4',
      },
      {
        type: ActionType.SEND_UTXO,
        outpoint: '1234:3',
        toAddress: 'address1',
      },
      {
        type: ActionType.SEND_BTC,
        toAddress: 'address2',
        amount: 1000n,
        combinable: false,
      },
      {
        type: ActionType.SPLIT_UTXO,
        location: '1234:0:2000',
        spendable: true,
      },
    ];

    const actionMap = extractActionMap(actions);

    expect(actionMap).toEqual({
      [ActionType.SEND_UTXO]: [
        {
          type: ActionType.SEND_UTXO,
          outpoint: '1234:1',
          toAddress: 'address1',
        },
        {
          type: ActionType.SEND_UTXO,
          outpoint: '12345:0',
          toAddress: 'address2',
        },
        {
          type: ActionType.SEND_UTXO,
          outpoint: '1234:2',
          toAddress: 'address3',
        },
        {
          type: ActionType.SEND_UTXO,
          outpoint: '1234:3',
          toAddress: 'address1',
        },
      ],
      [ActionType.SPLIT_UTXO]: [
        {
          type: ActionType.SPLIT_UTXO,
          location: '1234:0:100',
          toAddress: 'address1',
        },
        {
          type: ActionType.SPLIT_UTXO,
          location: '1234:0:1000',
          toAddress: 'address3',
        },
        {
          type: ActionType.SPLIT_UTXO,
          location: '1234:0:2000',
          toAddress: 'address4',
        },
        {
          type: ActionType.SPLIT_UTXO,
          location: '1234:0:2000',
          spendable: true,
        },
      ],
      [ActionType.SEND_BTC]: [
        {
          type: ActionType.SEND_BTC,
          toAddress: 'address1',
          amount: 100n,
          combinable: true,
        },
        {
          type: ActionType.SEND_BTC,
          toAddress: 'address1',
          amount: 200n,
          combinable: true,
        },
        {
          type: ActionType.SEND_BTC,
          toAddress: 'address2',
          amount: 1000n,
          combinable: false,
        },
      ],
    });
  });

  it('throws error on same utxo being sent and split', () => {
    const actions: Action[] = [
      {
        type: ActionType.SEND_UTXO,
        outpoint: '1234:0',
        toAddress: 'address1',
      },
      {
        type: ActionType.SPLIT_UTXO,
        location: '1234:0:2000',
        spendable: true,
      },
    ];

    expect(() => extractActionMap(actions)).throws('duplicate UTXO being spent: 1234:0');
  });

  it('throws error on same utxo being sent twice', () => {
    const actions: Action[] = [
      {
        type: ActionType.SEND_UTXO,
        outpoint: '1234:0',
        toAddress: 'address1',
      },
      {
        type: ActionType.SEND_UTXO,
        outpoint: '1234:0',
        toAddress: 'address2',
      },
    ];

    expect(() => extractActionMap(actions)).throws('duplicate UTXO being spent: 1234:0');
  });
});

describe('getSortedAvailablePaymentUtxos', () => {
  const utxoMap = {
    embellished500: {
      outpoint: '1234:6',
      utxo: { value: 500, status: { confirmed: true } },
      isEmbellished: () => true,
    },
    embellished1500: {
      outpoint: '1234:4',
      utxo: { value: 1500, status: { confirmed: true } },
      isEmbellished: () => true,
    },
    unconfirmed500: {
      outpoint: '1234:5',
      utxo: { value: 500, status: { confirmed: false } },
      isEmbellished: () => false,
    },
    unconfirmed2500: {
      outpoint: '1234:3',
      utxo: { value: 2500, status: { confirmed: false } },
      isEmbellished: () => false,
    },
    confirmed1000: {
      outpoint: '1234:0',
      utxo: { value: 1000, status: { confirmed: true } },
      isEmbellished: () => false,
    },
    confirmed2000: {
      outpoint: '1234:1',
      utxo: { value: 2000, status: { confirmed: true } },
      isEmbellished: () => false,
    },
    confirmed3000: {
      outpoint: '1234:2',
      utxo: { value: 3000, status: { confirmed: true } },
      isEmbellished: () => false,
    },
  };

  it('should get the utxos in correct order', async () => {
    const testUtxos = [
      utxoMap.confirmed1000,
      utxoMap.embellished1500,
      utxoMap.confirmed3000,
      utxoMap.unconfirmed2500,
      utxoMap.embellished500,
      utxoMap.unconfirmed500,
      utxoMap.confirmed2000,
    ];
    const addressContext = {
      getUtxos: async () => testUtxos,
    };
    const context = {
      paymentAddress: addressContext,
    } as any;

    const utxos = await getSortedAvailablePaymentUtxos(context, new Set());

    // order should be: embellished, unconfirmed, confirmed
    // and internally by value
    expect(utxos).toEqual([
      utxoMap.embellished500,
      utxoMap.embellished1500,
      utxoMap.unconfirmed500,
      utxoMap.unconfirmed2500,
      utxoMap.confirmed1000,
      utxoMap.confirmed2000,
      utxoMap.confirmed3000,
    ]);
  });

  it('should not include utxos in excludeOutpointList', async () => {
    const testUtxos = [
      utxoMap.confirmed1000,
      utxoMap.embellished1500,
      utxoMap.confirmed3000,
      utxoMap.unconfirmed2500,
      utxoMap.embellished500,
      utxoMap.unconfirmed500,
      utxoMap.confirmed2000,
    ];
    const addressContext = {
      getUtxos: async () => testUtxos,
    };
    const context = {
      paymentAddress: addressContext,
    } as any;

    const utxos = await getSortedAvailablePaymentUtxos(
      context,
      new Set([utxoMap.embellished500.outpoint, utxoMap.confirmed1000.outpoint, utxoMap.confirmed3000.outpoint]),
    );

    // order should be: embellished, unconfirmed, confirmed
    // and internally by value
    expect(utxos).toEqual([
      utxoMap.embellished1500,
      utxoMap.unconfirmed500,
      utxoMap.unconfirmed2500,
      utxoMap.confirmed2000,
    ]);
  });
});

describe('getTransactionTotals', () => {
  it('should get the correct totals', async () => {
    const dummyInputs = [
      {
        witnessUtxo: {
          amount: 1000n,
        },
      },
      {
        witnessUtxo: {
          amount: 3000n,
        },
      },
      {
        witnessUtxo: {
          amount: 500n,
        },
      },
    ];
    const dummyOutputs = [
      {
        amount: 500n,
      },
      {
        amount: 2500n,
      },
      {
        amount: 200n,
      },
    ];

    const transaction = {
      inputsLength: 3,
      getInput: (i: number) => dummyInputs[i],
      outputsLength: 3,
      getOutput: (i: number) => dummyOutputs[i],
    } as any;

    const { inputValue, outputValue } = await getTransactionTotals(transaction);

    expect(inputValue).toEqual(4500n);
    expect(outputValue).toEqual(3200n);
  });

  it('throw on input without amount', async () => {
    const dummyInputs = [
      {
        witnessUtxo: {
          amount: 1000n,
        },
      },
      {
        witnessUtxo: {},
      },
    ];
    const dummyOutputs = [
      {
        amount: 500n,
      },
    ];

    const transaction = {
      inputsLength: 2,
      getInput: (i: number) => dummyInputs[i],
      outputsLength: 1,
      getOutput: (i: number) => dummyOutputs[i],
    } as any;

    await expect(() => getTransactionTotals(transaction)).rejects.toThrow(
      'Invalid input found on transaction at index 1',
    );
  });

  it('throw on output without amount', async () => {
    const dummyInputs = [
      {
        witnessUtxo: {
          amount: 1000n,
        },
      },
      {
        witnessUtxo: {
          amount: 2000n,
        },
      },
    ];
    const dummyOutputs = [
      {
        amount: 500n,
      },
      {},
    ];

    const transaction = {
      inputsLength: 2,
      getInput: (i: number) => dummyInputs[i],
      outputsLength: 2,
      getOutput: (i: number) => dummyOutputs[i],
    } as any;

    await expect(() => getTransactionTotals(transaction)).rejects.toThrow(
      'Invalid output found on transaction at index 1',
    );
  });
});

describe('extractUsedOutpoints', () => {
  it('extracts outpoints correctly', async () => {
    const dummyInputs = [
      {
        index: 0,
        txid: Buffer.from('1234', 'hex'),
      },
      {
        index: 11,
        txid: Buffer.from('4321', 'hex'),
      },
    ];
    const dummyOutputs = [
      {
        amount: 500n,
      },
      {},
    ];

    const transaction = {
      inputsLength: 2,
      getInput: (i: number) => dummyInputs[i],
      outputsLength: 2,
      getOutput: (i: number) => dummyOutputs[i],
    } as any;

    const outpoints = await extractUsedOutpoints(transaction as any);

    expect(outpoints).toEqual(new Set(['1234:0', '4321:11']));
  });

  it('throws on invalid outpoint - no txid', async () => {
    const dummyInputs = [
      {
        index: 0,
      },
      {
        index: 11,
        txid: Buffer.from('4321', 'hex'),
      },
    ];
    const dummyOutputs = [
      {
        amount: 500n,
      },
      {},
    ];

    const transaction = {
      inputsLength: 2,
      getInput: (i: number) => dummyInputs[i],
      outputsLength: 2,
      getOutput: (i: number) => dummyOutputs[i],
    } as any;

    expect(() => extractUsedOutpoints(transaction as any)).throws('Invalid input found on transaction at index 0');
  });

  it('throws on invalid outpoint - no vout', async () => {
    const dummyInputs = [
      {
        index: 0,
        txid: Buffer.from('1234', 'hex'),
      },
      {
        txid: Buffer.from('4321', 'hex'),
      },
    ];
    const dummyOutputs = [
      {
        amount: 500n,
      },
      {},
    ];

    const transaction = {
      inputsLength: 2,
      getInput: (i: number) => dummyInputs[i],
      outputsLength: 2,
      getOutput: (i: number) => dummyOutputs[i],
    } as any;

    expect(() => extractUsedOutpoints(transaction as any)).throws('Invalid input found on transaction at index 1');
  });
});

describe('extractOutputInscriptionsAndSatributes', () => {
  it('Successfully extracts inscriptions and satributes', async () => {
    const dummyExtendedUtxo = {
      address: 'payments',
      utxo: {
        value: 10000,
      },
      getBundleData: vi.fn(),
    } as any;

    dummyExtendedUtxo.getBundleData.mockResolvedValue({
      sat_ranges: [
        {
          offset: 0,
          range: {
            start: '0',
            end: '1',
          },
          inscriptions: [
            {
              id: 'i0',
              inscription_number: 1,
              content_type: '1',
            },
          ],
          satributes: ['VINTAGE'],
        },
        {
          offset: 1,
          range: {
            start: '1',
            end: '1000',
          },
          inscriptions: [],
          satributes: ['VINTAGE'],
        },
        {
          offset: 1000,
          range: {
            start: '2000',
            end: '3000',
          },
          inscriptions: [],
          satributes: ['BLOCK_9'],
        },
        {
          offset: 2000,
          range: {
            start: '5000',
            end: '5001',
          },
          inscriptions: [
            {
              id: 'i1',
              inscription_number: 2,
              content_type: '2',
            },
          ],
          satributes: ['BLOCK_9', 'VINTAGE'],
        },
        {
          offset: 2001,
          range: {
            start: '5001',
            end: '6000',
          },
          inscriptions: [],
          satributes: ['BLOCK_9', 'VINTAGE'],
        },
        {
          offset: 3000,
          range: {
            start: '8000',
            end: '12000',
          },
          inscriptions: [],
          satributes: ['BLOCK_9', 'PIZZA', 'VINTAGE'],
        },
        {
          offset: 7000,
          range: {
            start: '80000',
            end: '830000',
          },
          inscriptions: [],
          satributes: ['BLOCK_9', 'PIZZA', 'PALINDROME'],
        },
      ],
    });

    let result = await extractOutputInscriptionsAndSatributes([dummyExtendedUtxo], 0, 546);

    expect(result.inscriptions).toEqual([
      {
        id: 'i0',
        offset: 0,
        fromAddress: 'payments',
        number: 1,
        contentType: '1',
      },
    ]);
    expect(result.satributes).toEqual([
      {
        types: ['VINTAGE'],
        amount: 1,
        offset: 0,
        fromAddress: 'payments',
      },
      {
        types: ['VINTAGE'],
        amount: 545,
        offset: 1,
        fromAddress: 'payments',
      },
    ]);

    result = await extractOutputInscriptionsAndSatributes([dummyExtendedUtxo], 300, 700);

    expect(result.inscriptions).toEqual([]);
    expect(result.satributes).toEqual([
      {
        types: ['VINTAGE'],
        amount: 700,
        offset: 0,
        fromAddress: 'payments',
      },
    ]);

    result = await extractOutputInscriptionsAndSatributes([dummyExtendedUtxo], 300, 1000);

    expect(result.inscriptions).toEqual([]);
    expect(result.satributes).toEqual([
      {
        types: ['VINTAGE'],
        amount: 700,
        offset: 0,
        fromAddress: 'payments',
      },
      {
        types: ['BLOCK_9'],
        amount: 300,
        offset: 700,
        fromAddress: 'payments',
      },
    ]);

    result = await extractOutputInscriptionsAndSatributes([dummyExtendedUtxo], 500, 8000);

    expect(result.inscriptions).toEqual([
      {
        id: 'i1',
        offset: 1500,
        fromAddress: 'payments',
        number: 2,
        contentType: '2',
      },
    ]);
    expect(result.satributes).toEqual([
      {
        types: ['VINTAGE'],
        amount: 500,
        offset: 0,
        fromAddress: 'payments',
      },
      {
        types: ['BLOCK_9'],
        amount: 1000,
        offset: 500,
        fromAddress: 'payments',
      },
      {
        types: ['BLOCK_9', 'VINTAGE'],
        amount: 1,
        offset: 1500,
        fromAddress: 'payments',
      },
      {
        types: ['BLOCK_9', 'VINTAGE'],
        amount: 999,
        offset: 1501,
        fromAddress: 'payments',
      },
      {
        types: ['BLOCK_9', 'PIZZA', 'VINTAGE'],
        amount: 4000,
        offset: 2500,
        fromAddress: 'payments',
      },
      {
        types: ['BLOCK_9', 'PIZZA', 'PALINDROME'],
        amount: 1500,
        offset: 6500,
        fromAddress: 'payments',
      },
    ]);
  });
});
