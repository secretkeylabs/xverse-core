import BigNumber from 'bignumber.js';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { RunesApi } from '../../api';
import { EnhancedTransaction } from '../../transactions/bitcoin/enhancedTransaction';
import { recoverRunes, sendRunes } from '../../transactions/runes';

vi.mock('../../transactions/bitcoin/enhancedTransaction');
vi.mock('../../api');

const RUNE_TEST = new Uint8Array(new TextEncoder().encode('RUNE_TEST'));
const paymentAddress = '3Aog9TGrjGtjFvZ1K675c7sHGkiiYKuV8K';
const ordinalsAddress = 'bc1pxau0prcas6r24l2jy5gtfy8mcmjkmd7zchynqd3cq7mh788xywys02dn56';
const recipientAddress = '33bbC6BdnAzSBs69j8nEnaShXeXsHNadc2';

describe('sendRunes', () => {
  const contextMock = {
    paymentAddress: {
      address: paymentAddress,
      getUtxos: vi.fn(),
    },
    ordinalsAddress: {
      address: ordinalsAddress,
      getUtxos: vi.fn(),
    },
  } as any;

  beforeEach(() => {
    vi.resetAllMocks();
    vi.clearAllMocks();
  });

  it('should throw on not enough balance', async () => {
    const dummyUtxos = [
      {
        outpoint: 'out1',
        utxo: {
          value: 1000,
        },
        getRuneBalance: vi.fn().mockResolvedValueOnce(BigNumber(500)),
        getBundleData: vi.fn().mockResolvedValueOnce({
          runes: {
            MYBIGRUNE: 500,
          },
        }),
      },
      {
        outpoint: 'out2',
        utxo: {
          value: 2000,
        },
        getRuneBalance: vi.fn().mockResolvedValueOnce(BigNumber(600)),
        getBundleData: vi.fn().mockResolvedValueOnce({
          runes: {
            MYBIGRUNE: 600,
          },
        }),
      },
      {
        outpoint: 'out3',
        utxo: {
          value: 2000,
        },
        getRuneBalance: vi.fn().mockResolvedValueOnce(undefined),
        getBundleData: vi.fn().mockResolvedValueOnce({
          runes: {},
        }),
      },
    ];
    contextMock.ordinalsAddress.getUtxos.mockResolvedValueOnce(dummyUtxos);

    await expect(() => sendRunes(contextMock, 'MYBIGRUNE', recipientAddress, 1200n, 2)).rejects.toThrow(
      'Not enough runes to send',
    );
  });

  it('should create txn without change if sending max amount', async () => {
    const dummyUtxos = [
      {
        outpoint: 'out1',
        utxo: {
          value: 1000,
        },
        getRuneBalance: vi.fn().mockResolvedValueOnce(BigNumber(500)),
        getBundleData: vi.fn().mockResolvedValueOnce({
          runes: {
            MYBIGRUNE: 500,
          },
        }),
      },
      {
        outpoint: 'out2',
        utxo: {
          value: 2000,
        },
        getRuneBalance: vi.fn().mockResolvedValueOnce(BigNumber(600)),
        getBundleData: vi.fn().mockResolvedValueOnce({
          runes: {
            MYBIGRUNE: 600,
          },
        }),
      },
      {
        outpoint: 'out3',
        utxo: {
          value: 2000,
        },
        getRuneBalance: vi.fn().mockResolvedValueOnce(undefined),
        getBundleData: vi.fn().mockResolvedValueOnce({
          runes: {},
        }),
      },
    ];
    contextMock.ordinalsAddress.getUtxos.mockResolvedValueOnce(dummyUtxos);

    const dummyBlock = 12345;
    const dummyTxIdx = 345;
    vi.mocked(RunesApi).mockImplementationOnce(
      () =>
        ({
          getRuneInfo: vi.fn().mockResolvedValueOnce({
            id: `${dummyBlock}:${dummyTxIdx}`,
          }),
          getRuneVarintFromNum: vi.fn().mockImplementation((num: BigNumber) => {
            return [num.toNumber()];
          }),
        } as any),
    );

    const transaction = await sendRunes(contextMock, 'MYBIGRUNE', recipientAddress, 1100n, 2);

    expect(EnhancedTransaction).toHaveBeenCalledTimes(1);
    expect(EnhancedTransaction).toHaveBeenCalledWith(
      contextMock,
      [
        {
          type: 'script',
          script: ['RETURN', RUNE_TEST, new Uint8Array([0, 809042265, 1100, 1])],
        },
        { type: 'sendBtc', toAddress: recipientAddress, amount: 546n, combinable: false },
      ],
      2,
      {
        forceIncludeOutpointList: ['out2', 'out1'],
        allowUnknownOutputs: true,
      },
    );
    expect(transaction).toEqual(vi.mocked(EnhancedTransaction).mock.instances[0]);
  });

  it('should create txn without change if sending amount covered by 1 utxo', async () => {
    const dummyUtxos = [
      {
        outpoint: 'out1',
        utxo: {
          value: 1000,
        },
        getRuneBalance: vi.fn().mockResolvedValueOnce(BigNumber(500)),
        getBundleData: vi.fn().mockResolvedValueOnce({
          runes: {
            MYBIGRUNE: 500,
          },
        }),
      },
      {
        outpoint: 'out2',
        utxo: {
          value: 2000,
        },
        getRuneBalance: vi.fn().mockResolvedValueOnce(BigNumber(600)),
        getBundleData: vi.fn().mockResolvedValueOnce({
          runes: {
            MYBIGRUNE: 600,
          },
        }),
      },
      {
        outpoint: 'out3',
        utxo: {
          value: 2000,
        },
        getRuneBalance: vi.fn().mockResolvedValueOnce(undefined),
        getBundleData: vi.fn().mockResolvedValueOnce({
          runes: {},
        }),
      },
    ];
    contextMock.ordinalsAddress.getUtxos.mockResolvedValueOnce(dummyUtxos);

    const dummyBlock = 12345;
    const dummyTxIdx = 345;
    vi.mocked(RunesApi).mockImplementationOnce(
      () =>
        ({
          getRuneInfo: vi.fn().mockResolvedValueOnce({
            id: `${dummyBlock}:${dummyTxIdx}`,
          }),
          getRuneVarintFromNum: vi.fn().mockImplementation((num: BigNumber) => {
            return [num.toNumber()];
          }),
        } as any),
    );

    const transaction = await sendRunes(contextMock, 'MYBIGRUNE', recipientAddress, 600n, 2);

    expect(EnhancedTransaction).toHaveBeenCalledTimes(1);
    expect(EnhancedTransaction).toHaveBeenCalledWith(
      contextMock,
      [
        {
          type: 'script',
          script: ['RETURN', RUNE_TEST, new Uint8Array([0, 809042265, 600, 1])],
        },
        { type: 'sendBtc', toAddress: recipientAddress, amount: 546n, combinable: false },
      ],
      2,
      {
        forceIncludeOutpointList: ['out2'],
        allowUnknownOutputs: true,
      },
    );
    expect(transaction).toEqual(vi.mocked(EnhancedTransaction).mock.instances[0]);
  });

  it('should create txn with change if sending amount covered by 2 utxos with left over', async () => {
    const dummyUtxos = [
      {
        outpoint: 'out1',
        utxo: {
          value: 1000,
        },
        getRuneBalance: vi.fn().mockResolvedValueOnce(BigNumber(500)),
        getBundleData: vi.fn().mockResolvedValueOnce({
          runes: {
            MYBIGRUNE: 500,
          },
        }),
      },
      {
        outpoint: 'out2',
        utxo: {
          value: 2000,
        },
        getRuneBalance: vi.fn().mockResolvedValueOnce(BigNumber(600)),
        getBundleData: vi.fn().mockResolvedValueOnce({
          runes: {
            MYBIGRUNE: 600,
          },
        }),
      },
      {
        outpoint: 'out3',
        utxo: {
          value: 2000,
        },
        getRuneBalance: vi.fn().mockResolvedValueOnce(undefined),
        getBundleData: vi.fn().mockResolvedValueOnce({
          runes: {},
        }),
      },
    ];
    contextMock.ordinalsAddress.getUtxos.mockResolvedValueOnce(dummyUtxos);

    const dummyBlock = 12345;
    const dummyTxIdx = 345;
    vi.mocked(RunesApi).mockImplementationOnce(
      () =>
        ({
          getRuneInfo: vi.fn().mockResolvedValueOnce({
            id: `${dummyBlock}:${dummyTxIdx}`,
          }),
          getRuneVarintFromNum: vi.fn().mockImplementation((num: BigNumber) => {
            return [num.toNumber()];
          }),
        } as any),
    );

    const transaction = await sendRunes(contextMock, 'MYBIGRUNE', recipientAddress, 1000n, 2);

    expect(EnhancedTransaction).toHaveBeenCalledTimes(1);
    expect(EnhancedTransaction).toHaveBeenCalledWith(
      contextMock,
      [
        {
          type: 'script',
          script: ['RETURN', RUNE_TEST, new Uint8Array([12, 2, 0, 809042265, 1000, 1])],
        },
        { type: 'sendBtc', toAddress: recipientAddress, amount: 546n, combinable: false },
        { type: 'sendBtc', toAddress: ordinalsAddress, amount: 546n, combinable: false },
      ],
      2,
      {
        forceIncludeOutpointList: ['out2', 'out1'],
        allowUnknownOutputs: true,
      },
    );
    expect(transaction).toEqual(vi.mocked(EnhancedTransaction).mock.instances[0]);
  });

  it('should create txn with change if sending round amount but other runes in utxos', async () => {
    const dummyUtxos = [
      {
        outpoint: 'out1',
        utxo: {
          value: 1000,
        },
        getRuneBalance: vi.fn().mockResolvedValueOnce(BigNumber(500)),
        getBundleData: vi.fn().mockResolvedValueOnce({
          runes: {
            MYBIGRUNE: 500,
            MYBIGRUNE2: 100,
          },
        }),
      },
      {
        outpoint: 'out2',
        utxo: {
          value: 2000,
        },
        getRuneBalance: vi.fn().mockResolvedValueOnce(BigNumber(600)),
        getBundleData: vi.fn().mockResolvedValueOnce({
          runes: {
            MYBIGRUNE: 600,
          },
        }),
      },
      {
        outpoint: 'out3',
        utxo: {
          value: 2000,
        },
        getRuneBalance: vi.fn().mockResolvedValueOnce(undefined),
        getBundleData: vi.fn().mockResolvedValueOnce({
          runes: {},
        }),
      },
    ];
    contextMock.ordinalsAddress.getUtxos.mockResolvedValueOnce(dummyUtxos);

    const dummyBlock = 12345;
    const dummyTxIdx = 345;
    vi.mocked(RunesApi).mockImplementationOnce(
      () =>
        ({
          getRuneInfo: vi.fn().mockResolvedValueOnce({
            id: `${dummyBlock}:${dummyTxIdx}`,
          }),
          getRuneVarintFromNum: vi.fn().mockImplementation((num: BigNumber) => {
            return [num.toNumber()];
          }),
        } as any),
    );

    const transaction = await sendRunes(contextMock, 'MYBIGRUNE', recipientAddress, 1100n, 2);

    expect(EnhancedTransaction).toHaveBeenCalledTimes(1);
    expect(EnhancedTransaction).toHaveBeenCalledWith(
      contextMock,
      [
        {
          type: 'script',
          script: ['RETURN', RUNE_TEST, new Uint8Array([12, 2, 0, 809042265, 1100, 1])],
        },
        { type: 'sendBtc', toAddress: recipientAddress, amount: 546n, combinable: false },
        { type: 'sendBtc', toAddress: ordinalsAddress, amount: 546n, combinable: false },
      ],
      2,
      {
        forceIncludeOutpointList: ['out2', 'out1'],
        allowUnknownOutputs: true,
      },
    );
    expect(transaction).toEqual(vi.mocked(EnhancedTransaction).mock.instances[0]);
  });
});

