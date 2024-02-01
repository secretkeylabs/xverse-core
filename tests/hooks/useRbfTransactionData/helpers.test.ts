import BigNumber from 'bignumber.js';
import { calculateStxData } from '../../../hooks/useRbfTransactionData/helpers';
import { StxTransactionData, SettingsNetwork, AppInfo } from '../../../types';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { StacksMocknet } from '@stacks/network';
import axios from 'axios';
import { microstacksToStx } from '../../../currency';

vi.mock('axios');
vi.mock('@stacks/transactions', async () => {
  const actual = await vi.importActual<any>('@stacks/transactions');
  return {
    ...actual,
    estimateTransaction: vi.fn().mockResolvedValue([
      { fee: 1000, fee_rate: 1000 },
      { fee: 2000, fee_rate: 2000 },
      { fee: 3000, fee_rate: 3000 },
    ]),
  };
});

const lowFee = 1000;
const mediumFee = 2000;
const highFee = 3000;

const mockTransaction: StxTransactionData = {
  txid: 'mock-txid',
  amount: BigNumber(100),
  seenTime: new Date(),
  incoming: false,
  txType: 'token_transfer',
  txStatus: 'success',
  blockHash: 'mock-blockhash',
  blockHeight: 1,
  burnBlockTime: 1,
  burnBlockTimeIso: new Date(),
  canonical: true,
  fee: BigNumber(lowFee),
  nonce: 1,
  postConditionMode: 'mock-mode',
  senderAddress: 'mock-senderaddress',
  sponsored: false,
  txIndex: 1,
  txResults: 'mock-results',
};

const mockBtcNetwork: SettingsNetwork = {
  type: 'Mainnet',
  address: 'mock-address',
  btcApiUrl: 'mock-btcApiUrl',
  fallbackBtcApiUrl: 'mock-fallbackBtcApiUrl',
};

const mockStacksNetwork = new StacksMocknet();

const mockAppInfo: AppInfo = {
  stxSendTxMultiplier: 1,
  poolStackingTxMultiplier: 1,
  otherTxMultiplier: 1,
  thresholdHighSatsFee: 1,
  thresholdHighSatsPerByteRatio: 1,
  thresholdHighStacksFee: 5000,
};

const mockStxAvailableBalance = '5000';

const mockResult = {
  rbfTransaction: undefined,
  rbfTxSummary: {
    currentFee: microstacksToStx(BigNumber(lowFee)).toNumber(),
    currentFeeRate: microstacksToStx(BigNumber(lowFee)).toNumber(),
    minimumRbfFee: microstacksToStx(BigNumber(lowFee).multipliedBy(1.25)).toNumber(),
    minimumRbfFeeRate: microstacksToStx(BigNumber(lowFee).multipliedBy(1.25)).toNumber(),
  },
  rbfRecommendedFees: {
    high: {
      enoughFunds: true,
      fee: microstacksToStx(BigNumber(highFee)).toNumber(),
      feeRate: microstacksToStx(BigNumber(highFee)).toNumber(),
    },
    medium: {
      enoughFunds: true,
      fee: microstacksToStx(BigNumber(mediumFee)).toNumber(),
      feeRate: microstacksToStx(BigNumber(mediumFee)).toNumber(),
    },
  },
  mempoolFees: {
    fastestFee: microstacksToStx(BigNumber(highFee)).toNumber(),
    halfHourFee: microstacksToStx(BigNumber(mediumFee)).toNumber(),
    hourFee: microstacksToStx(BigNumber(lowFee)).toNumber(),
    economyFee: microstacksToStx(BigNumber(lowFee)).toNumber(),
    minimumFee: microstacksToStx(BigNumber(lowFee)).toNumber(),
  },
};

const mockRawTx =
  // eslint-disable-next-line max-len
  '0x80800000000400483cd5c1c96119e132aa12b76df34f003c85f9af00000000000000240000000000021cd200006c47412a98c710eaaa276f93d9a77097616afe9ac8f48068bae96f8084c23ad26b4d6e77fce26b20be0faa86493e2fd8567e48283157973399ab5e283965b20e03020000000000051a5953622a9370e859e5a8e290ed38b1a885bf09df00000000000186a000000000000000000000000000000000000000000000000000000000000000000000';

describe('calculateStxData method', async () => {
  beforeEach(() => {
    vi.mocked(axios.get).mockResolvedValue({
      data: {
        raw_tx: mockRawTx,
      },
    });
  });

  it('should return the fee estimation fetched from the Stacks function', async () => {
    const result = await calculateStxData(
      mockTransaction,
      mockBtcNetwork,
      mockStacksNetwork,
      mockAppInfo,
      mockStxAvailableBalance,
    );

    expect(result).toBeDefined();
    expect(result).toEqual(mockResult);
  });

  it('should return the fee estimation based on the current fee', async () => {
    const fee = BigNumber(2000);
    const tx = { ...mockTransaction, fee };
    const result = await calculateStxData(tx, mockBtcNetwork, mockStacksNetwork, mockAppInfo, mockStxAvailableBalance);

    expect(result).toBeDefined();
    expect(result).toEqual({
      ...mockResult,
      rbfRecommendedFees: {
        highest: {
          enoughFunds: true,
          fee: microstacksToStx(fee.multipliedBy(1.5)).toNumber(),
          feeRate: microstacksToStx(fee.multipliedBy(1.5)).toNumber(),
        },
        higher: {
          enoughFunds: true,
          fee: microstacksToStx(fee.multipliedBy(1.25)).toNumber(),
          feeRate: microstacksToStx(fee.multipliedBy(1.25)).toNumber(),
        },
      },
      rbfTxSummary: {
        currentFee: microstacksToStx(fee).toNumber(),
        currentFeeRate: microstacksToStx(fee).toNumber(),
        minimumRbfFee: microstacksToStx(fee.multipliedBy(1.25)).toNumber(),
        minimumRbfFeeRate: microstacksToStx(fee.multipliedBy(1.25)).toNumber(),
      },
    });
  });

  it('should return falsy value for the enoughFunds when the balance is not enough', async () => {
    const availableBalance = '1';
    const result = await calculateStxData(
      mockTransaction,
      mockBtcNetwork,
      mockStacksNetwork,
      mockAppInfo,
      availableBalance,
    );

    expect(result).toBeDefined();
    expect(result).toEqual({
      ...mockResult,
      rbfRecommendedFees: {
        high: {
          ...mockResult.rbfRecommendedFees.high,
          enoughFunds: false,
        },
        medium: {
          ...mockResult.rbfRecommendedFees.medium,
          enoughFunds: false,
        },
      },
    });
  });
});
