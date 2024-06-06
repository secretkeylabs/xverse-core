import { beforeEach, describe, expect, it, vi } from 'vitest';

import { getOrdinalIdsFromUtxo } from '../../api/ordinals';
import xverseInscribeApi from '../../api/xverseInscribe';
import { TransactionContext } from '../../transactions/bitcoin';
import { EnhancedTransaction } from '../../transactions/bitcoin/enhancedTransaction';
import {
  InscriptionErrorCode,
  inscriptionMintExecute,
  inscriptionMintFeeEstimate,
} from '../../transactions/inscriptionMint';

vi.mock('../../api/xverseInscribe');
vi.mock('../../api/ordinals');
vi.mock('../../transactions/btc');
vi.mock('../../transactions/bitcoin/enhancedTransaction');

describe('inscriptionMintFeeEstimate', () => {
  const context = {
    network: 'Mainnet',
  } as TransactionContext;

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

    vi.mocked(EnhancedTransaction).mockImplementationOnce(
      () =>
        ({
          getSummary: async () =>
            ({
              fee: 1100,
            } as any),
        } as any),
    );

    const content = 'a'.repeat(400000);

    const result = await inscriptionMintFeeEstimate(
      {
        content,
        contentType: 'text/plain',
        feeRate: 8,
        revealAddress: 'dummyRevealAddress',
        finalInscriptionValue: 1000,
        serviceFee: 5000,
        serviceFeeAddress: 'dummyServiceFeeAddress',
      },
      context,
    );

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

    vi.mocked(EnhancedTransaction).mockImplementationOnce(
      () =>
        ({
          getSummary: async () => {
            throw new Error('Insufficient funds');
          },
        } as any),
    );

    const content = 'a'.repeat(400000);

    await expect(() =>
      inscriptionMintFeeEstimate(
        {
          content,
          contentType: 'text/plain',
          feeRate: 8,
          revealAddress: 'dummyRevealAddress',
          finalInscriptionValue: 1000,
          serviceFee: 5000,
          serviceFeeAddress: 'dummyServiceFeeAddress',
        },
        context,
      ),
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
      inscriptionMintFeeEstimate(
        {
          content: 'dummyContent',
          contentType: 'text/plain',
          feeRate: 8,
          revealAddress: 'dummyRevealAddress',
          finalInscriptionValue: 1000,
          ...config,
        },
        context,
      ),
    ).rejects.toThrowCoreError(
      'Invalid service fee config, both serviceFee and serviceFeeAddress must be specified',
      InscriptionErrorCode.INVALID_SERVICE_FEE_CONFIG,
    );
  });

  it('should fail on invalid fee rate', async () => {
    await expect(() =>
      inscriptionMintFeeEstimate(
        {
          content: 'dummyContent',
          contentType: 'text/plain',
          feeRate: -1,
          revealAddress: 'dummyRevealAddress',
          finalInscriptionValue: 1000,
        },
        context,
      ),
    ).rejects.toThrowCoreError('Fee rate should be a positive number', InscriptionErrorCode.INVALID_FEE_RATE);
  });

  it('should fail on big content', async () => {
    const content = 'a'.repeat(400001);

    await expect(() =>
      inscriptionMintFeeEstimate(
        {
          content: content,
          contentType: 'text/plain',
          feeRate: 8,
          revealAddress: 'dummyRevealAddress',
          finalInscriptionValue: 1000,
        },
        context,
      ),
    ).rejects.toThrowCoreError('Content exceeds maximum size of 400000 bytes', InscriptionErrorCode.CONTENT_TOO_BIG);
  });

  it('should fail on low inscription value', async () => {
    await expect(() =>
      inscriptionMintFeeEstimate(
        {
          content: 'dummyContent',
          contentType: 'text/plain',
          feeRate: 8,
          revealAddress: 'dummyRevealAddress',
          finalInscriptionValue: 500,
        },
        context,
      ),
    ).rejects.toThrowCoreError(
      'Inscription value cannot be less than 546',
      InscriptionErrorCode.INSCRIPTION_VALUE_TOO_LOW,
    );
  });
});

