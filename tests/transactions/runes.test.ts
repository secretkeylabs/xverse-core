import BigNumber from 'bignumber.js';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getRunesClient } from '../../api';
import { EnhancedTransaction } from '../../transactions/bitcoin/enhancedTransaction';
import { recoverRunes, sendManyRunes, sendRunes } from '../../transactions/runes';
import { addresses } from './bitcoin/helpers';

vi.mock('../../transactions/bitcoin/enhancedTransaction');
vi.mock('../../api');

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
          runes: [['MYBIGRUNE', { amount: 500, divisibility: 0, symbol: 'M' }]],
        }),
      },
      {
        outpoint: 'out2',
        utxo: {
          value: 2000,
        },
        getRuneBalance: vi.fn().mockResolvedValueOnce(BigNumber(600)),
        getBundleData: vi.fn().mockResolvedValueOnce({
          runes: [['MYBIGRUNE', { amount: 600, divisibility: 0, symbol: 'M' }]],
        }),
      },
      {
        outpoint: 'out3',
        utxo: {
          value: 2000,
        },
        getRuneBalance: vi.fn().mockResolvedValueOnce(undefined),
        getBundleData: vi.fn().mockResolvedValueOnce({
          runes: [],
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
          runes: [['MYBIGRUNE', { amount: 500, divisibility: 0, symbol: 'M' }]],
        }),
      },
      {
        outpoint: 'out2',
        utxo: {
          value: 2000,
        },
        getRuneBalance: vi.fn().mockResolvedValueOnce(BigNumber(600)),
        getBundleData: vi.fn().mockResolvedValueOnce({
          runes: [['MYBIGRUNE', { amount: 600, divisibility: 0, symbol: 'M' }]],
        }),
      },
      {
        outpoint: 'out3',
        utxo: {
          value: 2000,
        },
        getRuneBalance: vi.fn().mockResolvedValueOnce(undefined),
        getBundleData: vi.fn().mockResolvedValueOnce({
          runes: [],
        }),
      },
    ];
    contextMock.ordinalsAddress.getUtxos.mockResolvedValueOnce(dummyUtxos);

    const dummyBlock = 12345;
    const dummyTxIdx = 345;
    vi.mocked(getRunesClient).mockReturnValue({
      getRuneInfo: vi.fn().mockResolvedValueOnce({
        id: `${dummyBlock}:${dummyTxIdx}`,
      }),
      getEncodedScriptHex: vi.fn().mockResolvedValueOnce('6a05ffff000102'),
    } as any);

    const transaction = await sendRunes(contextMock, 'MYBIGRUNE', recipientAddress, 1100n, 2);

    expect(EnhancedTransaction).toHaveBeenCalledTimes(1);
    expect(EnhancedTransaction).toHaveBeenCalledWith(
      contextMock,
      [
        {
          type: 'script',
          script: new Uint8Array([0x6a, 5, 255, 255, 0, 1, 2]),
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
          runes: [['MYBIGRUNE', { amount: 500, divisibility: 0, symbol: 'M' }]],
        }),
      },
      {
        outpoint: 'out2',
        utxo: {
          value: 2000,
        },
        getRuneBalance: vi.fn().mockResolvedValueOnce(BigNumber(600)),
        getBundleData: vi.fn().mockResolvedValueOnce({
          runes: [['MYBIGRUNE', { amount: 600, divisibility: 0, symbol: 'M' }]],
        }),
      },
      {
        outpoint: 'out3',
        utxo: {
          value: 2000,
        },
        getRuneBalance: vi.fn().mockResolvedValueOnce(undefined),
        getBundleData: vi.fn().mockResolvedValueOnce({
          runes: [],
        }),
      },
    ];
    contextMock.ordinalsAddress.getUtxos.mockResolvedValueOnce(dummyUtxos);

    const dummyBlock = 12345;
    const dummyTxIdx = 345;
    vi.mocked(getRunesClient).mockReturnValue({
      getRuneInfo: vi.fn().mockResolvedValue({
        id: `${dummyBlock}:${dummyTxIdx}`,
      }),
      getEncodedScriptHex: vi.fn().mockResolvedValueOnce('6a05ffff000102'),
    } as any);

    const transaction = await sendRunes(contextMock, 'MYBIGRUNE', recipientAddress, 600n, 2);

    expect(EnhancedTransaction).toHaveBeenCalledTimes(1);
    expect(EnhancedTransaction).toHaveBeenCalledWith(
      contextMock,
      [
        {
          type: 'script',
          script: new Uint8Array([0x6a, 5, 255, 255, 0, 1, 2]),
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
          runes: [['MYBIGRUNE', { amount: 500, divisibility: 0, symbol: 'M' }]],
        }),
      },
      {
        outpoint: 'out2',
        utxo: {
          value: 2000,
        },
        getRuneBalance: vi.fn().mockResolvedValueOnce(BigNumber(600)),
        getBundleData: vi.fn().mockResolvedValueOnce({
          runes: [['MYBIGRUNE', { amount: 600, divisibility: 0, symbol: 'M' }]],
        }),
      },
      {
        outpoint: 'out3',
        utxo: {
          value: 2000,
        },
        getRuneBalance: vi.fn().mockResolvedValueOnce(undefined),
        getBundleData: vi.fn().mockResolvedValueOnce({
          runes: [],
        }),
      },
    ];
    contextMock.ordinalsAddress.getUtxos.mockResolvedValueOnce(dummyUtxos);

    const dummyBlock = 12345;
    const dummyTxIdx = 345;
    vi.mocked(getRunesClient).mockReturnValue({
      getRuneInfo: vi.fn().mockResolvedValueOnce({
        id: `${dummyBlock}:${dummyTxIdx}`,
      }),
      getEncodedScriptHex: vi.fn().mockResolvedValueOnce('6a05ffff000102'),
    } as any);

    const transaction = await sendRunes(contextMock, 'MYBIGRUNE', recipientAddress, 1000n, 2);

    expect(EnhancedTransaction).toHaveBeenCalledTimes(1);
    expect(EnhancedTransaction).toHaveBeenCalledWith(
      contextMock,
      [
        {
          type: 'script',
          script: new Uint8Array([0x6a, 5, 255, 255, 0, 1, 2]),
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
          runes: [
            ['MYBIGRUNE', { amount: 500, divisibility: 0, symbol: 'M' }],
            ['MYBIGRUNE2', { amount: 100, divisibility: 0, symbol: 'M' }],
          ],
        }),
      },
      {
        outpoint: 'out2',
        utxo: {
          value: 2000,
        },
        getRuneBalance: vi.fn().mockResolvedValueOnce(BigNumber(600)),
        getBundleData: vi.fn().mockResolvedValueOnce({
          runes: [['MYBIGRUNE', { amount: 600, divisibility: 0, symbol: 'M' }]],
        }),
      },
      {
        outpoint: 'out3',
        utxo: {
          value: 2000,
        },
        getRuneBalance: vi.fn().mockResolvedValueOnce(undefined),
        getBundleData: vi.fn().mockResolvedValueOnce({
          runes: [],
        }),
      },
    ];
    contextMock.ordinalsAddress.getUtxos.mockResolvedValueOnce(dummyUtxos);

    const dummyBlock = 12345;
    const dummyTxIdx = 345;
    vi.mocked(getRunesClient).mockReturnValue({
      getRuneInfo: vi.fn().mockResolvedValueOnce({
        id: `${dummyBlock}:${dummyTxIdx}`,
      }),
      getEncodedScriptHex: vi.fn().mockResolvedValueOnce('6a05ffff000102'),
    } as any);

    const transaction = await sendRunes(contextMock, 'MYBIGRUNE', recipientAddress, 1100n, 2);

    expect(EnhancedTransaction).toHaveBeenCalledTimes(1);
    expect(EnhancedTransaction).toHaveBeenCalledWith(
      contextMock,
      [
        {
          type: 'script',
          script: new Uint8Array([0x6a, 5, 255, 255, 0, 1, 2]),
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

describe('sendManyRunes', () => {
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
          runes: [['MYBIGRUNE', { amount: 500, divisibility: 0, symbol: 'M' }]],
        }),
      },
      {
        outpoint: 'out2',
        utxo: {
          value: 2000,
        },
        getRuneBalance: vi.fn().mockResolvedValueOnce(BigNumber(600)),
        getBundleData: vi.fn().mockResolvedValueOnce({
          runes: [['MYBIGRUNE', { amount: 600, divisibility: 0, symbol: 'M' }]],
        }),
      },
      {
        outpoint: 'out3',
        utxo: {
          value: 2000,
        },
        getRuneBalance: vi.fn().mockResolvedValueOnce(undefined),
        getBundleData: vi.fn().mockResolvedValueOnce({
          runes: [],
        }),
      },
    ];
    contextMock.ordinalsAddress.getUtxos.mockResolvedValueOnce(dummyUtxos);

    await expect(() =>
      sendManyRunes(contextMock, [{ runeName: 'MYBIGRUNE', toAddress: recipientAddress, amount: 1200n }], 2),
    ).rejects.toThrow('Not enough runes to send');
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
          runes: [['MYBIGRUNE', { amount: 500, divisibility: 0, symbol: 'M' }]],
        }),
      },
      {
        outpoint: 'out2',
        utxo: {
          value: 2000,
        },
        getRuneBalance: vi.fn().mockResolvedValueOnce(BigNumber(600)),
        getBundleData: vi.fn().mockResolvedValueOnce({
          runes: [['MYBIGRUNE', { amount: 600, divisibility: 0, symbol: 'M' }]],
        }),
      },
      {
        outpoint: 'out3',
        utxo: {
          value: 2000,
        },
        getRuneBalance: vi.fn().mockResolvedValueOnce(undefined),
        getBundleData: vi.fn().mockResolvedValueOnce({
          runes: [],
        }),
      },
    ];
    contextMock.ordinalsAddress.getUtxos.mockResolvedValueOnce(dummyUtxos);

    const dummyBlock = 12345;
    const dummyTxIdx = 345;
    vi.mocked(getRunesClient).mockReturnValue({
      getRuneInfo: vi.fn().mockResolvedValueOnce({
        id: `${dummyBlock}:${dummyTxIdx}`,
      }),
      getEncodedScriptHex: vi.fn().mockResolvedValueOnce('6a05ffff000102'),
    } as any);

    const transaction = await sendManyRunes(
      contextMock,
      [{ runeName: 'MYBIGRUNE', toAddress: recipientAddress, amount: 1100n }],
      2,
    );

    expect(EnhancedTransaction).toHaveBeenCalledTimes(1);
    expect(EnhancedTransaction).toHaveBeenCalledWith(
      contextMock,
      [
        {
          type: 'script',
          script: new Uint8Array([0x6a, 5, 255, 255, 0, 1, 2]),
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
          runes: [['MYBIGRUNE', { amount: 500, divisibility: 0, symbol: 'M' }]],
        }),
      },
      {
        outpoint: 'out2',
        utxo: {
          value: 2000,
        },
        getRuneBalance: vi.fn().mockResolvedValueOnce(BigNumber(600)),
        getBundleData: vi.fn().mockResolvedValueOnce({
          runes: [['MYBIGRUNE', { amount: 600, divisibility: 0, symbol: 'M' }]],
        }),
      },
      {
        outpoint: 'out3',
        utxo: {
          value: 2000,
        },
        getRuneBalance: vi.fn().mockResolvedValueOnce(undefined),
        getBundleData: vi.fn().mockResolvedValueOnce({
          runes: [],
        }),
      },
    ];
    contextMock.ordinalsAddress.getUtxos.mockResolvedValueOnce(dummyUtxos);

    const dummyBlock = 12345;
    const dummyTxIdx = 345;
    vi.mocked(getRunesClient).mockReturnValue({
      getRuneInfo: vi.fn().mockResolvedValue({
        id: `${dummyBlock}:${dummyTxIdx}`,
      }),
      getEncodedScriptHex: vi.fn().mockResolvedValueOnce('6a05ffff000102'),
    } as any);

    const transaction = await sendManyRunes(
      contextMock,
      [{ runeName: 'MYBIGRUNE', toAddress: recipientAddress, amount: 600n }],
      2,
    );

    expect(EnhancedTransaction).toHaveBeenCalledTimes(1);
    expect(EnhancedTransaction).toHaveBeenCalledWith(
      contextMock,
      [
        {
          type: 'script',
          script: new Uint8Array([0x6a, 5, 255, 255, 0, 1, 2]),
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
          runes: [['MYBIGRUNE', { amount: 500, divisibility: 0, symbol: 'M' }]],
        }),
      },
      {
        outpoint: 'out2',
        utxo: {
          value: 2000,
        },
        getRuneBalance: vi.fn().mockResolvedValueOnce(BigNumber(600)),
        getBundleData: vi.fn().mockResolvedValueOnce({
          runes: [['MYBIGRUNE', { amount: 600, divisibility: 0, symbol: 'M' }]],
        }),
      },
      {
        outpoint: 'out3',
        utxo: {
          value: 2000,
        },
        getRuneBalance: vi.fn().mockResolvedValueOnce(undefined),
        getBundleData: vi.fn().mockResolvedValueOnce({
          runes: [],
        }),
      },
    ];
    contextMock.ordinalsAddress.getUtxos.mockResolvedValueOnce(dummyUtxos);

    const dummyBlock = 12345;
    const dummyTxIdx = 345;
    vi.mocked(getRunesClient).mockReturnValue({
      getRuneInfo: vi.fn().mockResolvedValueOnce({
        id: `${dummyBlock}:${dummyTxIdx}`,
      }),
      getEncodedScriptHex: vi.fn().mockResolvedValueOnce('6a05ffff000102'),
    } as any);

    const transaction = await sendManyRunes(
      contextMock,
      [{ runeName: 'MYBIGRUNE', toAddress: recipientAddress, amount: 1000n }],
      2,
    );

    expect(EnhancedTransaction).toHaveBeenCalledTimes(1);
    expect(EnhancedTransaction).toHaveBeenCalledWith(
      contextMock,
      [
        {
          type: 'script',
          script: new Uint8Array([0x6a, 5, 255, 255, 0, 1, 2]),
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
          runes: [
            ['MYBIGRUNE', { amount: 500, divisibility: 0, symbol: 'M' }],
            ['MYBIGRUNE2', { amount: 100, divisibility: 0, symbol: 'M' }],
          ],
        }),
      },
      {
        outpoint: 'out2',
        utxo: {
          value: 2000,
        },
        getRuneBalance: vi.fn().mockResolvedValueOnce(BigNumber(600)),
        getBundleData: vi.fn().mockResolvedValueOnce({
          runes: [['MYBIGRUNE', { amount: 600, divisibility: 0, symbol: 'M' }]],
        }),
      },
      {
        outpoint: 'out3',
        utxo: {
          value: 2000,
        },
        getRuneBalance: vi.fn().mockResolvedValueOnce(undefined),
        getBundleData: vi.fn().mockResolvedValueOnce({
          runes: [],
        }),
      },
    ];
    contextMock.ordinalsAddress.getUtxos.mockResolvedValueOnce(dummyUtxos);

    const dummyBlock = 12345;
    const dummyTxIdx = 345;
    vi.mocked(getRunesClient).mockReturnValue({
      getRuneInfo: vi.fn().mockResolvedValueOnce({
        id: `${dummyBlock}:${dummyTxIdx}`,
      }),
      getEncodedScriptHex: vi.fn().mockResolvedValueOnce('6a05ffff000102'),
    } as any);

    const transaction = await sendManyRunes(
      contextMock,
      [{ runeName: 'MYBIGRUNE', toAddress: recipientAddress, amount: 1100n }],
      2,
    );

    expect(EnhancedTransaction).toHaveBeenCalledTimes(1);
    expect(EnhancedTransaction).toHaveBeenCalledWith(
      contextMock,
      [
        {
          type: 'script',
          script: new Uint8Array([0x6a, 5, 255, 255, 0, 1, 2]),
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

  it('should create txn with multiple recipients plus change and multiple runes', async () => {
    const dummyUtxos = [
      {
        outpoint: 'out1',
        utxo: {
          value: 1000,
        },
        getRuneBalance: vi.fn().mockResolvedValueOnce(BigNumber(500)),
        getBundleData: vi.fn().mockResolvedValueOnce({
          runes: [
            ['MYBIGRUNE', { amount: 500, divisibility: 0, symbol: 'M' }],
            ['MYBIGRUNE2', { amount: 100, divisibility: 0, symbol: 'M' }],
          ],
        }),
      },
      {
        outpoint: 'out2',
        utxo: {
          value: 2000,
        },
        getRuneBalance: vi.fn().mockResolvedValueOnce(BigNumber(600)),
        getBundleData: vi.fn().mockResolvedValueOnce({
          runes: [['MYBIGRUNE', { amount: 600, divisibility: 0, symbol: 'M' }]],
        }),
      },
      {
        outpoint: 'out3',
        utxo: {
          value: 2000,
        },
        getRuneBalance: vi.fn().mockResolvedValueOnce(undefined),
        getBundleData: vi.fn().mockResolvedValueOnce({
          runes: [],
        }),
      },
    ];
    contextMock.ordinalsAddress.getUtxos.mockResolvedValueOnce(dummyUtxos);

    const mockedGetEncodedScriptHex = vi.fn().mockResolvedValueOnce('6a05ffff000102');
    vi.mocked(getRunesClient).mockReturnValue({
      getRuneInfo: (runeName: string) => {
        if (runeName === 'MYBIGRUNE') {
          return {
            id: '12345:345',
          };
        }
        if (runeName === 'MYBIGRUNE2') {
          return {
            id: '677890:345',
          };
        }
        throw new Error('Unknown rune');
      },
      getEncodedScriptHex: mockedGetEncodedScriptHex,
    } as any);

    const transaction = await sendManyRunes(
      contextMock,
      [
        { runeName: 'MYBIGRUNE', toAddress: recipientAddress, amount: 500n },
        { runeName: 'MYBIGRUNE', toAddress: addresses[0].nativeSegwit, amount: 500n },
        { runeName: 'MYBIGRUNE2', toAddress: recipientAddress, amount: 50n },
      ],
      2,
    );

    expect(EnhancedTransaction).toHaveBeenCalledTimes(1);
    expect(EnhancedTransaction).toHaveBeenCalledWith(
      contextMock,
      [
        {
          type: 'script',
          script: new Uint8Array([0x6a, 5, 255, 255, 0, 1, 2]),
        },
        { type: 'sendBtc', toAddress: recipientAddress, amount: 546n, combinable: false },
        { type: 'sendBtc', toAddress: addresses[0].nativeSegwit, amount: 546n, combinable: false },
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
    expect(mockedGetEncodedScriptHex).toHaveBeenCalledTimes(1);
    expect(mockedGetEncodedScriptHex).toHaveBeenCalledWith({
      edicts: [
        { id: '12345:345', amount: BigNumber('500'), output: BigNumber('1') },
        { id: '12345:345', amount: BigNumber('500'), output: BigNumber('2') },
        { id: '677890:345', amount: BigNumber('50'), output: BigNumber('3') },
      ],
      pointer: 4,
    });
  });

  it('should create txn with multiple recipients and multiple runes', async () => {
    const dummyUtxos = [
      {
        outpoint: 'out1',
        utxo: {
          value: 1000,
        },
        getRuneBalance: vi.fn().mockResolvedValueOnce(BigNumber(500)),
        getBundleData: vi.fn().mockResolvedValueOnce({
          runes: [
            ['MYBIGRUNE', { amount: 500, divisibility: 0, symbol: 'M' }],
            ['MYBIGRUNE2', { amount: 100, divisibility: 0, symbol: 'M' }],
          ],
        }),
      },
      {
        outpoint: 'out2',
        utxo: {
          value: 2000,
        },
        getRuneBalance: vi.fn().mockResolvedValueOnce(BigNumber(600)),
        getBundleData: vi.fn().mockResolvedValueOnce({
          runes: [['MYBIGRUNE', { amount: 600, divisibility: 0, symbol: 'M' }]],
        }),
      },
      {
        outpoint: 'out3',
        utxo: {
          value: 2000,
        },
        getRuneBalance: vi.fn().mockResolvedValueOnce(undefined),
        getBundleData: vi.fn().mockResolvedValueOnce({
          runes: [],
        }),
      },
    ];
    contextMock.ordinalsAddress.getUtxos.mockResolvedValueOnce(dummyUtxos);

    const mockedGetEncodedScriptHex = vi.fn().mockResolvedValueOnce('6a05ffff000102');
    vi.mocked(getRunesClient).mockReturnValue({
      getRuneInfo: (runeName: string) => {
        if (runeName === 'MYBIGRUNE') {
          return {
            id: '12345:345',
          };
        }
        if (runeName === 'MYBIGRUNE2') {
          return {
            id: '677890:345',
          };
        }
        throw new Error('Unknown rune');
      },
      getEncodedScriptHex: mockedGetEncodedScriptHex,
    } as any);

    const transaction = await sendManyRunes(
      contextMock,
      [
        { runeName: 'MYBIGRUNE', toAddress: recipientAddress, amount: 500n },
        { runeName: 'MYBIGRUNE', toAddress: addresses[0].nativeSegwit, amount: 600n },
        { runeName: 'MYBIGRUNE2', toAddress: recipientAddress, amount: 100n },
      ],
      2,
    );

    expect(EnhancedTransaction).toHaveBeenCalledTimes(1);
    expect(EnhancedTransaction).toHaveBeenCalledWith(
      contextMock,
      [
        {
          type: 'script',
          script: new Uint8Array([0x6a, 5, 255, 255, 0, 1, 2]),
        },
        { type: 'sendBtc', toAddress: recipientAddress, amount: 546n, combinable: false },
        { type: 'sendBtc', toAddress: addresses[0].nativeSegwit, amount: 546n, combinable: false },
        { type: 'sendBtc', toAddress: recipientAddress, amount: 546n, combinable: false },
      ],
      2,
      {
        forceIncludeOutpointList: ['out2', 'out1'],
        allowUnknownOutputs: true,
      },
    );
    expect(transaction).toEqual(vi.mocked(EnhancedTransaction).mock.instances[0]);
    expect(mockedGetEncodedScriptHex).toHaveBeenCalledTimes(1);
    expect(mockedGetEncodedScriptHex).toHaveBeenCalledWith({
      edicts: [
        { id: '12345:345', amount: BigNumber('500'), output: BigNumber('1') },
        { id: '12345:345', amount: BigNumber('600'), output: BigNumber('2') },
        { id: '677890:345', amount: BigNumber('100'), output: BigNumber('3') },
      ],
      pointer: undefined,
    });
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

    vi.mocked(getRunesClient).mockReturnValue({
      getEncodedScriptHex: vi.fn().mockResolvedValueOnce('6a05ffff000102'),
    } as any);

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

    vi.mocked(getRunesClient).mockReturnValue({
      getEncodedScriptHex: vi.fn().mockResolvedValueOnce('6a05ffff000102'),
    } as any);

    const transaction = await recoverRunes(contextMock, 2);

    expect(EnhancedTransaction).toHaveBeenCalledTimes(1);
    expect(EnhancedTransaction).toHaveBeenCalledWith(
      contextMock,
      [
        {
          type: 'script',
          script: new Uint8Array([0x6a, 5, 255, 255, 0, 1, 2]),
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
