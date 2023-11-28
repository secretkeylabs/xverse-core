import { beforeEach, describe, expect, it, vi } from 'vitest';

import { getOrdinalIdsFromUtxo } from '../../api/ordinals';
import xverseInscribeApi from '../../api/xverseInscribe';
import { generateSignedBtcTransaction, selectUtxosForSend } from '../../transactions/btc';
import {
  InscriptionErrorCode,
  inscriptionMintExecute,
  inscriptionMintFeeEstimate,
} from '../../transactions/inscriptionMint';
import { getBtcPrivateKey } from '../../wallet';

vi.mock('../../api/xverseInscribe');
vi.mock('../../api/ordinals');
vi.mock('../../transactions/btc');
vi.mock('../../wallet');

describe('inscriptionMintFeeEstimate', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('calculates fee estimate correctly', async () => {
    vi.mocked(xverseInscribeApi.getInscriptionFeeEstimate).mockResolvedValue({
      chainFee: 1000,
      inscriptionValue: 1000,
      totalInscriptionValue: 1000,
      serviceFee: 2000,
      vSize: 100,
    });
    vi.mocked(selectUtxosForSend).mockReturnValue({
      fee: 1100,
      change: 1200,
      feeRate: 8,
      selectedUtxos: [
        {
          address: 'dummyAddress',
          status: { confirmed: true },
          txid: 'dummyTxId',
          vout: 0,
          value: 1000,
        },
      ],
    });

    const content = 'a'.repeat(400000);

    const result = await inscriptionMintFeeEstimate({
      addressUtxos: [
        {
          address: 'dummyAddress',
          status: { confirmed: true },
          txid: 'dummyTxId',
          vout: 0,
          value: 1000,
        },
      ],
      content,
      contentType: 'text/plain',
      feeRate: 8,
      revealAddress: 'dummyRevealAddress',
      finalInscriptionValue: 1000,
      serviceFee: 5000,
      serviceFeeAddress: 'dummyServiceFeeAddress',
      network: 'Mainnet',
    });

    expect(result.commitValue).toEqual(10100);
    expect(result.valueBreakdown).toEqual({
      commitChainFee: 1100,
      externalServiceFee: 5000,
      inscriptionValue: 1000,
      totalInscriptionValue: 1000,
      revealChainFee: 1000,
      revealServiceFee: 2000,
    });
  });

  it('calculates fee estimate correctly', async () => {
    vi.mocked(xverseInscribeApi.getInscriptionFeeEstimate).mockResolvedValue({
      chainFee: 1000,
      inscriptionValue: 546,
      totalInscriptionValue: 546,
      serviceFee: 2000,
      vSize: 100,
    });
    vi.mocked(selectUtxosForSend).mockReturnValue(undefined);

    const content = 'a'.repeat(400000);

    await expect(() =>
      inscriptionMintFeeEstimate({
        addressUtxos: [],
        content,
        contentType: 'text/plain',
        feeRate: 8,
        revealAddress: 'dummyRevealAddress',
        finalInscriptionValue: 1000,
        serviceFee: 5000,
        serviceFeeAddress: 'dummyServiceFeeAddress',
        network: 'Mainnet',
      }),
    ).rejects.toThrowCoreError('Not enough funds at selected fee rate', InscriptionErrorCode.INSUFFICIENT_FUNDS);
  });

  it.each([
    {
      serviceFeeAddress: 'dummyServiceFeeAddress',
    },
    {
      serviceFee: 5000,
    },
    {
      serviceFee: 500,
      serviceFeeAddress: 'dummyServiceFeeAddress',
    },
  ])('should fail on invalid service fee config: %s', async (config) => {
    await expect(() =>
      inscriptionMintFeeEstimate({
        addressUtxos: [
          {
            address: 'dummyAddress',
            status: { confirmed: true },
            txid: 'dummyTxId',
            vout: 0,
            value: 1000,
          },
        ],
        content: 'dummyContent',
        contentType: 'text/plain',
        feeRate: 8,
        revealAddress: 'dummyRevealAddress',
        finalInscriptionValue: 1000,
        network: 'Mainnet',
        ...config,
      }),
    ).rejects.toThrowCoreError(
      'Invalid service fee config, both serviceFee and serviceFeeAddress must be specified',
      InscriptionErrorCode.INVALID_SERVICE_FEE_CONFIG,
    );
  });

  it('should fail on invalid fee rate', async () => {
    await expect(() =>
      inscriptionMintFeeEstimate({
        addressUtxos: [
          {
            address: 'dummyAddress',
            status: { confirmed: true },
            txid: 'dummyTxId',
            vout: 0,
            value: 1000,
          },
        ],
        content: 'dummyContent',
        contentType: 'text/plain',
        feeRate: -1,
        revealAddress: 'dummyRevealAddress',
        finalInscriptionValue: 1000,
        network: 'Mainnet',
      }),
    ).rejects.toThrowCoreError('Fee rate should be a positive number', InscriptionErrorCode.INVALID_FEE_RATE);
  });

  it('should fail on big content', async () => {
    const content = 'a'.repeat(400001);

    await expect(() =>
      inscriptionMintFeeEstimate({
        addressUtxos: [
          {
            address: 'dummyAddress',
            status: { confirmed: true },
            txid: 'dummyTxId',
            vout: 0,
            value: 1000,
          },
        ],
        content: content,
        contentType: 'text/plain',
        feeRate: 8,
        revealAddress: 'dummyRevealAddress',
        finalInscriptionValue: 1000,
        network: 'Mainnet',
      }),
    ).rejects.toThrowCoreError('Content exceeds maximum size of 400000 bytes', InscriptionErrorCode.CONTENT_TOO_BIG);
  });

  it('should fail on low inscription value', async () => {
    await expect(() =>
      inscriptionMintFeeEstimate({
        addressUtxos: [
          {
            address: 'dummyAddress',
            status: { confirmed: true },
            txid: 'dummyTxId',
            vout: 0,
            value: 1000,
          },
        ],
        content: 'dummyContent',
        contentType: 'text/plain',
        feeRate: 8,
        revealAddress: 'dummyRevealAddress',
        finalInscriptionValue: 500,
        network: 'Mainnet',
      }),
    ).rejects.toThrowCoreError(
      'Inscription value cannot be less than 546',
      InscriptionErrorCode.INSCRIPTION_VALUE_TOO_LOW,
    );
  });
});

