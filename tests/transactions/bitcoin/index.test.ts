import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ActionType, combineUtxos, sendBtc, sendMaxBtc } from '../../../transactions/bitcoin';
import { EnhancedTransaction } from '../../../transactions/bitcoin/enhancedTransaction';
import { addresses } from './helpers';

vi.mock('../../../transactions/bitcoin/enhancedTransaction');

describe('sendMaxBtc', () => {
  const paymentAddress = addresses[0].nestedSegwit;

  const recipientAddress = addresses[0].nativeSegwit;

  const contextMock = {
    paymentAddress: {
      address: paymentAddress,
      getUtxos: vi.fn(),
    },
  } as any;

  beforeEach(() => {
    vi.resetAllMocks();
    vi.clearAllMocks();
  });

  it('should throw if no UTXOs are available', async () => {
    contextMock.paymentAddress.getUtxos.mockResolvedValueOnce([]);

    await expect(sendMaxBtc(contextMock, recipientAddress, 2)).rejects.toThrow('No utxos found');
  });

  it('should use all UTXOs if dust is not skipped', async () => {
    const dummyUtxos = [
      {
        outpoint: 'out1',
        utxo: {
          value: 1000,
        },
      },
      {
        outpoint: 'out2',
        utxo: {
          value: 2000,
        },
      },
    ];
    contextMock.paymentAddress.getUtxos.mockResolvedValueOnce(dummyUtxos);

    const { transaction, dustFiltered } = await sendMaxBtc(contextMock, recipientAddress, 2, false);

    expect(dustFiltered).toEqual(false);
    expect(EnhancedTransaction).toHaveBeenCalledTimes(1);
    expect(EnhancedTransaction).toHaveBeenCalledWith(
      contextMock,
      [
        {
          type: ActionType.SEND_UTXO,
          combinable: true,
          spendable: true,
          outpoint: 'out1',
          toAddress: recipientAddress,
        },
        {
          type: ActionType.SEND_UTXO,
          combinable: true,
          spendable: true,
          outpoint: 'out2',
          toAddress: recipientAddress,
        },
      ],
      2,
    );
    expect(transaction).toEqual(vi.mocked(EnhancedTransaction).mock.instances[0]);
  });

  it('should filter UTXOs if dust is skipped', async () => {
    const dummyUtxos = [
      {
        outpoint: 'out1',
        utxo: {
          value: 1000,
        },
      },
      {
        outpoint: 'out2',
        utxo: {
          value: 2000,
        },
      },
    ];
    contextMock.paymentAddress.getUtxos.mockResolvedValueOnce(dummyUtxos);

    vi.mocked(EnhancedTransaction).mockImplementationOnce(
      () =>
        ({
          getSummary: async () =>
            ({
              dustValue: 1000,
            } as any),
        } as any),
    );

    const { transaction, dustFiltered } = await sendMaxBtc(contextMock, recipientAddress, 2, true);

    expect(dustFiltered).toEqual(true);
    expect(EnhancedTransaction).toHaveBeenCalledTimes(2);
    expect(EnhancedTransaction).toHaveBeenCalledWith(
      contextMock,
      [
        {
          type: ActionType.SEND_UTXO,
          combinable: true,
          spendable: true,
          outpoint: 'out1',
          toAddress: recipientAddress,
        },
      ],
      2,
    );
    expect(EnhancedTransaction).toHaveBeenCalledWith(
      contextMock,
      [
        {
          type: ActionType.SEND_UTXO,
          combinable: true,
          spendable: true,
          outpoint: 'out2',
          toAddress: recipientAddress,
        },
      ],
      2,
    );
    expect(transaction).toEqual(vi.mocked(EnhancedTransaction).mock.instances[1]);
  });

  it('should not filter UTXOs if all are above dust', async () => {
    const dummyUtxos = [
      {
        outpoint: 'out1',
        utxo: {
          value: 1000,
        },
      },
      {
        outpoint: 'out2',
        utxo: {
          value: 2000,
        },
      },
    ];
    contextMock.paymentAddress.getUtxos.mockResolvedValueOnce(dummyUtxos);

    vi.mocked(EnhancedTransaction).mockImplementationOnce(
      () =>
        ({
          getSummary: async () =>
            ({
              dustValue: 900,
            } as any),
        } as any),
    );

    const { transaction, dustFiltered } = await sendMaxBtc(contextMock, recipientAddress, 2, true);

    expect(dustFiltered).toEqual(false);
    expect(EnhancedTransaction).toHaveBeenCalledTimes(2);
    expect(EnhancedTransaction).toHaveBeenCalledWith(
      contextMock,
      [
        {
          type: ActionType.SEND_UTXO,
          combinable: true,
          spendable: true,
          outpoint: 'out1',
          toAddress: recipientAddress,
        },
      ],
      2,
    );
    expect(EnhancedTransaction).toHaveBeenCalledWith(
      contextMock,
      [
        {
          type: ActionType.SEND_UTXO,
          combinable: true,
          spendable: true,
          outpoint: 'out1',
          toAddress: recipientAddress,
        },
        {
          type: ActionType.SEND_UTXO,
          combinable: true,
          spendable: true,
          outpoint: 'out2',
          toAddress: recipientAddress,
        },
      ],
      2,
    );
    expect(transaction).toEqual(vi.mocked(EnhancedTransaction).mock.instances[1]);
  });

  it('should throw if all utxos below dust', async () => {
    const dummyUtxos = [
      {
        outpoint: 'out1',
        utxo: {
          value: 1000,
        },
      },
      {
        outpoint: 'out2',
        utxo: {
          value: 2000,
        },
      },
    ];
    contextMock.paymentAddress.getUtxos.mockResolvedValueOnce(dummyUtxos);

    vi.mocked(EnhancedTransaction).mockImplementationOnce(
      () =>
        ({
          getSummary: async () =>
            ({
              dustValue: 3000,
            } as any),
        } as any),
    );

    await expect(() => sendMaxBtc(contextMock, recipientAddress, 2, true)).rejects.toThrow('All UTXOs are dust');

    expect(EnhancedTransaction).toHaveBeenCalledTimes(1);
    expect(EnhancedTransaction).toHaveBeenCalledWith(
      contextMock,
      [
        {
          type: ActionType.SEND_UTXO,
          combinable: true,
          spendable: true,
          outpoint: 'out1',
          toAddress: recipientAddress,
        },
      ],
      2,
    );
  });
});

