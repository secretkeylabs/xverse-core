import BigNumber from 'bignumber.js';
import { describe, expect, it, vi } from 'vitest';

import { utxo10k, utxo384k, utxo3k, utxo792k } from './btc.data';

import * as self from '../../transactions/btc.utils';

const dummyChangeAddress = 'bc1pzsm9pu47e7npkvxh9dcd0dc2qwqshxt2a9tt7aq3xe9krpl8e82sx6phdj';

describe('selectOptimalUtxos', () => {
  it('should return immediately if inputs result in valid metadata', () => {
    const mockedResponse = {
      fee: 10,
      change: 100,
      feeRate: 1,
      selectedUtxos: [],
    };
    const getMetadataMock = vi.spyOn(self, 'getTransactionMetadataForUtxos').mockReturnValueOnce(mockedResponse);

    const result = self.selectOptimalUtxos({
      recipients: [{ address: '', amountSats: new BigNumber(10) }],
      selectedUtxos: [utxo10k],
      availableUtxos: [],
      changeAddress: dummyChangeAddress,
      feeRate: 1,
    });

    expect(result).toEqual(mockedResponse);
    expect(getMetadataMock).toHaveBeenCalledOnce();
  });

  it('should return undefined if there are no available UTXOs', () => {
    const getMetadataMock = vi.spyOn(self, 'getTransactionMetadataForUtxos').mockReturnValueOnce(undefined);

    const result = self.selectOptimalUtxos({
      recipients: [{ address: '', amountSats: new BigNumber(10) }],
      selectedUtxos: [],
      availableUtxos: [],
      changeAddress: dummyChangeAddress,
      feeRate: 1,
    });

    expect(result).toBe(undefined);
    expect(getMetadataMock).toHaveBeenCalledOnce();
  });

  it('should return undefined if we would be selecting more UTXOs than current best + 1', () => {
    const getMetadataMock = vi.spyOn(self, 'getTransactionMetadataForUtxos').mockReturnValueOnce(undefined);

    const result = self.selectOptimalUtxos({
      recipients: [{ address: '', amountSats: new BigNumber(10) }],
      selectedUtxos: [utxo10k, utxo384k],
      availableUtxos: [utxo792k, utxo3k],
      changeAddress: dummyChangeAddress,
      feeRate: 1,
      currentBestUtxoCount: 1,
    });

    expect(result).toBe(undefined);
    expect(getMetadataMock).toHaveBeenCalledOnce();
  });

  it('tries highest value UTXO first and returns undefined if metadata is undefined', async () => {
    const selectOptimalUtxos = self.selectOptimalUtxos;
    vi.spyOn(self, 'getTransactionMetadataForUtxos').mockReturnValueOnce(undefined);
    const selectOptimalUtxosMock = vi.spyOn(self, 'selectOptimalUtxos').mockReturnValueOnce(undefined);

    const props = {
      recipients: [{ address: '', amountSats: new BigNumber(10) }],
      selectedUtxos: [],
      availableUtxos: [utxo10k, utxo384k, utxo792k, utxo3k],
      changeAddress: dummyChangeAddress,
      feeRate: 1,
    };

    const result = selectOptimalUtxos(props);

    expect(result).toBe(undefined);
    expect(selectOptimalUtxosMock).toHaveBeenCalledTimes(1);
    expect(selectOptimalUtxosMock).toHaveBeenCalledWith({
      recipients: props.recipients,
      selectedUtxos: [utxo792k],
      availableUtxos: [utxo3k, utxo10k, utxo384k],
      changeAddress: props.changeAddress,
      feeRate: props.feeRate,
      currentBestUtxoCount: undefined,
    });
  });

  it('tries UTXOs in decreasing order of value and returns highest value if fees are same', async () => {
    const selectOptimalUtxos = self.selectOptimalUtxos;
    vi.spyOn(self, 'getTransactionMetadataForUtxos').mockReturnValueOnce(undefined);
    const selectOptimalUtxosMock = vi.spyOn(self, 'selectOptimalUtxos').mockImplementation(({ selectedUtxos }) => ({
      fee: 10,
      change: selectedUtxos[0].value,
      feeRate: 1,
      selectedUtxos,
    }));

    const props = {
      recipients: [{ address: '', amountSats: new BigNumber(10) }],
      selectedUtxos: [],
      availableUtxos: [utxo10k, utxo384k, utxo792k, utxo3k],
      changeAddress: dummyChangeAddress,
      feeRate: 1,
    };

    const result = selectOptimalUtxos(props);

    expect(result).toEqual({
      fee: 10,
      change: utxo792k.value,
      feeRate: 1,
      selectedUtxos: [utxo792k],
    });
    // expect to have been called once per UTXO
    expect(selectOptimalUtxosMock).toHaveBeenCalledTimes(4);
    expect(selectOptimalUtxosMock).toHaveBeenNthCalledWith(1, expect.objectContaining({ selectedUtxos: [utxo792k] }));
    expect(selectOptimalUtxosMock).toHaveBeenNthCalledWith(2, expect.objectContaining({ selectedUtxos: [utxo384k] }));
    expect(selectOptimalUtxosMock).toHaveBeenNthCalledWith(3, expect.objectContaining({ selectedUtxos: [utxo10k] }));
    expect(selectOptimalUtxosMock).toHaveBeenNthCalledWith(4, expect.objectContaining({ selectedUtxos: [utxo3k] }));
  });

  it('tries UTXOs until fee increases then returns', async () => {
    const selectOptimalUtxos = self.selectOptimalUtxos;
    vi.spyOn(self, 'getTransactionMetadataForUtxos').mockReturnValueOnce(undefined);
    const selectOptimalUtxosMock = vi.spyOn(self, 'selectOptimalUtxos');
    selectOptimalUtxosMock.mockReturnValueOnce({
      fee: 10,
      change: 100,
      feeRate: 1,
      selectedUtxos: [utxo792k],
    });
    selectOptimalUtxosMock.mockReturnValueOnce({
      fee: 10,
      change: 50,
      feeRate: 1,
      selectedUtxos: [utxo384k],
    });
    selectOptimalUtxosMock.mockReturnValueOnce({
      fee: 11,
      change: 100,
      feeRate: 1,
      selectedUtxos: [utxo10k],
    });

    const props = {
      recipients: [{ address: '', amountSats: new BigNumber(10) }],
      selectedUtxos: [],
      availableUtxos: [utxo10k, utxo384k, utxo792k, utxo3k],
      changeAddress: dummyChangeAddress,
      feeRate: 1,
    };

    const result = selectOptimalUtxos(props);

    expect(result).toEqual({
      fee: 10,
      change: 100,
      feeRate: 1,
      selectedUtxos: [utxo792k],
    });
    // expect to have been called once per UTXO
    expect(selectOptimalUtxosMock).toHaveBeenCalledTimes(3);
  });

  it('prefers UTXO selection with lower fee, even if change is lower', async () => {
    const selectOptimalUtxos = self.selectOptimalUtxos;
    vi.spyOn(self, 'getTransactionMetadataForUtxos').mockReturnValueOnce(undefined);
    const selectOptimalUtxosMock = vi.spyOn(self, 'selectOptimalUtxos');
    selectOptimalUtxosMock.mockReturnValueOnce({
      fee: 10,
      change: 100,
      feeRate: 1,
      selectedUtxos: [utxo792k],
    });
    selectOptimalUtxosMock.mockReturnValueOnce({
      fee: 9,
      change: 50,
      feeRate: 1,
      selectedUtxos: [utxo384k],
    });
    selectOptimalUtxosMock.mockReturnValueOnce({
      fee: 10,
      change: 100,
      feeRate: 1,
      selectedUtxos: [utxo10k],
    });

    const props = {
      recipients: [{ address: '', amountSats: new BigNumber(10) }],
      selectedUtxos: [],
      availableUtxos: [utxo10k, utxo384k, utxo792k, utxo3k],
      changeAddress: dummyChangeAddress,
      feeRate: 1,
    };

    const result = selectOptimalUtxos(props);

    expect(result).toEqual({
      fee: 9,
      change: 50,
      feeRate: 1,
      selectedUtxos: [utxo384k],
    });
    // expect to have been called once per UTXO
    expect(selectOptimalUtxosMock).toHaveBeenCalledTimes(3);
  });

  it('prefers UTXO selections with higher change if fees are same', async () => {
    const selectOptimalUtxos = self.selectOptimalUtxos;
    vi.spyOn(self, 'getTransactionMetadataForUtxos').mockReturnValueOnce(undefined);
    const selectOptimalUtxosMock = vi.spyOn(self, 'selectOptimalUtxos');
    selectOptimalUtxosMock.mockReturnValueOnce({
      fee: 10,
      change: 100,
      feeRate: 1,
      selectedUtxos: [utxo792k],
    });
    selectOptimalUtxosMock.mockReturnValueOnce({
      fee: 10,
      change: 150,
      feeRate: 1,
      selectedUtxos: [utxo384k],
    });
    selectOptimalUtxosMock.mockReturnValueOnce({
      fee: 11,
      change: 100,
      feeRate: 1,
      selectedUtxos: [utxo10k],
    });

    const props = {
      recipients: [{ address: '', amountSats: new BigNumber(10) }],
      selectedUtxos: [],
      availableUtxos: [utxo10k, utxo384k, utxo792k, utxo3k],
      changeAddress: dummyChangeAddress,
      feeRate: 1,
    };

    const result = selectOptimalUtxos(props);

    expect(result).toEqual({
      fee: 10,
      change: 150,
      feeRate: 1,
      selectedUtxos: [utxo384k],
    });
    // expect to have been called once per UTXO
    expect(selectOptimalUtxosMock).toHaveBeenCalledTimes(3);
  });
});
