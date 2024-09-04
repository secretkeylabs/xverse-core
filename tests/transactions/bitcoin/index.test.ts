import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  ActionType,
  combineUtxos,
  sendBtc,
  sendMaxBtc,
  sendOrdinals,
  sendOrdinalsWithSplit,
} from '../../../transactions/bitcoin';
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
    expect(EnhancedTransaction).toHaveBeenCalledWith(contextMock, [], 2, {
      forceIncludeOutpointList: ['out1', 'out2'],
      overrideChangeAddress: recipientAddress,
    });
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
    expect(EnhancedTransaction).toHaveBeenCalledWith(contextMock, [], 2, { forceIncludeOutpointList: ['out1'] });
    expect(EnhancedTransaction).toHaveBeenCalledWith(contextMock, [], 2, {
      forceIncludeOutpointList: ['out2'],
      overrideChangeAddress: recipientAddress,
    });
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
    expect(EnhancedTransaction).toHaveBeenCalledWith(contextMock, [], 2, { forceIncludeOutpointList: ['out1'] });
    expect(EnhancedTransaction).toHaveBeenCalledWith(contextMock, [], 2, {
      forceIncludeOutpointList: ['out1', 'out2'],
      overrideChangeAddress: recipientAddress,
    });
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
    expect(EnhancedTransaction).toHaveBeenCalledWith(contextMock, [], 2, { forceIncludeOutpointList: ['out1'] });
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
          outpoint: 'out1',
          toAddress: recipientAddress,
        },
        {
          type: ActionType.SEND_UTXO,
          combinable: true,
          outpoint: 'out2',
          toAddress: recipientAddress,
        },
      ],
      2,
      undefined,
    );
    expect(transaction).toEqual(vi.mocked(EnhancedTransaction).mock.instances[0]);
  });

  it('should generate correct transaction - spendable', async () => {
    const dummyOutpoints = ['out1', 'out2'];
    const transaction = await combineUtxos(contextMock, dummyOutpoints, recipientAddress, 2);

    expect(EnhancedTransaction).toHaveBeenCalledTimes(1);
    expect(EnhancedTransaction).toHaveBeenCalledWith(
      contextMock,
      [
        {
          type: ActionType.SEND_UTXO,
          combinable: true,
          outpoint: 'out1',
          toAddress: recipientAddress,
        },
        {
          type: ActionType.SEND_UTXO,
          combinable: true,
          outpoint: 'out2',
          toAddress: recipientAddress,
        },
      ],
      2,
      undefined,
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
      undefined,
    );
    expect(transaction).toEqual(vi.mocked(EnhancedTransaction).mock.instances[0]);
  });
});

