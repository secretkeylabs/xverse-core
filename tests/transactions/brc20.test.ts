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
  brc20MintEstimateFees,
  brc20MintExecute,
  brc20TransferEstimateFees,
  brc20TransferExecute,
  ExecuteTransferProgressCodes,
} from '../../transactions/brc20';

vi.mock('../../api/xverseInscribe');
vi.mock('../../api/esplora/esploraAPiProvider');
vi.mock('../../transactions/btc');
vi.mock('../../wallet');

describe('brc20MintEstimateFees', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('should estimate BRC20 mint fees correctly', async () => {
    const mockedAddressUtxos: UTXO[] = [
      { txid: 'txid', vout: 0, value: 1000, status: { confirmed: true }, address: 'address' },
    ];
    const mockedTick = 'TICK';
    const mockedAmount = 10;
    const mockedRevealAddress = 'bc1pyzfhlkq29sylwlv72ve52w8mn7hclefzhyay3dxh32r0322yx6uqajvr3y';
    const mockedFeeRate = 12;

    vi.mocked(xverseInscribeApi.getBrc20MintFees).mockResolvedValue({
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

    const result = await brc20MintEstimateFees({
      addressUtxos: mockedAddressUtxos,
      tick: mockedTick,
      amount: mockedAmount,
      revealAddress: mockedRevealAddress,
      feeRate: mockedFeeRate,
    });

    expect(result).toEqual({
      commitValue: 1070 + 1080 + 2000 + 1000,
      valueBreakdown: {
        commitChainFee: 1070,
        revealChainFee: 1080,
        revealServiceFee: 2000,
        inscriptionValue: 1000,
      },
    });

    expect(xverseInscribeApi.getBrc20MintFees).toHaveBeenCalledWith(
      mockedTick,
      mockedAmount,
      mockedRevealAddress,
      mockedFeeRate,
      1000,
    );

    expect(selectUtxosForSend).toHaveBeenCalledWith({
      changeAddress: 'bc1pgkwmp9u9nel8c36a2t7jwkpq0hmlhmm8gm00kpdxdy864ew2l6zqw2l6vh',
      recipients: [{ address: mockedRevealAddress, amountSats: new BigNumber(4080) }],
      availableUtxos: mockedAddressUtxos,
      feeRate: mockedFeeRate,
    });
  });

  it('should throw on undefined UTXOs', async () => {
    const mockedTick = 'TICK';
    const mockedAmount = 10;
    const mockedRevealAddress = 'bc1pyzfhlkq29sylwlv72ve52w8mn7hclefzhyay3dxh32r0322yx6uqajvr3y';
    const mockedFeeRate = 12;

    await expect(() =>
      brc20MintEstimateFees({
        addressUtxos: undefined,
        tick: mockedTick,
        amount: mockedAmount,
        revealAddress: mockedRevealAddress,
        feeRate: mockedFeeRate,
      }),
    ).rejects.toThrow('UTXOs empty');
  });

  it('should throw on empty UTXOs', async () => {
    const mockedAddressUtxos: UTXO[] = [];
    const mockedTick = 'TICK';
    const mockedAmount = 10;
    const mockedRevealAddress = 'bc1pyzfhlkq29sylwlv72ve52w8mn7hclefzhyay3dxh32r0322yx6uqajvr3y';
    const mockedFeeRate = 12;

    await expect(() =>
      brc20MintEstimateFees({
        addressUtxos: mockedAddressUtxos,
        tick: mockedTick,
        amount: mockedAmount,
        revealAddress: mockedRevealAddress,
        feeRate: mockedFeeRate,
      }),
    ).rejects.toThrow('Insufficient funds, no UTXOs found');
  });

  it('should throw on invalid tick', async () => {
    const mockedAddressUtxos: UTXO[] = [
      { txid: 'txid', vout: 0, value: 1000, status: { confirmed: true }, address: 'address' },
    ];
    const mockedTick = 'TICKs';
    const mockedAmount = 10;
    const mockedRevealAddress = 'bc1pyzfhlkq29sylwlv72ve52w8mn7hclefzhyay3dxh32r0322yx6uqajvr3y';
    const mockedFeeRate = 12;

    await expect(() =>
      brc20MintEstimateFees({
        addressUtxos: mockedAddressUtxos,
        tick: mockedTick,
        amount: mockedAmount,
        revealAddress: mockedRevealAddress,
        feeRate: mockedFeeRate,
      }),
    ).rejects.toThrow('Invalid tick; should be 4 characters long');
  });

  it('should throw on invalid amount', async () => {
    const mockedAddressUtxos: UTXO[] = [
      { txid: 'txid', vout: 0, value: 1000, status: { confirmed: true }, address: 'address' },
    ];
    const mockedTick = 'TICK';
    const mockedAmount = 0;
    const mockedRevealAddress = 'bc1pyzfhlkq29sylwlv72ve52w8mn7hclefzhyay3dxh32r0322yx6uqajvr3y';
    const mockedFeeRate = 12;

    await expect(() =>
      brc20MintEstimateFees({
        addressUtxos: mockedAddressUtxos,
        tick: mockedTick,
        amount: mockedAmount,
        revealAddress: mockedRevealAddress,
        feeRate: mockedFeeRate,
      }),
    ).rejects.toThrow('Amount should be positive');
  });

  it('should throw on invalid fee rate', async () => {
    const mockedAddressUtxos: UTXO[] = [
      { txid: 'txid', vout: 0, value: 1000, status: { confirmed: true }, address: 'address' },
    ];
    const mockedTick = 'TICK';
    const mockedAmount = 10;
    const mockedRevealAddress = 'bc1pyzfhlkq29sylwlv72ve52w8mn7hclefzhyay3dxh32r0322yx6uqajvr3y';
    const mockedFeeRate = 0;

    await expect(() =>
      brc20MintEstimateFees({
        addressUtxos: mockedAddressUtxos,
        tick: mockedTick,
        amount: mockedAmount,
        revealAddress: mockedRevealAddress,
        feeRate: mockedFeeRate,
      }),
    ).rejects.toThrow('Fee rate should be positive');
  });
});

describe('brc20MintExecute', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('should mint BRC20 successfully', async () => {
    const mockedSeedPhrase = 'seed_phrase';
    const mockedAccountIndex = 0;
    const mockedAddressUtxos: UTXO[] = [
      { txid: 'txid', vout: 0, value: 1000, status: { confirmed: true }, address: 'address' },
    ];
    const mockedTick = 'TICK';
    const mockedAmount = 10;
    const mockedCommitAddress = 'commit_address';
    const mockedRevealAddress = 'reveal_address';
    const mockedChangeAddress = 'change_address';
    const mockedFeeRate = 12;
    const mockedNetwork = 'Mainnet';
    const mockedSelectedUtxos: UTXO[] = mockedAddressUtxos;

    vi.mocked(getBtcPrivateKey).mockResolvedValueOnce('private_key');

    vi.mocked(xverseInscribeApi.createBrc20MintOrder).mockResolvedValue({
      commitAddress: mockedCommitAddress,
      commitValue: 1000,
    } as any);

    vi.mocked(selectUtxosForSend).mockReturnValueOnce({
      change: 2070,
      fee: 1070,
      feeRate: 12,
      selectedUtxos: mockedSelectedUtxos,
    });

    vi.mocked(generateSignedBtcTransaction).mockResolvedValueOnce({ hex: 'commit_hex' } as any);

    vi.mocked(xverseInscribeApi.executeBrc20Order).mockResolvedValueOnce({
      revealTransactionId: 'revealId',
      revealUTXOVOut: 0,
      revealUTXOValue: 3000,
    });

    const result = await brc20MintExecute({
      seedPhrase: mockedSeedPhrase,
      accountIndex: mockedAccountIndex,
      addressUtxos: mockedAddressUtxos,
      tick: mockedTick,
      amount: mockedAmount,
      revealAddress: mockedRevealAddress,
      changeAddress: mockedChangeAddress,
      feeRate: mockedFeeRate,
      network: mockedNetwork,
    });

    expect(result).toEqual('revealId');

    expect(getBtcPrivateKey).toHaveBeenCalledWith(
      expect.objectContaining({
        seedPhrase: mockedSeedPhrase,
        index: BigInt(mockedAccountIndex),
        network: 'Mainnet',
      }),
    );

    expect(xverseInscribeApi.createBrc20MintOrder).toHaveBeenCalledWith(
      mockedTick,
      mockedAmount,
      mockedRevealAddress,
      mockedFeeRate,
      'Mainnet',
      1000,
    );

    expect(selectUtxosForSend).toHaveBeenCalledWith({
      changeAddress: 'change_address',
      recipients: [{ address: mockedCommitAddress, amountSats: new BigNumber(1000) }],
      availableUtxos: mockedAddressUtxos,
      feeRate: mockedFeeRate,
    });

    expect(generateSignedBtcTransaction).toHaveBeenCalledWith(
      'private_key',
      mockedSelectedUtxos,
      new BigNumber(1000),
      [
        {
          address: mockedCommitAddress,
          amountSats: new BigNumber(1000),
        },
      ],
      mockedChangeAddress,
      new BigNumber(1070),
      'Mainnet',
    );

    expect(xverseInscribeApi.executeBrc20Order).toHaveBeenCalledWith(mockedCommitAddress, 'commit_hex');
  });
});

