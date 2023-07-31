import { beforeEach, describe, expect, it, vi } from 'vitest';

import { UTXO } from 'types';
import BitcoinEsploraApiProvider from '../../api/esplora/esploraAPiProvider';
import xverseInscribeApi from '../../api/xverseInscribe';
import {
  generateSignedBtcTransaction,
  selectUtxosForSend,
  signNonOrdinalBtcSendTransaction,
} from '../../transactions/btc';
import { getBtcPrivateKey } from '../../wallet';

import BigNumber from 'bignumber.js';
import {
  brc20TransferEstimateFees,
  brc20TransferExecute,
  ExecuteTransferProgressCodes,
} from '../../transactions/brc20';

vi.mock('../../api/xverseInscribe');
vi.mock('../../api/esplora/esploraAPiProvider');
vi.mock('../../transactions/btc');
vi.mock('../../wallet');

describe('brc20TransferEstimateFees', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('should estimate BRC20 transfer fees correctly', async () => {
    // Mock the dependencies or external modules if necessary
    const mockedAddressUtxos: UTXO[] = [];
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

    const result = await brc20TransferEstimateFees(
      mockedAddressUtxos,
      mockedTick,
      mockedAmount,
      mockedRevealAddress,
      mockedFeeRate,
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
      2800,
    );

    expect(selectUtxosForSend).toHaveBeenCalledWith(
      'bc1pgkwmp9u9nel8c36a2t7jwkpq0hmlhmm8gm00kpdxdy864ew2l6zqw2l6vh',
      [{ address: mockedRevealAddress, amountSats: new BigNumber(5880) }],
      mockedAddressUtxos,
      mockedFeeRate,
    );
  });
});

describe('brc20TransferExecute', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('should execute BRC20 transfer correctly', async () => {
    // Mock the dependencies or external modules if necessary
    const mockedSeedPhrase = 'seed_phrase';
    const mockedAccountIndex = 0;
    const mockedAddressUtxos: UTXO[] = [];
    const mockedTick = 'TICK';
    const mockedAmount = 10;
    const mockedRevealAddress = 'reveal_address';
    const mockedChangeAddress = 'change_address';
    const mockedRecipientAddress = 'recipient_address';
    const mockedFeeRate = 12;
    const mockedNetwork = 'Mainnet';

    vi.mocked(getBtcPrivateKey).mockResolvedValueOnce('private_key');

    vi.mocked(signNonOrdinalBtcSendTransaction).mockResolvedValue({
      tx: { vsize: 150 },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- we only use this field in this function
    } as any);

    vi.mocked(xverseInscribeApi.createBrc20TransferOrder).mockResolvedValueOnce({
      commitAddress: 'commit_address',
      commitValue: 1000,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- we only use these 2 fields in this function
    } as any);

    const mockedSelectedUtxos: UTXO[] = [];
    vi.mocked(selectUtxosForSend).mockReturnValueOnce({
      change: 2070,
      fee: 1070,
      feeRate: mockedFeeRate,
      selectedUtxos: mockedSelectedUtxos,
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- only use the one field in this method
    vi.mocked(generateSignedBtcTransaction).mockResolvedValueOnce({ hex: 'commit_hex' } as any);

    vi.mocked(xverseInscribeApi.executeBrc20Order).mockResolvedValueOnce({
      revealTransactionId: 'revealId',
      revealUTXOVOut: 0,
      revealUTXOValue: 3000,
    });

    vi.mocked(BitcoinEsploraApiProvider).mockImplementation(
      () =>
        ({
          sendRawTransaction: vi.fn().mockResolvedValueOnce({ tx: { hash: 'tx_hash' } }),
        } as any),
    );

    // Execute the generator function
    const generator = brc20TransferExecute(
      mockedSeedPhrase,
      mockedAccountIndex,
      mockedAddressUtxos,
      mockedTick,
      mockedAmount,
      mockedRevealAddress,
      mockedChangeAddress,
      mockedRecipientAddress,
      mockedFeeRate,
      mockedNetwork,
    );

    let result;
    let done;

    // Iterate through the generator function until it's done
    do {
      ({ value: result, done } = await generator.next());

      // Assert the progress and result based on the current value
      switch (result) {
        case ExecuteTransferProgressCodes.CreatingInscriptionOrder:
          expect(getBtcPrivateKey).toHaveBeenCalledWith(
            expect.objectContaining({
              seedPhrase: mockedSeedPhrase,
              index: BigInt(mockedAccountIndex),
              network: 'Mainnet',
            }),
          );
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
            mockedSeedPhrase,
            'Mainnet',
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
          expect(selectUtxosForSend).toHaveBeenCalledWith(
            mockedChangeAddress,
            [{ address: mockedRevealAddress, amountSats: new BigNumber(1000) }],
            mockedAddressUtxos,
            mockedFeeRate,
          );

          expect(generateSignedBtcTransaction).toHaveBeenCalledWith(
            'private_key',
            mockedSelectedUtxos,
            new BigNumber(1000),
            [
              {
                address: 'commit_address',
                amountSats: new BigNumber(1000),
              },
            ],
            mockedChangeAddress,
            new BigNumber(1070),
            'Mainnet',
          );
          break;

        case ExecuteTransferProgressCodes.CreatingTransferTransaction:
          expect(xverseInscribeApi.executeBrc20Order).toHaveBeenCalledWith('commit_address', 'commit_hex');
          break;

        case ExecuteTransferProgressCodes.Finalizing:
          expect(signNonOrdinalBtcSendTransaction).toHaveBeenCalledTimes(2);
          expect(signNonOrdinalBtcSendTransaction).toHaveBeenLastCalledWith(
            mockedRecipientAddress,
            [
              {
                address: mockedRevealAddress,
                status: { confirmed: false },
                txid: 'revealId',
                vout: 0,
                value: 3000,
              },
            ],
            0,
            mockedSeedPhrase,
            'Mainnet',
            new BigNumber(1800),
          );

          break;
        default:
          break;
      }
    } while (!done);

    expect(result).toEqual('tx_hash');
  });
});
