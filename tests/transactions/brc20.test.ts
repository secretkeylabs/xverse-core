import * as btc from '@scure/btc-signer';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import xverseInscribeApi from '../../api/xverseInscribe';
import { ExtendedUtxo, TransactionContext } from '../../transactions/bitcoin';
import { AddressContext } from '../../transactions/bitcoin/context';
import { EnhancedTransaction } from '../../transactions/bitcoin/enhancedTransaction';
import {
  ExecuteTransferProgressCodes,
  brc20TransferEstimateFees,
  brc20TransferExecute,
} from '../../transactions/brc20';
import { addresses } from './bitcoin/helpers';

vi.mock('../../api/xverseInscribe');
vi.mock('../../api/esplora/esploraAPiProvider');
vi.mock('../../transactions/btc');
vi.mock('../../wallet');
vi.mock('../../transactions/bitcoin/enhancedTransaction');

describe('brc20TransferEstimateFees', () => {
  const ordinalsAddress = {
    constructUtxo: (utxo: any) => ({ utxo }),
    addInput: (tx: btc.Transaction, extendedUtxo: ExtendedUtxo) =>
      tx.addInput({
        txid: extendedUtxo.utxo.txid,
        index: extendedUtxo.utxo.vout,
        witnessUtxo: {
          amount: BigInt(extendedUtxo.utxo.value),
          script: addresses[0].taprootP2.script,
        },
        tapInternalKey: addresses[0].taprootP2.tapInternalKey,
      }),
  } as unknown as AddressContext;

  const context = {
    network: 'Mainnet',
    ordinalsAddress,
  } as TransactionContext;

  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('should estimate BRC20 transfer fees correctly', async () => {
    const mockedTick = 'TICK';
    const mockedAmount = 10;
    const mockedRevealAddress = 'bc1pyzfhlkq29sylwlv72ve52w8mn7hclefzhyay3dxh32r0322yx6uqajvr3y';
    const mockedFeeRate = 12;

    vi.mocked(xverseInscribeApi.getBrc20TransferFees).mockResolvedValue({
      chainFee: 1080,
      serviceFee: 2000,
      inscriptionValue: 1000,
      vSize: 150,
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
      commitValue: 1070 + 1080 + 2000 + 1332 + 1000,
      valueBreakdown: {
        commitChainFee: 1070,
        revealChainFee: 1080,
        revealServiceFee: 2000,
        transferChainFee: 1332,
        transferUtxoValue: 1000,
      },
    });

    expect(xverseInscribeApi.getBrc20TransferFees).toHaveBeenCalledWith(
      mockedTick,
      mockedAmount,
      mockedRevealAddress,
      mockedFeeRate,
      'Mainnet',
      2332,
      undefined,
    );
  });

  it('should estimate 5 byte BRC20 transfer fees correctly', async () => {
    const mockedTick = 'FR8NK';
    const mockedAmount = 10;
    const mockedRevealAddress = 'bc1pyzfhlkq29sylwlv72ve52w8mn7hclefzhyay3dxh32r0322yx6uqajvr3y';
    const mockedFeeRate = 12;

    vi.mocked(xverseInscribeApi.getBrc20TransferFees).mockResolvedValue({
      chainFee: 1080,
      serviceFee: 2000,
      inscriptionValue: 1000,
      vSize: 150,
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
      commitValue: 1070 + 1080 + 2000 + 1332 + 1000,
      valueBreakdown: {
        commitChainFee: 1070,
        revealChainFee: 1080,
        revealServiceFee: 2000,
        transferChainFee: 1332,
        transferUtxoValue: 1000,
      },
    });

    expect(xverseInscribeApi.getBrc20TransferFees).toHaveBeenCalledWith(
      mockedTick,
      mockedAmount,
      mockedRevealAddress,
      mockedFeeRate,
      'Mainnet',
      2332,
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
      constructUtxo: (utxo: any) => ({ utxo }),
      addInput: (tx: btc.Transaction, extendedUtxo: ExtendedUtxo) =>
        tx.addInput({
          txid: extendedUtxo.utxo.txid,
          index: extendedUtxo.utxo.vout,
          witnessUtxo: {
            amount: BigInt(extendedUtxo.utxo.value),
            script: addresses[0].taprootP2.script,
          },
          tapInternalKey: addresses[0].taprootP2.tapInternalKey,
        }),
    } as any,
    addOutputAddress: (tx: btc.Transaction, recipient: string, amount: bigint) =>
      tx.addOutputAddress(recipient, amount),
    signTransaction: (tx: btc.Transaction) => tx.sign(addresses[0].taprootSigner),
    network: 'Mainnet',
  } as unknown as TransactionContext;

  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('should execute BRC20 transfer correctly', async () => {
    const mockedTick = 'TICK';
    const mockedAmount = 10;
    const mockedRevealAddress = addresses[0].taproot;
    const mockedCommitAddress = addresses[1].taproot;
    const mockedRecipientAddress = addresses[2].taproot;
    const mockedFeeRate = 12;

    vi.mocked(xverseInscribeApi.createBrc20TransferOrder).mockResolvedValueOnce({
      commitAddress: mockedCommitAddress,
      commitValue: 1000,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- we only use these 2 fields in this function
    } as any);

    const mockedRevealTxnId = '0000000000000000000000000000000000000000000000000000000000000002';
    const mockedCommitTxnId = '0000000000000000000000000000000000000000000000000000000000000002';
    const mockedTransferTxnId = '0000000000000000000000000000000000000000000000000000000000000002';
    vi.mocked(xverseInscribeApi.executeBrc20Order).mockResolvedValueOnce({
      revealTransactionId: mockedRevealTxnId,
      revealUTXOVOut: 0,
      revealUTXOValue: 3000,
    });

    vi.mocked(xverseInscribeApi.finalizeBrc20TransferOrder).mockResolvedValueOnce({
      revealTransactionId: mockedRevealTxnId,
      commitTransactionId: mockedCommitTxnId,
      transferTransactionId: mockedTransferTxnId,
    });

    const getTransactionHexAndId = vi.fn().mockResolvedValueOnce({ hex: 'commit_hex', txid: mockedCommitTxnId });
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
          expect(xverseInscribeApi.createBrc20TransferOrder).toHaveBeenCalledWith(
            mockedTick,
            mockedAmount,
            mockedRevealAddress,
            mockedFeeRate,
            'Mainnet',
            1000 + 111 * mockedFeeRate,
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
      revealTransactionId: mockedRevealTxnId,
      commitTransactionId: mockedCommitTxnId,
      transferTransactionId: mockedTransferTxnId,
    });
  });
});