describe('recoverRunes', () => {
  const contextMock = {
    paymentAddress: {
      address: paymentAddress,
      getUtxos: vi.fn(),
    },
    ordinalsAddress: {
      address: ordinalsAddress,
      getUtxos: vi.fn(),
    },
  } as any;

  beforeEach(() => {
    vi.resetAllMocks();
    vi.clearAllMocks();
  });

  it('should throw on no runes to recover', async () => {
    const dummyUtxos = [
      {
        outpoint: 'out1',
        utxo: {
          value: 1000,
        },
        hasRunes: vi.fn().mockResolvedValueOnce(false),
      },
      {
        outpoint: 'out2',
        utxo: {
          value: 2000,
        },
        hasRunes: vi.fn().mockResolvedValueOnce(false),
      },
      {
        outpoint: 'out3',
        utxo: {
          value: 2000,
        },
        hasRunes: vi.fn().mockResolvedValueOnce(false),
      },
    ];
    contextMock.paymentAddress.getUtxos.mockResolvedValueOnce(dummyUtxos);

    await expect(() => recoverRunes(contextMock, 2)).rejects.toThrow('No runes to recover');
  });

  it('should create txn with rune change if there are runes to recover', async () => {
    const dummyUtxos = [
      {
        outpoint: 'out1',
        utxo: {
          value: 1000,
        },
        hasRunes: vi.fn().mockResolvedValueOnce(true),
      },
      {
        outpoint: 'out2',
        utxo: {
          value: 2000,
        },
        hasRunes: vi.fn().mockResolvedValueOnce(false),
      },
      {
        outpoint: 'out3',
        utxo: {
          value: 2000,
        },
        hasRunes: vi.fn().mockResolvedValueOnce(true),
      },
    ];
    contextMock.paymentAddress.getUtxos.mockResolvedValueOnce(dummyUtxos);

    const transaction = await recoverRunes(contextMock, 2);

    expect(EnhancedTransaction).toHaveBeenCalledTimes(1);
    expect(EnhancedTransaction).toHaveBeenCalledWith(
      contextMock,
      [
        {
          type: 'script',
          script: ['RETURN', RUNE_TEST, new Uint8Array([12, 1])],
        },
        { type: 'sendBtc', toAddress: ordinalsAddress, amount: 546n, combinable: false },
      ],
      2,
      {
        forceIncludeOutpointList: ['out1', 'out3'],
        allowUnknownOutputs: true,
      },
    );
    expect(transaction).toEqual(vi.mocked(EnhancedTransaction).mock.instances[0]);
  });
});
