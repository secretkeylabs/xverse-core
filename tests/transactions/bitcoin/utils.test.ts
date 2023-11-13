import { describe, expect, it } from 'vitest';
import { Action, ActionType } from '../../../transactions/bitcoin/types';
import {
  areByteArraysEqual,
  extractActionMap,
  getOffsetFromLocation,
  getOutpoint,
  getOutpointFromLocation,
  getOutpointFromUtxo,
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
