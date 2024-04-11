import * as btc from '@scure/btc-signer';
import BigNumber from 'bignumber.js';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getRunesClient } from '../../../api/runes/provider';
import {
  applyScriptActions,
  applySendBtcActionsAndFee,
  applySendUtxoActions,
  applySplitUtxoActions,
} from '../../../transactions/bitcoin/actionProcessors';
import { TransactionContext } from '../../../transactions/bitcoin/context';
import { EnhancedTransaction } from '../../../transactions/bitcoin/enhancedTransaction';
import { ActionType } from '../../../transactions/bitcoin/types';
import { TestAddressContext, addresses } from './helpers';

vi.mock('../../../transactions/bitcoin/actionProcessors');
vi.mock('../../../transactions/bitcoin/context');
vi.mock('../../../api/runes/provider');

describe('EnhancedTransaction constructor', () => {
  const seedVault = vi.fn() as any;
  const utxoCache = vi.fn() as any;

  const addressContext = new TestAddressContext(
    'p2wpkh',
    addresses[0].nativeSegwit,
    addresses[0].nativeSegwitPubKey,
    0,
    seedVault,
    utxoCache,
  );

  const ctx = new TransactionContext('Mainnet', addressContext, addressContext);
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should throw on no actions', () => {
    expect(() => new EnhancedTransaction(ctx, [], 1)).throws('No actions provided for transaction context');
  });

  it('should not throw if actions', () => {
    expect(() => new EnhancedTransaction(ctx, [{ type: ActionType.SCRIPT, script: [] }], 1)).not.throws();
  });

  it('should not throw if forced utxos', () => {
    expect(() => new EnhancedTransaction(ctx, [], 1, { forceIncludeOutpointList: ['out1'] })).not.throws();
  });
});

