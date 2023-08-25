import { beforeEach, describe, expect, it, vi } from 'vitest';

import xverseInscribeApi from '../../api/xverseInscribe';
import { generateSignedBtcTransaction, selectUtxosForSend } from '../../transactions/btc';
import {
  InscriptionErrorCode,
  inscriptionMintExecute,
  inscriptionMintFeeEstimate,
} from '../../transactions/inscriptionMint';
import { getBtcPrivateKey } from '../../wallet';

vi.mock('../../api/xverseInscribe');
vi.mock('../../transactions/btc');
vi.mock('../../wallet');

describe('inscriptionMintFeeEstimate', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('calculates fee estimate correctly', async () => {
    vi.mocked(xverseInscribeApi.getInscriptionFeeEstimate).mockResolvedValue({
      chainFee: 1000,
      inscriptionValue: 546,
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
      content: 'dummyContent',
      contentType: 'text/plain',
      feeRate: 8,
      revealAddress: 'dummyRevealAddress',
      finalInscriptionValue: 1000,
      serviceFee: 5000,
      serviceFeeAddress: 'dummyServiceFeeAddress',
    });

    expect(result.commitValue).toEqual(10100);
    expect(result.valueBreakdown).toEqual({
      commitChainFee: 1100,
      externalServiceFee: 5000,
      inscriptionValue: 1000,
      revealChainFee: 1000,
      revealServiceFee: 2000,
    });
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
        ...config,
      }),
    ).rejects.toThrowCoreError(
      'Invalid service fee config, both serviceFee and serviceFeeAddress must be specified',
      InscriptionErrorCode.INVALID_SERVICE_FEE_CONFIG,
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
      serviceFee: 50,
      serviceFeeAddress: 'dummyServiceFeeAddress',
      accountIndex: 0,
      changeAddress: 'dummyChangeAddress',
      network: 'Mainnet',
      seedPhrase: 'dummySeedPhrase',
    });

    expect(result).toBe('revealTxnId');
  });
});
