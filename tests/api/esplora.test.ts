import MockAdapter from 'axios-mock-adapter';
import { describe, expect, it } from 'vitest';
import BitcoinEsploraApiProvider from '../../api/esplora/esploraAPiProvider';
import { BTC_BASE_URI_TESTNET } from '../../constant';

describe('BitcoinEsploraApiProvider', () => {
  describe('when fallbackUrl is not provided', () => {
    it('should construct with a bitcoinApi', () => {
      const api = new BitcoinEsploraApiProvider({
        network: 'Testnet',
        url: BTC_BASE_URI_TESTNET,
      });
      expect(api.bitcoinApi).toBeTruthy();
      expect(api.fallbackBitcoinApi).toBeFalsy();
    });

    it('should intercept a 4xx response and not retry', async () => {
      const api = new BitcoinEsploraApiProvider({
        network: 'Testnet',
        url: BTC_BASE_URI_TESTNET,
      });

      // mock the bitcoinApi to return a 400 error
      const mockBitcoinApi = new MockAdapter(api.bitcoinApi);
      mockBitcoinApi.onGet().reply(400);

      try {
        // eslint-disable-next-line @typescript-eslint/dot-notation -- accessing a private method
        await api['httpGet'](`/address/mnUu4b2k4RqG3u5NqXgqjYQ3GKJ3XjYj8U/utxo`);
      } catch (error) {
        // expect the bitcoinApi to have been called once
        expect(mockBitcoinApi.history.get.length).toEqual(1);

        // expect the fallbackBitcoinApi to not have been called
        expect(api.fallbackBitcoinApi).toBeFalsy();

        // expect the error to be thrown
        expect(error.message).toEqual('Request failed with status code 400');
      }
    });
  });

  describe('when fallbackUrl is provided', () => {
    it('should construct with a bitcoinApi and fallbackBitcoinApi', () => {
      const api = new BitcoinEsploraApiProvider({
        network: 'Testnet',
        url: BTC_BASE_URI_TESTNET,
        fallbackUrl: 'https://btc-testnet.xverse.app',
      });
      expect(api.bitcoinApi).toBeTruthy();
      expect(api.fallbackBitcoinApi).toBeTruthy();
    });

    it('should intercept a 4xx response and retry on fallbackBitcoinApi', async () => {
      // given a fallbackUrl is provided
      const api = new BitcoinEsploraApiProvider({
        network: 'Testnet',
        url: BTC_BASE_URI_TESTNET,
        fallbackUrl: 'https://btc-testnet.xverse.app',
      });

      // mock the bitcoinApi to return a 400 error
      const mockBitcoinApi = new MockAdapter(api.bitcoinApi);
      mockBitcoinApi.onGet().reply(400, 'Too many unspent transaction outputs');

      // mock the fallbackBitcoinApi to return a 200 response
      const mockFallbackBitcoinApi = new MockAdapter(api.fallbackBitcoinApi!);
      mockFallbackBitcoinApi.onGet().reply(200, { test: 'test' });

      // eslint-disable-next-line @typescript-eslint/dot-notation -- accessing a private method
      const data = await api['httpGet'](`/address/mnUu4b2k4RqG3u5NqXgqjYQ3GKJ3XjYj8U/utxo`);

      // expect the bitcoinApi to have been called once
      expect(mockBitcoinApi.history.get.length).toEqual(1);

      // expect the fallbackBitcoinApi to have been called once with the same url,
      // but with the fallbackUrl as the baseURL
      expect(mockFallbackBitcoinApi.history.get.length).toEqual(1);
      expect(mockFallbackBitcoinApi.history.get[0]).toEqual(
        expect.objectContaining({
          url: '/address/mnUu4b2k4RqG3u5NqXgqjYQ3GKJ3XjYj8U/utxo',
          baseURL: 'https://btc-testnet.xverse.app',
        }),
      );

      // expect the data to be returned from the fallbackBitcoinApi
      expect(data).toEqual({ test: 'test' });
    });

    it('should intercept a 5xx response and retry', async () => {
      const api = new BitcoinEsploraApiProvider({
        network: 'Testnet',
        url: BTC_BASE_URI_TESTNET,
        fallbackUrl: 'https://btc-testnet.xverse.app',
      });

      // mock the bitcoinApi to return a 504 error
      const mockBitcoinApi = new MockAdapter(api.bitcoinApi);
      mockBitcoinApi.onGet().reply(504);

      // mock the fallbackBitcoinApi to return a 200 response
      const mockFallbackBitcoinApi = new MockAdapter(api.fallbackBitcoinApi!);
      mockFallbackBitcoinApi.onGet().reply(200, { test: 'test' });

      // eslint-disable-next-line @typescript-eslint/dot-notation -- accessing a private method
      const data = await api['httpGet'](`/address/mnUu4b2k4RqG3u5NqXgqjYQ3GKJ3XjYj8U/utxo`);

      // expect the bitcoinApi to have been called once
      expect(mockBitcoinApi.history.get.length).toEqual(2);

      // expect the fallbackBitcoinApi to have been called once with the same url
      expect(mockFallbackBitcoinApi.history.get.length).toEqual(1);
      expect(mockFallbackBitcoinApi.history.get[0].url).toEqual('/address/mnUu4b2k4RqG3u5NqXgqjYQ3GKJ3XjYj8U/utxo');

      // expect the data to be returned from the fallbackBitcoinApi
      expect(data).toEqual({ test: 'test' });
    });

    it('should intercept a timeout and retry', async () => {
      const api = new BitcoinEsploraApiProvider({
        network: 'Testnet',
        url: BTC_BASE_URI_TESTNET,
        fallbackUrl: 'https://btc-testnet.xverse.app',
      });

      // mock the bitcoinApi to timeout
      const mockBitcoinApi = new MockAdapter(api.bitcoinApi);
      mockBitcoinApi.onGet().timeout();

      // mock the fallbackBitcoinApi to return a 200 response
      const mockFallbackBitcoinApi = new MockAdapter(api.fallbackBitcoinApi!);
      mockFallbackBitcoinApi.onGet().reply(200, { test: 'test' });

      // eslint-disable-next-line @typescript-eslint/dot-notation -- accessing a private method
      const data = await api['httpGet'](`/address/mnUu4b2k4RqG3u5NqXgqjYQ3GKJ3XjYj8U/utxo`);

      // expect the bitcoinApi to have been called once
      expect(mockBitcoinApi.history.get.length).toEqual(1);

      // expect the fallbackBitcoinApi to have been called once with the same url
      expect(mockFallbackBitcoinApi.history.get.length).toEqual(1);
      expect(mockFallbackBitcoinApi.history.get[0].url).toEqual('/address/mnUu4b2k4RqG3u5NqXgqjYQ3GKJ3XjYj8U/utxo');

      // expect the data to be returned from the fallbackBitcoinApi
      expect(data).toEqual({ test: 'test' });
    });
  });
});