describe('EnhancedTransaction summary', () => {
  const seedVault = vi.fn() as any;
  const utxoCache = vi.fn() as any;

  const paymentAddressContext = new TestAddressContext(
    'p2wpkh',
    addresses[0].nativeSegwit,
    addresses[0].nativeSegwitPubKey,
    0,
    seedVault,
    utxoCache,
  );

  const ordinalsAddressContext = new TestAddressContext(
    'p2tr',
    addresses[0].taproot,
    addresses[0].taprootPubKey,
    0,
    seedVault,
    utxoCache,
  );

  const ctx = new TransactionContext('Mainnet', paymentAddressContext, ordinalsAddressContext);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('does not swallow errors', async () => {
    const txn = new EnhancedTransaction(
      ctx,
      [
        {
          type: ActionType.SEND_UTXO,
          outpoint: 'txid:0',
          toAddress: addresses[0].nativeSegwit,
        },
      ],
      1,
    );

    vi.mocked(applyScriptActions).mockRejectedValue(new Error('Not enough utxos at desired fee rate'));

    await expect(() => txn.getSummary()).rejects.toThrow('Not enough utxos at desired fee rate');
  });

  it('compiles transaction and summary correctly', async () => {
    const txn = new EnhancedTransaction(
      ctx,
      // These actions are only used for the action parser and passing to subsequent action processors
      // they don't correlate to the output of the action processors
      [
        {
          type: ActionType.SCRIPT,
          script: ['RETURN', 5],
        },
        {
          type: ActionType.SEND_UTXO,
          outpoint: 'txid:0',
          toAddress: addresses[0].nativeSegwit,
        },
        {
          type: ActionType.SPLIT_UTXO,
          location: 'txid:1:100',
          toAddress: addresses[0].nativeSegwit,
        },
        {
          type: ActionType.SEND_BTC,
          toAddress: addresses[0].nativeSegwit,
          amount: 1000n,
          combinable: true,
        },
      ],
      1,
      {
        forceIncludeOutpointList: ['txid:0'],
        overrideChangeAddress: 'overrideChangeAddress',
        useEffectiveFeeRate: true,
        allowUnconfirmedInput: true,
        allowUnknownInputs: true,
        allowUnknownOutputs: true,
        excludeOutpointList: ['txid:1'],
      },
    );

    vi.mocked(applyScriptActions).mockResolvedValueOnce({
      outputs: [
        {
          type: 'script',
          script: ['OP_RETURN', '6d02'],
          scriptHex: '6d02',
          amount: 0,
        },
      ],
    });

    const sendUtxoInputs = [
      {
        address: 'myAddress',
        utxo: { value: 100 },
        getBundleData: vi.fn().mockResolvedValue({
          sat_ranges: [
            {
              offset: 0,
              range: { start: 1000, end: 1001 },
              inscriptions: [{ id: 'inscriptionId', content_type: 'image', inscription_number: 1 }],
              satributes: [],
            },
            { offset: 1, range: { start: 1001, end: 1100 }, inscriptions: [], satributes: ['PIZZA'] },
          ],
        }),
      } as any,
    ];
    vi.mocked(applySendUtxoActions).mockResolvedValueOnce({
      inputs: sendUtxoInputs,
      outputs: [
        {
          type: 'address',
          address: 'address1',
          amount: 100,
        },
      ],
    });

    const splitInputs = [
      {
        address: 'myAddress',
        utxo: { value: 2000 },
        getBundleData: vi.fn().mockResolvedValue({
          sat_ranges: [
            {
              offset: 0,
              range: { start: 100, end: 101 },
              inscriptions: [{ id: 'inscriptionId2', inscription_number: 2, content_type: 'text' }],
              satributes: [],
            },
            {
              offset: 1000,
              range: { start: 201, end: 202 },
              inscriptions: [{ id: 'inscriptionId3', inscription_number: 3, content_type: 'text' }],
              satributes: [],
            },
            {
              offset: 1001,
              range: { start: 3001, end: 4000 },
              inscriptions: [],
              satributes: ['VINTAGE'],
            },
          ],
        }),
      } as any,
    ];
    vi.mocked(applySplitUtxoActions).mockResolvedValueOnce({
      inputs: splitInputs,
      outputs: [
        {
          type: 'address',
          address: 'address2',
          amount: 1000,
        },
        {
          type: 'address',
          address: 'address3',
          amount: 1000,
        },
      ],
    });

    const sendBtcInputs = [
      {
        address: 'myAddress',
        utxo: { value: 1000 },
        getBundleData: vi.fn().mockResolvedValue({
          sat_ranges: [
            {
              offset: 0,
              range: { start: 100, end: 101 },
              inscriptions: [{ id: 'inscriptionId4', inscription_number: 4, content_type: 'video' }],
              satributes: [],
            },
          ],
        }),
      } as any,
      {
        address: 'myAddress',
        utxo: { value: 1000 },
        getBundleData: vi.fn().mockResolvedValue({
          sat_ranges: [],
        }),
      } as any,
      {
        address: 'myAddress',
        utxo: { value: 2000 },
        getBundleData: vi.fn().mockResolvedValue({
          sat_ranges: [
            {
              offset: 100,
              range: { start: 800, end: 801 },
              inscriptions: [{ id: 'inscriptionId5', inscription_number: 5, content_type: 'json' }],
              satributes: [],
            },
            {
              offset: 200,
              range: { start: 10000, end: 10100 },
              inscriptions: [],
              satributes: ['VINTAGE', 'ALPHA'],
            },
            {
              offset: 1800,
              range: { start: 10000, end: 10100 },
              inscriptions: [],
              satributes: ['VINTAGE', 'ALPHA', 'BLOCK9'],
            },
          ],
        }),
      } as any,
    ];
    vi.mocked(applySendBtcActionsAndFee).mockResolvedValueOnce({
      inputs: sendBtcInputs,
      outputs: [
        {
          type: 'address',
          address: 'address4',
          amount: 2500,
        },
        {
          type: 'address',
          address: 'myAddress',
          amount: 1000,
        },
      ],
      actualFee: 500n,
      actualFeeRate: 50,
      effectiveFeeRate: 50,
      dustValue: 2n,
    });

    vi.mocked(getRunesClient).mockReturnValue({
      getDecodedRuneScript: vi.fn().mockResolvedValueOnce({
        Runestone: {
          edicts: [
            {
              id: 'runeId',
              amount: BigNumber(100),
              output: BigNumber(99),
            },
          ],
        },
      }),
    } as any);

    // ==========================
    // actual thing we're testing
    const summary = await txn.getSummary();
    // ==========================

    expect(summary).toEqual({
      fee: 500n,
      feeRate: 50,
      effectiveFeeRate: 50,
      vsize: 10, // size of an empty txn
      runeOp: {
        Runestone: {
          edicts: [
            {
              id: 'runeId',
              amount: BigNumber(100),
              output: BigNumber(99),
            },
          ],
        },
      },
      inputs: [...sendUtxoInputs, ...splitInputs, ...sendBtcInputs].map((i) => ({
        extendedUtxo: i,
        sigHash: 1,
        inscriptions: i.getBundleData.mock.results[0].value.sat_ranges.flatMap((s: any) =>
          s.inscriptions.map((insc: any) => ({
            contentType: insc.content_type,
            fromAddress: 'myAddress',
            id: insc.id,
            number: insc.inscription_number,
            offset: s.offset,
          })),
        ),
        satributes: i.getBundleData.mock.results[0].value.sat_ranges
          .map((sr: any) => ({
            types: sr.satributes,
            amount: sr.range.end - sr.range.start,
            offset: sr.offset,
            fromAddress: 'myAddress',
          }))
          .filter((s: any) => s.types.length > 0),
      })),
      outputs: [
        {
          type: 'script',
          script: ['OP_RETURN', '6d02'],
          scriptHex: '6d02',
          amount: 0,
        },
        {
          type: 'address',
          address: 'address1',
          amount: 100,
          inscriptions: [
            {
              id: 'inscriptionId',
              offset: 0,
              fromAddress: 'myAddress',
              number: 1,
              contentType: 'image',
            },
          ],
          satributes: [
            {
              amount: 99,
              offset: 1,
              types: ['PIZZA'],
              fromAddress: 'myAddress',
            },
          ],
        },
        {
          type: 'address',
          address: 'address2',
          amount: 1000,
          inscriptions: [
            {
              id: 'inscriptionId2',
              offset: 0,
              fromAddress: 'myAddress',
              number: 2,
              contentType: 'text',
            },
          ],
          satributes: [],
        },
        {
          type: 'address',
          address: 'address3',
          amount: 1000,
          inscriptions: [
            {
              id: 'inscriptionId3',
              offset: 0,
              fromAddress: 'myAddress',
              number: 3,
              contentType: 'text',
            },
          ],
          satributes: [
            {
              amount: 999,
              offset: 1,
              types: ['VINTAGE'],
              fromAddress: 'myAddress',
            },
          ],
        },
        {
          type: 'address',
          address: 'address4',
          amount: 2500,
          inscriptions: [
            {
              id: 'inscriptionId4',
              offset: 0,
              fromAddress: 'myAddress',
              number: 4,
              contentType: 'video',
            },
            {
              id: 'inscriptionId5',
              offset: 2100,
              fromAddress: 'myAddress',
              number: 5,
              contentType: 'json',
            },
          ],
          satributes: [
            {
              amount: 100,
              offset: 2200,
              types: ['VINTAGE', 'ALPHA'],
              fromAddress: 'myAddress',
            },
          ],
        },
        {
          type: 'address',
          address: 'myAddress',
          amount: 1000,
          inscriptions: [],
          satributes: [],
        },
      ],
      feeOutput: {
        type: 'fee',
        amount: 500,
        inscriptions: [],
        satributes: [
          {
            amount: 100,
            offset: 300,
            types: ['VINTAGE', 'ALPHA', 'BLOCK9'],
            fromAddress: 'myAddress',
          },
        ],
      },
      dustValue: 2n,
    });

    expect(applyScriptActions).toHaveBeenCalledWith(expect.any(btc.Transaction), [
      {
        type: ActionType.SCRIPT,
        script: ['RETURN', 5],
      },
    ]);
    expect(applySendUtxoActions).toHaveBeenCalledWith(
      ctx,
      { rbfEnabled: false },
      expect.any(btc.Transaction),
      {
        forceIncludeOutpointList: ['txid:0'],
        overrideChangeAddress: 'overrideChangeAddress',
        useEffectiveFeeRate: true,
        allowUnconfirmedInput: true,
        allowUnknownInputs: true,
        allowUnknownOutputs: true,
        excludeOutpointList: ['txid:1'],
      },
      [
        {
          type: ActionType.SEND_UTXO,
          outpoint: 'txid:0',
          toAddress: addresses[0].nativeSegwit,
        },
      ],
    );
    expect(applySplitUtxoActions).toHaveBeenCalledWith(
      ctx,
      { rbfEnabled: false },
      expect.any(btc.Transaction),
      {
        forceIncludeOutpointList: ['txid:0'],
        overrideChangeAddress: 'overrideChangeAddress',
        useEffectiveFeeRate: true,
        allowUnconfirmedInput: true,
        allowUnknownInputs: true,
        allowUnknownOutputs: true,
        excludeOutpointList: ['txid:1'],
      },
      [
        {
          type: ActionType.SPLIT_UTXO,
          location: 'txid:1:100',
          toAddress: addresses[0].nativeSegwit,
        },
      ],
    );
    expect(applySendBtcActionsAndFee).toHaveBeenCalledWith(
      ctx,
      { rbfEnabled: false },
      expect.any(btc.Transaction),
      {
        forceIncludeOutpointList: ['txid:0'],
        overrideChangeAddress: 'overrideChangeAddress',
        useEffectiveFeeRate: true,
        allowUnconfirmedInput: true,
        allowUnknownInputs: true,
        allowUnknownOutputs: true,
        excludeOutpointList: ['txid:1'],
      },
      [
        {
          type: ActionType.SEND_BTC,
          toAddress: addresses[0].nativeSegwit,
          amount: 1000n,
          combinable: true,
        },
      ],
      1,
    );

    expect(paymentAddressContext.signInputs).not.toHaveBeenCalled();
    expect(ordinalsAddressContext.signInputs).not.toHaveBeenCalled();
  });
});