describe('combineUtxos', () => {
  const recipientAddress = addresses[0].nativeSegwit;

  const contextMock = {} as any;

  beforeEach(() => {
    vi.resetAllMocks();
    vi.clearAllMocks();
  });

  it('should generate correct transaction - non spendable', async () => {
    const dummyOutpoints = ['out1', 'out2'];
    const transaction = await combineUtxos(contextMock, dummyOutpoints, recipientAddress, 2);

    expect(EnhancedTransaction).toHaveBeenCalledTimes(1);
    expect(EnhancedTransaction).toHaveBeenCalledWith(
      contextMock,
      [
        {
          type: ActionType.SEND_UTXO,
          combinable: true,
          spendable: false,
          outpoint: 'out1',
          toAddress: recipientAddress,
        },
        {
          type: ActionType.SEND_UTXO,
          combinable: true,
          spendable: false,
          outpoint: 'out2',
          toAddress: recipientAddress,
        },
      ],
      2,
    );
    expect(transaction).toEqual(vi.mocked(EnhancedTransaction).mock.instances[0]);
  });

  it('should generate correct transaction - spendable', async () => {
    const dummyOutpoints = ['out1', 'out2'];
    const transaction = await combineUtxos(contextMock, dummyOutpoints, recipientAddress, 2, true);

    expect(EnhancedTransaction).toHaveBeenCalledTimes(1);
    expect(EnhancedTransaction).toHaveBeenCalledWith(
      contextMock,
      [
        {
          type: ActionType.SEND_UTXO,
          combinable: true,
          spendable: true,
          outpoint: 'out1',
          toAddress: recipientAddress,
        },
        {
          type: ActionType.SEND_UTXO,
          combinable: true,
          spendable: true,
          outpoint: 'out2',
          toAddress: recipientAddress,
        },
      ],
      2,
    );
    expect(transaction).toEqual(vi.mocked(EnhancedTransaction).mock.instances[0]);
  });
});

describe('sendBtc', () => {
  const paymentAddress = addresses[0].nestedSegwit;
  const ordinalsAddress = addresses[0].taproot;

  const contextMock = {} as any;

  beforeEach(() => {
    vi.resetAllMocks();
    vi.clearAllMocks();
  });

  it('should generate correct transaction', async () => {
    const recipients = [
      {
        toAddress: paymentAddress,
        amount: 10000n,
      },
      {
        toAddress: ordinalsAddress,
        amount: 20000n,
      },
    ];
    const transaction = await sendBtc(contextMock, recipients, 2);

    expect(EnhancedTransaction).toHaveBeenCalledTimes(1);
    expect(EnhancedTransaction).toHaveBeenCalledWith(
      contextMock,
      [
        {
          type: ActionType.SEND_BTC,
          combinable: false,
          toAddress: paymentAddress,
          amount: 10000n,
        },
        {
          type: ActionType.SEND_BTC,
          combinable: false,
          toAddress: ordinalsAddress,
          amount: 20000n,
        },
      ],
      2,
    );
    expect(transaction).toEqual(vi.mocked(EnhancedTransaction).mock.instances[0]);
  });
});