describe('inscriptionMintExecute', () => {
  const context = {
    paymentAddress: {
      getUtxos: vi.fn(),
    } as any,
    network: 'Mainnet',
  } as TransactionContext;

  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('creates inscription order and executes correctly', async () => {
    vi.mocked(context.paymentAddress.getUtxos).mockResolvedValue([
      {
        utxo: {
          value: 1000000,
        },
        outpoint: 'dummyOutpoint',
        getBundleData: vi.fn().mockResolvedValue({
          block_height: 1,
          sat_ranges: [
            {
              offset: 0,
              inscriptions: [
                {
                  id: 'dummyId',
                  content_type: 'text/plain',
                  inscription_number: 1,
                },
              ],
            },
          ],
        }),
      } as any,
      {
        utxo: {
          value: 100000,
        },
        outpoint: 'dummyOutpoint2',
        getBundleData: vi.fn().mockResolvedValue({
          block_height: 1,
          sat_ranges: [
            {
              offset: 1,
              inscriptions: [
                {
                  id: 'dummyId2',
                  content_type: 'text/plain',
                  inscription_number: 2,
                },
              ],
            },
          ],
        }),
      } as any,
    ]);

    vi.mocked(xverseInscribeApi.createInscriptionOrder).mockResolvedValue({
      commitAddress: 'dummyCommitAddress',
      commitValue: 1000,
      commitValueBreakdown: {
        chainFee: 1000,
        inscriptionValue: 546,
        totalInscriptionValue: 546,
        serviceFee: 2000,
      },
    });

    vi.mocked(EnhancedTransaction).mockImplementationOnce(
      () =>
        ({
          getTransactionHexAndId: async () =>
            ({
              hex: 'CommitHex',
            } as any),
        } as any),
    );

    vi.mocked(xverseInscribeApi.executeInscriptionOrder).mockResolvedValue({
      revealTransactionId: 'revealTxnId',
    } as any);
    vi.mocked(getOrdinalIdsFromUtxo).mockResolvedValue([]);

    const result = await inscriptionMintExecute(
      {
        contentString: 'dummyContent',
        contentType: 'text/plain',
        feeRate: 8,
        revealAddress: 'dummyRevealAddress',
        finalInscriptionValue: 1000,
        serviceFee: 5000,
        serviceFeeAddress: 'dummyServiceFeeAddress',
      },
      context,
    );

    expect(result).toBe('revealTxnId');
    expect(EnhancedTransaction).toHaveBeenCalledWith(
      context,
      [
        {
          amount: 1000n,
          combinable: true,
          toAddress: 'dummyCommitAddress',
          type: 'sendBtc',
        },
        {
          amount: 5000n,
          combinable: true,
          toAddress: 'dummyServiceFeeAddress',
          type: 'sendBtc',
        },
      ],
      8,
      {
        forceIncludeOutpointList: ['dummyOutpoint2'],
      },
    );
  });

  it('fails on no non-ordinal UTXOS', async () => {
    vi.mocked(context.paymentAddress.getUtxos).mockResolvedValue([
      {
        getBundleData: vi.fn().mockResolvedValue({
          block_height: 1,
          sat_ranges: [
            {
              offset: 0,
              inscriptions: [
                {
                  id: 'dummyId',
                  content_type: 'text/plain',
                  inscription_number: 1,
                },
              ],
            },
          ],
        }),
      } as any,
    ]);

    await expect(() =>
      inscriptionMintExecute(
        {
          contentString: 'dummyContent',
          contentType: 'text/plain',
          feeRate: 8,
          revealAddress: 'dummyRevealAddress',
          finalInscriptionValue: 1000,
          serviceFee: 5000,
          serviceFeeAddress: 'dummyServiceFeeAddress',
        },
        context,
      ),
    ).rejects.toThrowCoreError(
      'Must have at least one non-inscribed UTXO for inscription',
      InscriptionErrorCode.NO_NON_ORDINAL_UTXOS,
    );
  });

  it('should fail on no UTXOs', async () => {
    vi.mocked(context.paymentAddress.getUtxos).mockResolvedValue([]);

    await expect(() =>
      inscriptionMintExecute(
        {
          contentString: 'dummyContent',
          contentType: 'text/plain',
          feeRate: 8,
          revealAddress: 'dummyRevealAddress',
          finalInscriptionValue: 1000,
          serviceFee: 5000,
          serviceFeeAddress: 'dummyServiceFeeAddress',
        },
        context,
      ),
    ).rejects.toThrowCoreError('No available UTXOs', InscriptionErrorCode.INSUFFICIENT_FUNDS);
  });

  it('should fail on low fee rate', async () => {
    await expect(() =>
      inscriptionMintExecute(
        {
          contentString: 'dummyContent',
          contentType: 'text/plain',
          feeRate: 0,
          revealAddress: 'dummyRevealAddress',
          finalInscriptionValue: 1000,
          serviceFee: 5000,
          serviceFeeAddress: 'dummyServiceFeeAddress',
        },
        context,
      ),
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
      inscriptionMintExecute(
        {
          contentString: 'dummyContent',
          contentType: 'text/plain',
          feeRate: 8,
          revealAddress: 'dummyRevealAddress',
          finalInscriptionValue: 1000,
          ...config,
        },
        context,
      ),
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
      inscriptionMintExecute(
        {
          contentType: 'text/plain',
          feeRate: 8,
          revealAddress: 'dummyRevealAddress',
          finalInscriptionValue: 1000,
          ...config,
        },
        context,
      ),
    ).rejects.toThrowCoreError(
      'Only contentString or contentBase64 can be specified, not both or neither, and should have content',
      InscriptionErrorCode.INVALID_CONTENT,
    );
  });

  it('should fail on large content', async () => {
    await expect(() =>
      inscriptionMintExecute(
        {
          contentString: 'a'.repeat(400001),
          contentType: 'text/plain',
          feeRate: 8,
          revealAddress: 'dummyRevealAddress',
          finalInscriptionValue: 1000,
        },
        context,
      ),
    ).rejects.toThrowCoreError(`Content exceeds maximum size of 400000 bytes`, InscriptionErrorCode.CONTENT_TOO_BIG);
  });
});