describe('brc20TransferEstimateFees', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('should estimate BRC20 transfer fees correctly', async () => {
    const mockedAddressUtxos: UTXO[] = [
      { txid: 'txid', vout: 0, value: 1000, status: { confirmed: true }, address: 'address' },
    ];
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

    const result = await brc20TransferEstimateFees({
      addressUtxos: mockedAddressUtxos,
      tick: mockedTick,
      amount: mockedAmount,
      revealAddress: mockedRevealAddress,
      feeRate: mockedFeeRate,
    });

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

    expect(selectUtxosForSend).toHaveBeenCalledWith({
      changeAddress: 'bc1pgkwmp9u9nel8c36a2t7jwkpq0hmlhmm8gm00kpdxdy864ew2l6zqw2l6vh',
      recipients: [{ address: mockedRevealAddress, amountSats: new BigNumber(5880) }],
      availableUtxos: mockedAddressUtxos,
      feeRate: mockedFeeRate,
    });
  });

  it('should throw on undefined UTXOs', async () => {
    const mockedTick = 'TICK';
    const mockedAmount = 10;
    const mockedRevealAddress = 'bc1pyzfhlkq29sylwlv72ve52w8mn7hclefzhyay3dxh32r0322yx6uqajvr3y';
    const mockedFeeRate = 12;

    await expect(() =>
      brc20TransferEstimateFees({
        addressUtxos: undefined,
        tick: mockedTick,
        amount: mockedAmount,
        revealAddress: mockedRevealAddress,
        feeRate: mockedFeeRate,
      }),
    ).rejects.toThrow('UTXOs empty');
  });

  it('should throw on empty UTXOs', async () => {
    const mockedAddressUtxos: UTXO[] = [];
    const mockedTick = 'TICK';
    const mockedAmount = 10;
    const mockedRevealAddress = 'bc1pyzfhlkq29sylwlv72ve52w8mn7hclefzhyay3dxh32r0322yx6uqajvr3y';
    const mockedFeeRate = 12;

    await expect(() =>
      brc20TransferEstimateFees({
        addressUtxos: mockedAddressUtxos,
        tick: mockedTick,
        amount: mockedAmount,
        revealAddress: mockedRevealAddress,
        feeRate: mockedFeeRate,
      }),
    ).rejects.toThrow('Insufficient funds, no UTXOs found');
  });

  it('should throw on invalid tick', async () => {
    const mockedAddressUtxos: UTXO[] = [
      { txid: 'txid', vout: 0, value: 1000, status: { confirmed: true }, address: 'address' },
    ];
    const mockedTick = 'TICKs';
    const mockedAmount = 10;
    const mockedRevealAddress = 'bc1pyzfhlkq29sylwlv72ve52w8mn7hclefzhyay3dxh32r0322yx6uqajvr3y';
    const mockedFeeRate = 12;

    await expect(() =>
      brc20TransferEstimateFees({
        addressUtxos: mockedAddressUtxos,
        tick: mockedTick,
        amount: mockedAmount,
        revealAddress: mockedRevealAddress,
        feeRate: mockedFeeRate,
      }),
    ).rejects.toThrow('Invalid tick; should be 4 characters long');
  });

  it('should throw on invalid amount', async () => {
    const mockedAddressUtxos: UTXO[] = [
      { txid: 'txid', vout: 0, value: 1000, status: { confirmed: true }, address: 'address' },
    ];
    const mockedTick = 'TICK';
    const mockedAmount = 0;
    const mockedRevealAddress = 'bc1pyzfhlkq29sylwlv72ve52w8mn7hclefzhyay3dxh32r0322yx6uqajvr3y';
    const mockedFeeRate = 12;

    await expect(() =>
      brc20TransferEstimateFees({
        addressUtxos: mockedAddressUtxos,
        tick: mockedTick,
        amount: mockedAmount,
        revealAddress: mockedRevealAddress,
        feeRate: mockedFeeRate,
      }),
    ).rejects.toThrow('Amount should be positive');
  });

  it('should throw on invalid fee rate', async () => {
    const mockedAddressUtxos: UTXO[] = [
      { txid: 'txid', vout: 0, value: 1000, status: { confirmed: true }, address: 'address' },
    ];
    const mockedTick = 'TICK';
    const mockedAmount = 10;
    const mockedRevealAddress = 'bc1pyzfhlkq29sylwlv72ve52w8mn7hclefzhyay3dxh32r0322yx6uqajvr3y';
    const mockedFeeRate = 0;

    await expect(() =>
      brc20TransferEstimateFees({
        addressUtxos: mockedAddressUtxos,
        tick: mockedTick,
        amount: mockedAmount,
        revealAddress: mockedRevealAddress,
        feeRate: mockedFeeRate,
      }),
    ).rejects.toThrow('Fee rate should be positive');
  });
});