describe('inscriptionMintExecute', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('creates inscription order and executes correctly', async () => {
    vi.mocked(getBtcPrivateKey).mockResolvedValue('dummyPrivateKey');
    vi.mocked(xverseInscribeApi.createInscriptionOrder).mockResolvedValue({
      commitAddress: 'dummyCommitAddress',
      commitValue: 1000,
      commitValueBreakdown: {
        chainFee: 1000,
        inscriptionValue: 546,
        serviceFee: 2000,
      },
    });
    vi.mocked(selectUtxosForSend).mockReturnValue({
      fee: 1100,
      change: 1200,
      feeRate: 8,
      selectedUtxos: [
        {
          address: 'dummyAddress',
          status: { confirmed: true },
          txid: 'dummyTxId',
          vout: 0,
          value: 1000,
        },
      ],
    });
    vi.mocked(generateSignedBtcTransaction).mockResolvedValue({
      hex: 'dummyHex',
    } as any);
    vi.mocked(xverseInscribeApi.executeInscriptionOrder).mockResolvedValue({
      revealTransactionId: 'revealTxnId',
    } as any);
    vi.mocked(getOrdinalIdsFromUtxo).mockResolvedValue([]);

    const result = await inscriptionMintExecute({
      addressUtxos: [
        {
          address: 'dummyAddress',
          status: { confirmed: true },
          txid: 'dummyTxId',
          vout: 0,
          value: 1000,
        },
      ],
      contentString: 'dummyContent',
      contentType: 'text/plain',
      feeRate: 8,
      revealAddress: 'dummyRevealAddress',
      finalInscriptionValue: 1000,
      serviceFee: 5000,
      serviceFeeAddress: 'dummyServiceFeeAddress',
      accountIndex: 0,
      changeAddress: 'dummyChangeAddress',
      network: 'Mainnet',
      getSeedPhrase: async () => 'dummySeedPhrase',
    });

    expect(result).toBe('revealTxnId');
  });

  it('fails on no non-ordinal UTXOS', async () => {
    vi.mocked(getBtcPrivateKey).mockResolvedValue('dummyPrivateKey');
    vi.mocked(xverseInscribeApi.createInscriptionOrder).mockResolvedValue({
      commitAddress: 'dummyCommitAddress',
      commitValue: 1000,
      commitValueBreakdown: {
        chainFee: 1000,
        inscriptionValue: 546,
        serviceFee: 2000,
      },
    });
    vi.mocked(selectUtxosForSend).mockReturnValue({
      fee: 1100,
      change: 1200,
      feeRate: 8,
      selectedUtxos: [
        {
          address: 'dummyAddress',
          status: { confirmed: true },
          txid: 'dummyTxId',
          vout: 0,
          value: 1000,
        },
      ],
    });
    vi.mocked(generateSignedBtcTransaction).mockResolvedValue({
      hex: 'dummyHex',
    } as any);
    vi.mocked(xverseInscribeApi.executeInscriptionOrder).mockResolvedValue({
      revealTransactionId: 'revealTxnId',
    } as any);
    vi.mocked(getOrdinalIdsFromUtxo).mockResolvedValue(['ordinalId']);

    await expect(() =>
      inscriptionMintExecute({
        addressUtxos: [
          {
            address: 'dummyAddress',
            status: { confirmed: true },
            txid: 'dummyTxId',
            vout: 0,
            value: 1000,
          },
        ],
        contentString: 'dummyContent',
        contentType: 'text/plain',
        feeRate: 8,
        revealAddress: 'dummyRevealAddress',
        finalInscriptionValue: 1000,
        serviceFee: 5000,
        serviceFeeAddress: 'dummyServiceFeeAddress',
        accountIndex: 0,
        changeAddress: 'dummyChangeAddress',
        network: 'Mainnet',
        getSeedPhrase: async () => 'dummySeedPhrase',
      }),
    ).rejects.toThrowCoreError(
      'Must have at least one non-inscribed UTXO for inscription',
      InscriptionErrorCode.NO_NON_ORDINAL_UTXOS,
    );
  });

  it('should fail on no UTXOs', async () => {
    await expect(() =>
      inscriptionMintExecute({
        addressUtxos: [],
        contentString: 'dummyContent',
        contentType: 'text/plain',
        feeRate: 8,
        revealAddress: 'dummyRevealAddress',
        finalInscriptionValue: 1000,
        serviceFee: 5000,
        serviceFeeAddress: 'dummyServiceFeeAddress',
        accountIndex: 0,
        changeAddress: 'dummyChangeAddress',
        network: 'Mainnet',
        getSeedPhrase: async () => 'dummySeedPhrase',
      }),
    ).rejects.toThrowCoreError('No available UTXOs', InscriptionErrorCode.INSUFFICIENT_FUNDS);
  });

  it('should fail on low fee rate', async () => {
    await expect(() =>
      inscriptionMintExecute({
        addressUtxos: [
          {
            address: 'dummyAddress',
            status: { confirmed: true },
            txid: 'dummyTxId',
            vout: 0,
            value: 1000,
          },
        ],
        contentString: 'dummyContent',
        contentType: 'text/plain',
        feeRate: 0,
        revealAddress: 'dummyRevealAddress',
        finalInscriptionValue: 1000,
        serviceFee: 5000,
        serviceFeeAddress: 'dummyServiceFeeAddress',
        accountIndex: 0,
        changeAddress: 'dummyChangeAddress',
        network: 'Mainnet',
        getSeedPhrase: async () => 'dummySeedPhrase',
      }),
    ).rejects.toThrowCoreError('Fee rate should be a positive number', InscriptionErrorCode.INVALID_FEE_RATE);
  });

  it.each([
    {
      serviceFeeAddress: 'dummyServiceFeeAddress',
    },
    {
      serviceFee: 5000,
    },
    {
      serviceFee: 500,
      serviceFeeAddress: 'dummyServiceFeeAddress',
    },
  ])('should fail on invalid service fee config: %s', async (config) => {
    await expect(() =>
      inscriptionMintExecute({
        addressUtxos: [
          {
            address: 'dummyAddress',
            status: { confirmed: true },
            txid: 'dummyTxId',
            vout: 0,
            value: 1000,
          },
        ],
        contentString: 'dummyContent',
        contentType: 'text/plain',
        feeRate: 8,
        revealAddress: 'dummyRevealAddress',
        finalInscriptionValue: 1000,
        accountIndex: 0,
        changeAddress: 'dummyChangeAddress',
        network: 'Mainnet',
        getSeedPhrase: async () => 'dummySeedPhrase',
        ...config,
      }),
    ).rejects.toThrowCoreError(
      'Invalid service fee config, both serviceFee and serviceFeeAddress must be specified',
      InscriptionErrorCode.INVALID_SERVICE_FEE_CONFIG,
    );
  });

  it.each([
    {
      contentString: 'dummyContent',
      contentBase64: 'dummyContent',
    },
    {
      contentBase64: '',
    },
    {},
  ])('should fail on invalid content: %s', async (config) => {
    await expect(() =>
      inscriptionMintExecute({
        addressUtxos: [
          {
            address: 'dummyAddress',
            status: { confirmed: true },
            txid: 'dummyTxId',
            vout: 0,
            value: 1000,
          },
        ],
        contentType: 'text/plain',
        feeRate: 8,
        revealAddress: 'dummyRevealAddress',
        finalInscriptionValue: 1000,
        accountIndex: 0,
        changeAddress: 'dummyChangeAddress',
        network: 'Mainnet',
        getSeedPhrase: async () => 'dummySeedPhrase',
        ...config,
      }),
    ).rejects.toThrowCoreError(
      'Only contentString or contentBase64 can be specified, not both or neither, and should have content',
      InscriptionErrorCode.INVALID_CONTENT,
    );
  });

  it('should fail on large content', async () => {
    await expect(() =>
      inscriptionMintExecute({
        addressUtxos: [
          {
            address: 'dummyAddress',
            status: { confirmed: true },
            txid: 'dummyTxId',
            vout: 0,
            value: 1000,
          },
        ],
        contentString: 'a'.repeat(400001),
        contentType: 'text/plain',
        feeRate: 8,
        revealAddress: 'dummyRevealAddress',
        finalInscriptionValue: 1000,
        accountIndex: 0,
        changeAddress: 'dummyChangeAddress',
        network: 'Mainnet',
        getSeedPhrase: async () => 'dummySeedPhrase',
      }),
    ).rejects.toThrowCoreError(`Content exceeds maximum size of 400000 bytes`, InscriptionErrorCode.CONTENT_TOO_BIG);
  });
});
