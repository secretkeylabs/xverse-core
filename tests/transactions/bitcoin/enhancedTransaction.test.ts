import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  applySendBtcActionsAndFee,
  applySendUtxoActions,
  applySplitUtxoActions,
} from '../../../transactions/bitcoin/actionProcessors';
import { TransactionContext } from '../../../transactions/bitcoin/context';
import { EnhancedTransaction } from '../../../transactions/bitcoin/enhancedTransaction';
import { Action, ActionType } from '../../../transactions/bitcoin/types';
import { TestAddressContext, addresses } from './helpers';

vi.mock('../../../transactions/bitcoin/actionProcessors');
vi.mock('../../../transactions/bitcoin/context');

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

  it('should throw on low fee rate', () => {
    const txn = new EnhancedTransaction(
      ctx,
      [
        {
          type: ActionType.SEND_BTC,
          amount: 100000n,
          combinable: false,
          toAddress: addresses[0].nativeSegwit,
        },
      ],
      1,
    );
    expect(() => (txn.feeRate = 0)).throws('Fee rate must be a natural number');
    expect(() => (txn.feeRate = -1)).throws('Fee rate must be a natural number');
    expect(() => (txn.feeRate = 1)).not.toThrow();
  });

  it('should round decimal fee rate', () => {
    const txn = new EnhancedTransaction(
      ctx,
      [
        {
          type: ActionType.SEND_BTC,
          amount: 100000n,
          combinable: false,
          toAddress: addresses[0].nativeSegwit,
        },
      ],
      1,
    );

    txn.feeRate = 1.1;
    expect(txn.feeRate).equals(1);

    txn.feeRate = 1.5;
    expect(txn.feeRate).equals(2);
  });

  describe('should throw if spendable send utxo actions invalid', () => {
    it.each([
      [
        'with send actions',
        [
          {
            type: ActionType.SEND_BTC,
            amount: 100000n,
            combinable: false,
            toAddress: addresses[0].nativeSegwit,
          },
          {
            type: ActionType.SEND_UTXO,
            toAddress: addresses[0].nativeSegwit,
            outpoint: 'txid:0',
            spendable: true,
          },
        ],
        'Send Utxo actions must be the only actions if they are spendable',
      ],
      [
        'with split actions',
        [
          {
            type: ActionType.SPLIT_UTXO,
            location: 'utxo:0:100',
            combinable: false,
            toAddress: addresses[0].nativeSegwit,
          },
          {
            type: ActionType.SEND_UTXO,
            toAddress: addresses[0].nativeSegwit,
            outpoint: 'txid:0',
            spendable: true,
          },
        ],
        'Send Utxo actions must be the only actions if they are spendable',
      ],
      [
        'with non spendable send actions',
        [
          {
            type: ActionType.SEND_UTXO,
            outpoint: 'txid:1',
            toAddress: addresses[0].nativeSegwit,
          },
          {
            type: ActionType.SEND_UTXO,
            toAddress: addresses[0].nativeSegwit,
            outpoint: 'txid:0',
            spendable: true,
          },
        ],
        'Send Utxo actions must either all be spendable or only non-spendable',
      ],
      [
        'with spendable send actions to different addresses',
        [
          {
            type: ActionType.SEND_UTXO,
            outpoint: 'txid:1',
            toAddress: addresses[0].nativeSegwit,
            spendable: true,
          },
          {
            type: ActionType.SEND_UTXO,
            toAddress: addresses[1].nativeSegwit,
            outpoint: 'txid:0',
            spendable: true,
          },
        ],
        'Send Utxo actions must all be to the same address if spendable',
      ],
    ] as [string, Action[], string][])('%s', (_name, actions, msg) => {
      expect(() => new EnhancedTransaction(ctx, actions, 1)).throws(msg);
    });
  });

  it('should accept spendable send utxo actions if all to same address', () => {
    const txn = new EnhancedTransaction(
      ctx,
      [
        {
          type: ActionType.SEND_UTXO,
          outpoint: 'txid:0',
          toAddress: addresses[1].nativeSegwit,
          spendable: true,
        },
        {
          type: ActionType.SEND_UTXO,
          toAddress: addresses[1].nativeSegwit,
          outpoint: 'txid:1',
          spendable: true,
        },
        {
          type: ActionType.SEND_UTXO,
          toAddress: addresses[1].nativeSegwit,
          outpoint: 'txid:2',
          spendable: true,
        },
      ],
      1,
    );
    expect(txn.overrideChangeAddress).equals(addresses[1].nativeSegwit);
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

    vi.mocked(applySendUtxoActions).mockRejectedValue(new Error('Not enough utxos at desired fee rate'));

    await expect(() => txn.getFeeSummary()).rejects.toThrow('Not enough utxos at desired fee rate');
  });

  it('compiles transaction and summary correctly', async () => {
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

    const sendUtxoInputs = [
      {
        address: 'myAddress',
        utxo: { value: 100 },
        getBundleData: vi.fn().mockResolvedValueOnce({
          sat_ranges: [
            { offset: 0, range: { start: 1000, end: 1001 }, inscriptions: [{ id: 'inscriptionId' }], satributes: [] },
            { offset: 1, range: { start: 1001, end: 1100 }, inscriptions: [], satributes: ['PIZZA'] },
          ],
        }),
      } as any,
    ];
    vi.mocked(applySendUtxoActions).mockResolvedValueOnce({
      inputs: sendUtxoInputs,
      outputs: [
        {
          address: 'address1',
          amount: 100,
        },
      ],
    });

    const splitInputs = [
      {
        address: 'myAddress',
        utxo: { value: 2000 },
        getBundleData: vi.fn().mockResolvedValueOnce({
          sat_ranges: [
            { offset: 0, range: { start: 100, end: 101 }, inscriptions: [{ id: 'inscriptionId2' }], satributes: [] },
            {
              offset: 1000,
              range: { start: 201, end: 202 },
              inscriptions: [{ id: 'inscriptionId3' }],
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
          address: 'address2',
          amount: 1000,
        },
        {
          address: 'address3',
          amount: 1000,
        },
      ],
    });

    const sendBtcInputs = [
      {
        address: 'myAddress',
        utxo: { value: 1000 },
        getBundleData: vi.fn().mockResolvedValueOnce({
          sat_ranges: [
            { offset: 0, range: { start: 100, end: 101 }, inscriptions: [{ id: 'inscriptionId4' }], satributes: [] },
          ],
        }),
      } as any,
      {
        address: 'myAddress',
        utxo: { value: 1000 },
        getBundleData: vi.fn().mockResolvedValueOnce({
          sat_ranges: [],
        }),
      } as any,
      {
        address: 'myAddress',
        utxo: { value: 2000 },
        getBundleData: vi.fn().mockResolvedValueOnce({
          sat_ranges: [
            {
              offset: 100,
              range: { start: 800, end: 801 },
              inscriptions: [{ id: 'inscriptionId5' }],
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
          address: 'address4',
          amount: 2500,
        },
      ],
      actualFee: 500n,
      actualFeeRate: 50,
      effectiveFeeRate: 50,
    });

    // ==========================
    // actual thing we're testing
    const summary = await txn.getFeeSummary();
    // ==========================

    expect(summary).toEqual({
      fee: 500n,
      feeRate: 50,
      effectiveFeeRate: 50,
      vsize: 10, // size of an empty txn
      inputs: [...sendUtxoInputs, ...splitInputs, ...sendBtcInputs].map((i) => ({ extendedUtxo: i, sigHash: 1 })),
      outputs: [
        {
          address: 'address1',
          amount: 100,
          inscriptions: [
            {
              id: 'inscriptionId',
              offset: 0,
              fromAddress: 'myAddress',
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
          address: 'address2',
          amount: 1000,
          inscriptions: [
            {
              id: 'inscriptionId2',
              offset: 0,
              fromAddress: 'myAddress',
            },
          ],
          satributes: [
            {
              amount: 99,
              offset: 1001,
              types: ['VINTAGE'],
              fromAddress: 'myAddress',
            },
          ],
        },
        {
          address: 'address3',
          amount: 1000,
          inscriptions: [],
          satributes: [],
        },
        {
          address: 'address4',
          amount: 2500,
          inscriptions: [
            {
              id: 'inscriptionId4',
              offset: 0,
              fromAddress: 'myAddress',
            },
            {
              id: 'inscriptionId5',
              offset: 2100,
              fromAddress: 'myAddress',
            },
          ],
          satributes: [
            {
              amount: 100,
              offset: 2200,
              types: ['VINTAGE', 'ALPHA'],
              fromAddress: 'myAddress',
            },
            {
              amount: 100,
              offset: 3800,
              types: ['VINTAGE', 'ALPHA', 'BLOCK9'],
              fromAddress: 'myAddress',
            },
          ],
        },
      ],
      feeOutput: {
        amount: 500,
        inscriptions: [],
        satributes: [],
      },
    });

    expect(paymentAddressContext.signInputs).not.toHaveBeenCalled();
    expect(ordinalsAddressContext.signInputs).not.toHaveBeenCalled();
  });
});
