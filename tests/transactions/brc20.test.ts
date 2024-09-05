import BigNumber from 'bignumber.js';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import xverseInscribeApi from '../../api/xverseInscribe';
import { TransactionContext } from '../../transactions/bitcoin';
import { EnhancedTransaction } from '../../transactions/bitcoin/enhancedTransaction';
import {
  ExecuteTransferProgressCodes,
  brc20TransferEstimateFees,
  brc20TransferExecute,
} from '../../transactions/brc20';
import { selectUtxosForSend, signNonOrdinalBtcSendTransaction } from '../../transactions/btc';

vi.mock('../../api/xverseInscribe');
vi.mock('../../api/esplora/esploraAPiProvider');
vi.mock('../../transactions/btc');
vi.mock('../../wallet');
vi.mock('../../transactions/bitcoin/enhancedTransaction');

describe('brc20TransferEstimateFees', () => {
  const context = {
    network: 'Mainnet',
  } as TransactionContext;

  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('should estimate BRC20 transfer fees correctly', async () => {
    const mockedTick = 'TICK';
    const mockedAmount = 10;
    const mockedRevealAddress = 'bc1pyzfhlkq29sylwlv72ve52w8mn7hclefzhyay3dxh32r0322yx6uqajvr3y';
    const mockedFeeRate = 12;

    vi.mocked(signNonOrdinalBtcSendTransaction).mockResolvedValueOnce({
      tx: { vsize: 150 },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- we only use this field in this function
    } as any);

    vi.mocked(xverseInscribeApi.getBrc20TransferFees).mockResolvedValue({
      chainFee: 1080,
      serviceFee: 2000,
      inscriptionValue: 1000,
      vSize: 150,
    });

    vi.mocked(selectUtxosForSend).mockReturnValueOnce({
      change: 2070,
      fee: 1070,
      feeRate: 12,
      selectedUtxos: [],
    });

    vi.mocked(EnhancedTransaction).mockImplementationOnce(
      () =>
        ({
          getSummary: async () =>
            ({
              fee: 1070,
            } as any),
        } as any),
    );

    const result = await brc20TransferEstimateFees(
      {
        tick: mockedTick,
        amount: mockedAmount,
        revealAddress: mockedRevealAddress,
        feeRate: mockedFeeRate,
      },
      context,
    );

    expect(result).toEqual({
      commitValue: 1070 + 1080 + 2000 + 1800 + 1000,
      valueBreakdown: {
        commitChainFee: 1070,
        revealChainFee: 1080,
        revealServiceFee: 2000,
        transferChainFee: 1800,
        transferUtxoValue: 1000,
      },
    });

    expect(xverseInscribeApi.getBrc20TransferFees).toHaveBeenCalledWith(
      mockedTick,
      mockedAmount,
      mockedRevealAddress,
      mockedFeeRate,
      'Mainnet',
      2800,
      undefined,
    );
  });

  it('should estimate 5 byte BRC20 transfer fees correctly', async () => {
    const mockedTick = 'FR8NK';
    const mockedAmount = 10;
    const mockedRevealAddress = 'bc1pyzfhlkq29sylwlv72ve52w8mn7hclefzhyay3dxh32r0322yx6uqajvr3y';
    const mockedFeeRate = 12;

    vi.mocked(signNonOrdinalBtcSendTransaction).mockResolvedValueOnce({
      tx: { vsize: 150 },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- we only use this field in this function
    } as any);

    vi.mocked(xverseInscribeApi.getBrc20TransferFees).mockResolvedValue({
      chainFee: 1080,
      serviceFee: 2000,
      inscriptionValue: 1000,
      vSize: 150,
    });

    vi.mocked(selectUtxosForSend).mockReturnValueOnce({
      change: 2070,
      fee: 1070,
      feeRate: 12,
      selectedUtxos: [],
    });

    vi.mocked(EnhancedTransaction).mockImplementationOnce(
      () =>
        ({
          getSummary: async () =>
            ({
              fee: 1070,
            } as any),
        } as any),
    );

    const result = await brc20TransferEstimateFees(
      {
        tick: mockedTick,
        amount: mockedAmount,
        revealAddress: mockedRevealAddress,
        feeRate: mockedFeeRate,
      },
      context,
    );

    expect(result).toEqual({
      commitValue: 1070 + 1080 + 2000 + 1800 + 1000,
      valueBreakdown: {
        commitChainFee: 1070,
        revealChainFee: 1080,
        revealServiceFee: 2000,
        transferChainFee: 1800,
        transferUtxoValue: 1000,
      },
    });

    expect(xverseInscribeApi.getBrc20TransferFees).toHaveBeenCalledWith(
      mockedTick,
      mockedAmount,
      mockedRevealAddress,
      mockedFeeRate,
      'Mainnet',
      2800,
      undefined,
    );
  });

  it('should throw on invalid tick', async () => {
    const mockedTick = 'TICKss';
    const mockedAmount = 10;
    const mockedRevealAddress = 'bc1pyzfhlkq29sylwlv72ve52w8mn7hclefzhyay3dxh32r0322yx6uqajvr3y';
    const mockedFeeRate = 12;

    await expect(() =>
      brc20TransferEstimateFees(
        {
          tick: mockedTick,
          amount: mockedAmount,
          revealAddress: mockedRevealAddress,
          feeRate: mockedFeeRate,
        },
        context,
      ),
    ).rejects.toThrow('Invalid tick; should be 4 or 5 bytes long');
  });

  it('should throw on invalid amount', async () => {
    const mockedTick = 'TICK';
    const mockedAmount = 0;
    const mockedRevealAddress = 'bc1pyzfhlkq29sylwlv72ve52w8mn7hclefzhyay3dxh32r0322yx6uqajvr3y';
    const mockedFeeRate = 12;

    await expect(() =>
      brc20TransferEstimateFees(
        {
          tick: mockedTick,
          amount: mockedAmount,
          revealAddress: mockedRevealAddress,
          feeRate: mockedFeeRate,
        },
        context,
      ),
    ).rejects.toThrow('Amount should be positive');
  });

  it('should throw on invalid fee rate', async () => {
    const mockedTick = 'TICK';
    const mockedAmount = 10;
    const mockedRevealAddress = 'bc1pyzfhlkq29sylwlv72ve52w8mn7hclefzhyay3dxh32r0322yx6uqajvr3y';
    const mockedFeeRate = 0;

    await expect(() =>
      brc20TransferEstimateFees(
        {
          tick: mockedTick,
          amount: mockedAmount,
          revealAddress: mockedRevealAddress,
          feeRate: mockedFeeRate,
        },
        context,
      ),
    ).rejects.toThrow('Fee rate should be positive');
  });
});