describe('sendOrdinals', () => {
  const paymentsAddress = addresses[0].nestedSegwit;
  const ordinalsAddress = addresses[0].taproot;

  const contextMock = {
    getInscriptionUtxo: vi.fn(),
  } as any;

  beforeEach(() => {
    vi.resetAllMocks();
    vi.clearAllMocks();
  });

  it('should throw if not recipients are provided', async () => {
    await expect(sendOrdinals(contextMock, [], 2)).rejects.toThrow('Must provide at least 1 recipient');
  });

  it('should generate correct transaction with outpoints', async () => {
    const recipients = [
      {
        toAddress: ordinalsAddress,
        outpoint: 'out1',
      },
    ];
    const transaction = await sendOrdinals(contextMock, recipients, 2);

    expect(EnhancedTransaction).toHaveBeenCalledTimes(1);
    expect(EnhancedTransaction).toHaveBeenCalledWith(
      contextMock,
      [
        {
          type: ActionType.SEND_UTXO,
          combinable: false,
          spendable: false,
          toAddress: ordinalsAddress,
          outpoint: 'out1',
        },
      ],
      2,
      undefined,
    );
    expect(transaction).toEqual(vi.mocked(EnhancedTransaction).mock.instances[0]);
  });

  it('should generate correct transaction with inscription ids', async () => {
    const recipients = [
      {
        toAddress: ordinalsAddress,
        outpoint: 'out1',
      },
      {
        toAddress: paymentsAddress,
        inscriptionId: 'i1',
      },
      {
        toAddress: ordinalsAddress,
        inscriptionId: 'i2',
      },
    ];

    contextMock.getInscriptionUtxo.mockImplementation(async (inscriptionId: string) => {
      return {
        extendedUtxo: { outpoint: `outpoint-${inscriptionId}` },
      };
    });

    const transaction = await sendOrdinals(contextMock, recipients, 2);

    expect(EnhancedTransaction).toHaveBeenCalledTimes(1);
    expect(EnhancedTransaction).toHaveBeenCalledWith(
      contextMock,
      [
        {
          type: ActionType.SEND_UTXO,
          combinable: false,
          spendable: false,
          toAddress: ordinalsAddress,
          outpoint: 'out1',
        },
        {
          type: ActionType.SEND_UTXO,
          combinable: false,
          spendable: false,
          toAddress: paymentsAddress,
          outpoint: 'outpoint-i1',
        },
        {
          type: ActionType.SEND_UTXO,
          combinable: false,
          spendable: false,
          toAddress: ordinalsAddress,
          outpoint: 'outpoint-i2',
        },
      ],
      2,
      undefined,
    );
    expect(transaction).toEqual(vi.mocked(EnhancedTransaction).mock.instances[0]);
  });

  it('should throw if utxo for inscription not found', async () => {
    const recipients = [
      {
        toAddress: paymentsAddress,
        inscriptionId: 'i1',
      },
    ];

    contextMock.getInscriptionUtxo.mockResolvedValueOnce({});

    await expect(() => sendOrdinals(contextMock, recipients, 2)).rejects.toThrow('No utxo found for inscription');
  });
});

