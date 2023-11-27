import axios, { AxiosError, AxiosInstance } from 'axios';
import {
  BLOCKCYPHER_BASE_URI_MAINNET,
  BLOCKCYPHER_BASE_URI_TESTNET,
  BTC_BASE_URI_MAINNET,
  BTC_BASE_URI_TESTNET,
} from '../../constant';
import {
  BtcAddressBalanceResponse,
  BtcAddressDataResponse,
  BtcTransactionBroadcastResponse,
  BtcUtxoDataResponse,
} from '../../types/api/blockcypher/wallet';
import * as esplora from '../../types/api/esplora';
import { NetworkType } from '../../types/network';
import ApiInstance from '../instance';
import { BitcoinApiProvider } from './types';

export interface EsploraApiProviderOptions {
  network: NetworkType;
  url?: string;
}

export class BitcoinEsploraApiProvider extends ApiInstance implements BitcoinApiProvider {
  _network: NetworkType;

  blockcypherApi!: AxiosInstance;

  constructor(options: EsploraApiProviderOptions) {
    const { url, network } = options;
    super({
      baseURL: url || network == 'Mainnet' ? BTC_BASE_URI_MAINNET : BTC_BASE_URI_TESTNET,
    });
    this._network = network;

    this.blockcypherApi = axios.create({
      baseURL: network == 'Mainnet' ? BLOCKCYPHER_BASE_URI_MAINNET : BLOCKCYPHER_BASE_URI_TESTNET,
    });
  }

  async getBalance(address: string) {
    const data = await this.httpGet<BtcAddressBalanceResponse>(`/address/${address}`);
    const { chain_stats: chainStats, mempool_stats: mempoolStats } = data;

    const finalBalance = chainStats.funded_txo_sum - chainStats.spent_txo_sum;
    const unconfirmedBalance = mempoolStats.funded_txo_sum - mempoolStats.spent_txo_sum;

    return {
      address,
      finalBalance,
      finalNTx: chainStats.tx_count,
      totalReceived: chainStats.funded_txo_sum,
      totalSent: chainStats.spent_txo_sum,
      unconfirmedTx: mempoolStats.tx_count,
      unconfirmedBalance,
    };
  }

  private async getUtxosEsplora(
    address: string,
  ): Promise<(esplora.UTXO & { address: string; blockHeight?: number })[]> {
    const data = await this.httpGet<esplora.UTXO[]>(`/address/${address}/utxo`);

    const utxoSets = data.map((utxo) => ({
      ...utxo,
      address,
      blockHeight: utxo.status.block_height,
    }));

    return utxoSets;
  }

  private async getUtxosBlockcypher(
    address: string,
  ): Promise<(esplora.UTXO & { address: string; blockHeight?: number })[]> {
    // blockcypher has a limit of 2000 UTXOs per request and allows pagination
    // so we will try get all unspent UTXOs by making multiple requests if there are more than 2000

    const data: BtcUtxoDataResponse[] = [];
    let hasMore = true;
    let lastBlockHeight = 0;

    while (hasMore) {
      const params: Record<string, unknown> = {
        unspentOnly: true,
        limit: 2000,
      };

      if (lastBlockHeight) {
        params.before = lastBlockHeight;
      }
      const response = await this.blockcypherApi.get<BtcAddressDataResponse>(`/addrs/${address}`, {
        params,
      });
      data.push(...response.data.txrefs);

      hasMore = response.data.hasMore;
      lastBlockHeight = data[data.length - 1].block_height;
    }

    const utxoSets = data.map((utxo) => ({
      address,
      status: {
        confirmed: utxo.confirmations > 0,
        block_height: utxo.block_height,
        block_time: utxo.confirmed ? new Date(utxo.confirmed).getTime() / 1000 : undefined,
        // ! block_hash is unavailable from blockcypher
      },
      txid: utxo.tx_hash,
      vout: utxo.tx_output_n,
      value: utxo.value,
      blockHeight: utxo.block_height,
    }));

    return utxoSets;
  }

  async getUnspentUtxos(address: string): Promise<(esplora.UTXO & { address: string; blockHeight?: number })[]> {
    try {
      // we try using the base esplora api first, however, it has a limit to the number of UTXOs it can return
      const utxoSets = await this.getUtxosEsplora(address);

      return utxoSets;
    } catch (err) {
      const error = err as AxiosError;
      if (error.response?.status !== 400 || error.response?.data !== 'Too many history entries') {
        // something other than the UTXO limit went wrong, throw error for downstream handling
        throw err;
      }

      // if we get here, it means we hit the UTXO limit, so we need to use the blockcypher endpoint to get the UTXOs
      const utxoSets = await this.getUtxosBlockcypher(address);

      return utxoSets;
    }
  }

  async _getAddressTransactionCount(address: string) {
    const data = await this.httpGet<esplora.Address>(`/address/${address}`);
    return data.chain_stats.tx_count + data.mempool_stats.tx_count;
  }

  async getAddressTransactions(address: string): Promise<esplora.Transaction[]> {
    return this.httpGet<esplora.Transaction[]>(`/address/${address}/txs`);
  }

  async getTransaction(txid: string): Promise<esplora.Transaction> {
    return this.httpGet<esplora.Transaction>(`/tx/${txid}`);
  }

  async getTransactionHex(txid: string): Promise<string> {
    return this.httpGet<string>(`/tx/${txid}/hex`);
  }

  async getAddressMempoolTransactions(address: string): Promise<esplora.BtcAddressMempool[]> {
    return this.httpGet<esplora.BtcAddressMempool[]>(`/address/${address}/txs/mempool`);
  }

  async sendRawTransaction(rawTransaction: string): Promise<BtcTransactionBroadcastResponse> {
    const data = await this.httpPost<string>('/tx', rawTransaction);
    return {
      tx: {
        hash: data,
      },
    };
  }

  async getRecommendedFees(): Promise<esplora.RecommendedFeeResponse> {
    // !Note: This is not an esplora endpoint, it is a mempool.space endpoint
    // TODO: move this out of here
    const data: esplora.RecommendedFeeResponse = await axios.get('https://mempool.space/api/v1/fees/recommended');
    return data;
  }

  async getLatestBlockHeight(): Promise<number> {
    const data = await this.httpGet<number>('/blocks/tip/height');
    return data;
  }
}
export default BitcoinEsploraApiProvider;