describe('brc20TransferExecute', () => {
  const context = {
    ordinalsAddress: {
      constructUtxo: vi.fn(),
      addInput: vi.fn(),
    } as any,
    addOutputAddress: vi.fn() as any,
    signTransaction: vi.fn() as any,
    network: 'Mainnet',
  } as TransactionContext;

  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('should execute BRC20 transfer correctly', async () => {
    const mockedTick = 'TICK';
    const mockedAmount = 10;
    const mockedRevealAddress = 'reveal_address';
    const mockedCommitAddress = 'commit_address';
    const mockedRecipientAddress = 'recipient_address';
    const mockedFeeRate = 12;

    vi.mocked(signNonOrdinalBtcSendTransaction).mockResolvedValue({
      tx: { vsize: 150 },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- we only use this field in this function
    } as any);

    vi.mocked(xverseInscribeApi.createBrc20TransferOrder).mockResolvedValueOnce({
      commitAddress: mockedCommitAddress,
      commitValue: 1000,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- we only use these 2 fields in this function
    } as any);

    vi.mocked(xverseInscribeApi.executeBrc20Order).mockResolvedValueOnce({
      revealTransactionId: 'revealId',
      revealUTXOVOut: 0,
      revealUTXOValue: 3000,
    });

    vi.mocked(xverseInscribeApi.finalizeBrc20TransferOrder).mockResolvedValueOnce({
      revealTransactionId: 'revealId',
      commitTransactionId: 'commitId',
      transferTransactionId: 'transferId',
    });

    const getTransactionHexAndId = vi.fn().mockResolvedValueOnce({ hex: 'commit_hex', txid: 'commit_id' });
    vi.mocked(EnhancedTransaction).mockImplementationOnce(
      () =>
        ({
          getSummary: async () =>
            ({
              fee: 1070,
            } as any),
          getTransactionHexAndId,
        } as any),
    );

    // Execute the generator function
    const generator = brc20TransferExecute(
      {
        tick: mockedTick,
        amount: mockedAmount,
        revealAddress: mockedRevealAddress,
        recipientAddress: mockedRecipientAddress,
        feeRate: mockedFeeRate,
      },
      context,
      {},
    );

    let result;
    let done;

    // Iterate through the generator function until it's done
    do {
      ({ value: result, done } = await generator.next());

      // Assert the progress and result based on the current value
      switch (result) {
        case ExecuteTransferProgressCodes.CreatingInscriptionOrder:
          break;

        case ExecuteTransferProgressCodes.CreatingCommitTransaction:
          expect(signNonOrdinalBtcSendTransaction).toHaveBeenCalledTimes(1);
          expect(signNonOrdinalBtcSendTransaction).toHaveBeenCalledWith(
            mockedRecipientAddress,
            [
              {
                address: mockedRevealAddress,
                status: { confirmed: false },
                txid: '0000000000000000000000000000000000000000000000000000000000000001',
                vout: 0,
                value: 1000,
              },
            ],
            0,
            'action action action action action action action action action action action action',
            'Mainnet',
            new BigNumber(1000),
          );

          expect(xverseInscribeApi.createBrc20TransferOrder).toHaveBeenCalledWith(
            mockedTick,
            mockedAmount,
            mockedRevealAddress,
            mockedFeeRate,
            'Mainnet',
            1000 + 150 * mockedFeeRate,
          );
          break;

        case ExecuteTransferProgressCodes.ExecutingInscriptionOrder:
          expect(getTransactionHexAndId).toHaveBeenCalled();
          break;

        case ExecuteTransferProgressCodes.CreatingTransferTransaction:
          expect(xverseInscribeApi.executeBrc20Order).toHaveBeenCalledWith(
            'Mainnet',
            mockedCommitAddress,
            'commit_hex',
            true,
          );
          break;

        case ExecuteTransferProgressCodes.Finalizing:
          break;
        default:
          break;
      }
    } while (!done);

    expect(result).toEqual({
      revealTransactionId: 'revealId',
      commitTransactionId: 'commitId',
      transferTransactionId: 'transferId',
    });
  });
});