describe('sendOrdinalsWithSplit', () => {
  const paymentAddress = addresses[0].nestedSegwit;

  const recipientAddress = addresses[0].nativeSegwit;
  const recipientAddress2 = addresses[1].nativeSegwit;

  const contextMock = {
    paymentAddress: {
      address: paymentAddress,
    },
    getInscriptionUtxo: vi.fn(),
    getUtxo: vi.fn(),
  } as any;

  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('should throw on no recipients', async () => {
    await expect(() => sendOrdinalsWithSplit(contextMock, [], 2)).rejects.toThrow('Must provide at least 1 recipient');
  });

  it('should generate send utxo if single recipient and one sat range', async () => {
    contextMock.getUtxo.mockResolvedValueOnce({
      extendedUtxo: {
        utxo: { value: 1000, address: paymentAddress },
        getBundleData: () => ({
          sat_ranges: [{}],
        }),
      },
    });

    const transaction = await sendOrdinalsWithSplit(
      contextMock,
      [{ toAddress: recipientAddress, location: 'out:1:0' }],
      2,
    );

    expect(EnhancedTransaction).toHaveBeenCalledTimes(1);
    expect(EnhancedTransaction).toHaveBeenCalledWith(
      contextMock,
      [
        {
          type: ActionType.SEND_UTXO,
          toAddress: recipientAddress,
          outpoint: 'out:1',
        },
      ],
      2,
      undefined,
    );
    expect(transaction).toEqual(vi.mocked(EnhancedTransaction).mock.instances[0]);
  });

  it('should generate correct transaction for single recipient', async () => {
    contextMock.getUtxo.mockResolvedValueOnce({
      extendedUtxo: {
        utxo: { value: 1000, address: paymentAddress },
        getBundleData: () => ({
          sat_ranges: [{}, {}],
        }),
      },
    });

    const transaction = await sendOrdinalsWithSplit(
      contextMock,
      [{ toAddress: recipientAddress, location: 'out:1:0' }],
      2,
    );

    expect(EnhancedTransaction).toHaveBeenCalledTimes(1);
    expect(EnhancedTransaction).toHaveBeenCalledWith(
      contextMock,
      [
        {
          type: ActionType.SPLIT_UTXO,
          toAddress: recipientAddress,
          location: 'out:1:0',
        },
      ],
      2,
      undefined,
    );
    expect(transaction).toEqual(vi.mocked(EnhancedTransaction).mock.instances[0]);
  });

  it('should generate correct transaction for sending inscriptions', async () => {
    contextMock.getInscriptionUtxo.mockResolvedValueOnce({
      extendedUtxo: {
        outpoint: 'out:1',
        getBundleData: () => ({
          sat_ranges: [
            {
              inscriptions: [{ id: 'inscriptionIdi1' }],
            },
            {
              inscriptions: [{ id: 'inscriptionIdi0' }],
              offset: 4,
            },
          ],
        }),
      },
    });
    contextMock.getUtxo.mockResolvedValueOnce({
      extendedUtxo: {
        utxo: { value: 1000, address: paymentAddress },
        getBundleData: () => ({
          sat_ranges: [{}, {}],
        }),
      },
    });

    const transaction = await sendOrdinalsWithSplit(
      contextMock,
      [{ toAddress: recipientAddress, inscriptionId: 'inscriptionIdi0' }],
      2,
    );

    expect(contextMock.getInscriptionUtxo).toHaveBeenCalledTimes(1);
    expect(contextMock.getInscriptionUtxo).toHaveBeenCalledWith('inscriptionIdi0');
    expect(EnhancedTransaction).toHaveBeenCalledTimes(1);
    expect(EnhancedTransaction).toHaveBeenCalledWith(
      contextMock,
      [
        {
          type: ActionType.SPLIT_UTXO,
          toAddress: recipientAddress,
          location: 'out:1:0',
        },
      ],
      2,
      undefined,
    );
    expect(transaction).toEqual(vi.mocked(EnhancedTransaction).mock.instances[0]);
  });

  it('should not split when sending a single inscription to a single recipient on a 10k sat', async () => {
    contextMock.getInscriptionUtxo.mockResolvedValueOnce({
      extendedUtxo: {
        outpoint: 'out:1',
        getBundleData: () => ({
          sat_ranges: [
            {
              inscriptions: [{ id: 'inscriptionIdi0' }],
              offset: 0,
            },
          ],
        }),
      },
    });
    contextMock.getUtxo.mockResolvedValueOnce({
      extendedUtxo: {
        utxo: { value: 10000, address: paymentAddress },
        getBundleData: () => ({
          sat_ranges: [{}],
        }),
      },
    });

    const transaction = await sendOrdinalsWithSplit(
      contextMock,
      [{ toAddress: recipientAddress, inscriptionId: 'inscriptionIdi0' }],
      2,
    );

    expect(contextMock.getInscriptionUtxo).toHaveBeenCalledTimes(1);
    expect(contextMock.getInscriptionUtxo).toHaveBeenCalledWith('inscriptionIdi0');
    expect(EnhancedTransaction).toHaveBeenCalledTimes(1);
    expect(EnhancedTransaction).toHaveBeenCalledWith(
      contextMock,
      [
        {
          type: ActionType.SEND_UTXO,
          toAddress: recipientAddress,
          outpoint: 'out:1',
        },
      ],
      2,
      undefined,
    );
    expect(transaction).toEqual(vi.mocked(EnhancedTransaction).mock.instances[0]);
  });

  it('should split when sending an inscription on a > 10k sat', async () => {
    contextMock.getInscriptionUtxo.mockResolvedValueOnce({
      extendedUtxo: {
        outpoint: 'out:1',
        getBundleData: () => ({
          sat_ranges: [
            {
              inscriptions: [{ id: 'inscriptionIdi0' }],
              offset: 4,
            },
          ],
        }),
      },
    });
    contextMock.getUtxo.mockResolvedValueOnce({
      extendedUtxo: {
        utxo: { value: 11000, address: paymentAddress },
        getBundleData: () => ({
          sat_ranges: [{}],
        }),
      },
    });

    const transaction = await sendOrdinalsWithSplit(
      contextMock,
      [{ toAddress: recipientAddress, inscriptionId: 'inscriptionIdi0' }],
      2,
    );

    expect(contextMock.getInscriptionUtxo).toHaveBeenCalledTimes(1);
    expect(contextMock.getInscriptionUtxo).toHaveBeenCalledWith('inscriptionIdi0');
    expect(EnhancedTransaction).toHaveBeenCalledTimes(1);
    expect(EnhancedTransaction).toHaveBeenCalledWith(
      contextMock,
      [
        {
          type: ActionType.SPLIT_UTXO,
          toAddress: recipientAddress,
          location: 'out:1:0',
        },
        {
          type: ActionType.SPLIT_UTXO,
          toAddress: paymentAddress,
          location: 'out:1:550', // 546 + 4
        },
      ],
      2,
      undefined,
    );
    expect(transaction).toEqual(vi.mocked(EnhancedTransaction).mock.instances[0]);
  });

  it('should generate correct txn for many sends', async () => {
    contextMock.getUtxo.mockResolvedValueOnce({
      extendedUtxo: {
        utxo: { value: 100000, address: paymentAddress },
        getBundleData: () => ({
          sat_ranges: [{}],
        }),
      },
    });

    const transaction = await sendOrdinalsWithSplit(
      contextMock,
      [
        { toAddress: recipientAddress, location: 'out:1:10' },
        { toAddress: recipientAddress, location: 'out:1:600' },
        { toAddress: recipientAddress, location: 'out:1:10000' },
        { toAddress: recipientAddress2, location: 'out:1:50000' },
        { toAddress: recipientAddress, location: 'out:1:50200' },
        { toAddress: recipientAddress, location: 'out:1:70000' },
        { toAddress: recipientAddress2, location: 'out:1:80000' },
      ],
      2,
    );

    expect(EnhancedTransaction).toHaveBeenCalledTimes(1);
    expect(EnhancedTransaction).toHaveBeenCalledWith(
      contextMock,
      [
        {
          location: 'out:1:0',
          toAddress: recipientAddress,
          type: ActionType.SPLIT_UTXO,
        },
        {
          location: 'out:1:600',
          toAddress: recipientAddress,
          type: ActionType.SPLIT_UTXO,
        },
        {
          location: 'out:1:1146',
          toAddress: paymentAddress,
          type: ActionType.SPLIT_UTXO,
        },
        {
          location: 'out:1:10000',
          toAddress: recipientAddress,
          type: ActionType.SPLIT_UTXO,
        },
        {
          location: 'out:1:10546',
          toAddress: paymentAddress,
          type: ActionType.SPLIT_UTXO,
        },
        {
          location: 'out:1:49654',
          toAddress: recipientAddress2,
          type: ActionType.SPLIT_UTXO,
        },
        {
          location: 'out:1:50200',
          toAddress: recipientAddress,
          type: ActionType.SPLIT_UTXO,
        },
        {
          location: 'out:1:50746',
          toAddress: paymentAddress,
          type: ActionType.SPLIT_UTXO,
        },
        {
          location: 'out:1:70000',
          toAddress: recipientAddress,
          type: ActionType.SPLIT_UTXO,
        },
        {
          location: 'out:1:70546',
          toAddress: paymentAddress,
          type: ActionType.SPLIT_UTXO,
        },
        {
          location: 'out:1:80000',
          toAddress: recipientAddress2,
          type: ActionType.SPLIT_UTXO,
        },
        {
          location: 'out:1:80546',
          toAddress: paymentAddress,
          type: ActionType.SPLIT_UTXO,
        },
      ],
      2,
      undefined,
    );
    expect(transaction).toEqual(vi.mocked(EnhancedTransaction).mock.instances[0]);
  });

  it('should generate correct txn for complex stuff', async () => {
    contextMock.getInscriptionUtxo.mockResolvedValueOnce({
      extendedUtxo: {
        outpoint: 'out:1',
        getBundleData: () => ({
          sat_ranges: [
            {
              inscriptions: [{ id: 'inscriptionIdi1' }],
            },
            {
              inscriptions: [{ id: 'inscriptionIdi0' }],
              offset: 4,
            },
          ],
        }),
      },
    });
    contextMock.getInscriptionUtxo.mockResolvedValueOnce({
      extendedUtxo: {
        outpoint: 'out:2',
        getBundleData: () => ({
          sat_ranges: [
            {
              inscriptions: [{ id: 'inscriptionIdi3' }],
            },
            {
              inscriptions: [{ id: 'inscriptionIdi2' }],
              offset: 1500,
            },
          ],
        }),
      },
    });
    contextMock.getUtxo.mockResolvedValueOnce({
      extendedUtxo: {
        utxo: { value: 10000, address: paymentAddress },
        getBundleData: () => ({
          sat_ranges: [{}],
        }),
      },
    });
    contextMock.getUtxo.mockResolvedValueOnce({
      extendedUtxo: {
        utxo: { value: 100000, address: paymentAddress },
        getBundleData: () => ({
          sat_ranges: [{}],
        }),
      },
    });
    contextMock.getUtxo.mockResolvedValueOnce({
      extendedUtxo: {
        utxo: { value: 11000, address: paymentAddress },
        getBundleData: () => ({
          sat_ranges: [{}],
        }),
      },
    });

    const transaction = await sendOrdinalsWithSplit(
      contextMock,
      [
        { toAddress: recipientAddress, inscriptionId: 'inscriptionIdi0' },
        { toAddress: recipientAddress, location: 'out:1:600' },
        { toAddress: recipientAddress, location: 'out:1:10000' },
        { toAddress: recipientAddress2, inscriptionId: 'inscriptionIdi2' },
        { toAddress: recipientAddress, location: 'out:1:5000' },
        { toAddress: recipientAddress, location: 'out:2:70000' },
        { toAddress: recipientAddress2, location: 'out:2:80000' },
        { toAddress: recipientAddress2, location: 'out:3:1000' },
      ],
      2,
    );

    expect(EnhancedTransaction).toHaveBeenCalledTimes(1);
    expect(EnhancedTransaction).toHaveBeenCalledWith(
      contextMock,
      [
        {
          location: 'out:1:0',
          toAddress: recipientAddress,
          type: ActionType.SPLIT_UTXO,
        },
        {
          location: 'out:1:600',
          toAddress: recipientAddress,
          type: ActionType.SPLIT_UTXO,
        },
        {
          location: 'out:1:1146',
          toAddress: paymentAddress,
          type: ActionType.SPLIT_UTXO,
        },
        {
          location: 'out:1:5000',
          toAddress: recipientAddress,
          type: ActionType.SPLIT_UTXO,
        },
        {
          location: 'out:1:5546',
          toAddress: paymentAddress,
          type: ActionType.SPLIT_UTXO,
        },
        {
          location: 'out:1:9454',
          toAddress: recipientAddress,
          type: ActionType.SPLIT_UTXO,
        },
        {
          location: 'out:2:1500',
          toAddress: recipientAddress2,
          type: ActionType.SPLIT_UTXO,
        },
        {
          location: 'out:2:2046',
          toAddress: paymentAddress,
          type: ActionType.SPLIT_UTXO,
        },
        {
          location: 'out:2:70000',
          toAddress: recipientAddress,
          type: ActionType.SPLIT_UTXO,
        },
        {
          location: 'out:2:70546',
          toAddress: paymentAddress,
          type: ActionType.SPLIT_UTXO,
        },
        {
          location: 'out:2:80000',
          toAddress: recipientAddress2,
          type: ActionType.SPLIT_UTXO,
        },
        {
          location: 'out:2:80546',
          toAddress: paymentAddress,
          type: ActionType.SPLIT_UTXO,
        },
        {
          location: 'out:3:0',
          toAddress: recipientAddress2,
          type: ActionType.SPLIT_UTXO,
        },
        {
          location: 'out:3:1500',
          toAddress: paymentAddress,
          type: ActionType.SPLIT_UTXO,
        },
      ],
      2,
      undefined,
    );
    expect(transaction).toEqual(vi.mocked(EnhancedTransaction).mock.instances[0]);
  });

  describe('should throw on splits too close together', () => {
    it.each([
      [['out:1:10', 'out:1:20']],
      [['out:1:10', 'out:1:200']],
      [['out:1:9500', 'out:1:9501']],
      [['out:1:8500', 'out:1:9000', 'out:1:9001']],
    ])('%s', async (locations) => {
      contextMock.getUtxo.mockResolvedValueOnce({
        extendedUtxo: {
          utxo: { value: 10000, address: paymentAddress },
          getBundleData: () => ({
            sat_ranges: [{}],
          }),
        },
      });

      await expect(() =>
        sendOrdinalsWithSplit(
          contextMock,
          locations.map((location) => ({ toAddress: recipientAddress, location })),
          2,
        ),
      ).rejects.toThrow('Cannot split utxo, desired offsets interfere with each other');
    });
  });
});