describe('brc20TransferExecute', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('should execute BRC20 transfer correctly', async () => {
    const mockedSeedPhrase = 'seed_phrase';
    const mockedAccountIndex = 0;
    const mockedAddressUtxos: UTXO[] = [
      { txid: 'txid', vout: 0, value: 1000, status: { confirmed: true }, address: 'address' },
    ];
    const mockedTick = 'TICK';
    const mockedAmount = 10;
    const mockedRevealAddress = 'reveal_address';
    const mockedCommitAddress = 'commit_address';
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
      commitAddress: mockedCommitAddress,
      commitValue: 1000,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- we only use these 2 fields in this function
    } as any);

    const mockedSelectedUtxos: UTXO[] = mockedAddressUtxos;
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

    vi.mocked(xverseInscribeApi.finalizeBrc20TransferOrder).mockResolvedValueOnce({
      revealTransactionId: 'revealId',
      commitTransactionId: 'commitId',
      transferTransactionId: 'transferId',
    });

    // Execute the generator function
    const generator = brc20TransferExecute({
      seedPhrase: mockedSeedPhrase,
      accountIndex: mockedAccountIndex,
      addressUtxos: mockedAddressUtxos,
      tick: mockedTick,
      amount: mockedAmount,
      revealAddress: mockedRevealAddress,
      changeAddress: mockedChangeAddress,
      recipientAddress: mockedRecipientAddress,
      feeRate: mockedFeeRate,
      network: mockedNetwork,
    });

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
            new BigNumber(1),
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
          expect(selectUtxosForSend).toHaveBeenCalledWith({
            changeAddress: mockedChangeAddress,
            recipients: [{ address: mockedCommitAddress, amountSats: new BigNumber(1000) }],
            availableUtxos: mockedAddressUtxos,
            feeRate: mockedFeeRate,
          });

          expect(generateSignedBtcTransaction).toHaveBeenCalledWith(
            'private_key',
            mockedSelectedUtxos,
            new BigNumber(1000),
            [
              {
                address: mockedCommitAddress,
                amountSats: new BigNumber(1000),
              },
            ],
            mockedChangeAddress,
            new BigNumber(1070),
            'Mainnet',
          );
          break;

        case ExecuteTransferProgressCodes.CreatingTransferTransaction:
          expect(xverseInscribeApi.executeBrc20Order).toHaveBeenCalledWith(mockedCommitAddress, 'commit_hex', true);
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

    expect(result).toEqual({
      revealTransactionId: 'revealId',
      commitTransactionId: 'commitId',
      transferTransactionId: 'transferId',
    });
  });
});
