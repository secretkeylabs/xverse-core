import {
  NetworkType,
  BtcOrdinal,
} from '../types';
import axios from 'axios';
import { ORDINAL_BROADCAST_URI, ORDINAL_TESTNET_BROADCAST_URI, XVERSE_API_BASE_URL } from '../constant';
import { fetchBtcAddressUnspent } from './btc';
import { BtcUtxoDataResponse } from '../types/api/blockcypher/wallet';
import { UnspentOutput } from '../transactions/btc'

const sortOrdinalsByConfirmationTime = (prev: BtcOrdinal, next: BtcOrdinal) => {
  if (new Date(prev.confirmationTime).getTime() > new Date(next.confirmationTime).getTime()) {
    return 1;
  }
  if (new Date(prev.confirmationTime).getTime() < new Date(next.confirmationTime).getTime()) {
    return -1;
  }
  return 0;
};

export async function fetchBtcOrdinalsData(
  btcAddress: string,
  network: NetworkType
): Promise<BtcOrdinal[]> {
  const unspentUTXOS = await fetchBtcAddressUnspent(btcAddress, network);
  const ordinals: BtcOrdinal[] = [];
  await Promise.all(
    unspentUTXOS.map(async (utxo) => {
      const ordinalContentUrl = `${XVERSE_API_BASE_URL}/v1/ordinals/output/${utxo.tx_hash}`;
      try {
        const ordinal = await axios.get(ordinalContentUrl);
        if (ordinal) {
          ordinals.push({
            id: ordinal.data.id,
            confirmationTime: utxo.confirmed,
            utxo,
          });
        }
        return Promise.resolve(ordinal);
      } catch (err) {}
    })
  );
  return ordinals.sort(sortOrdinalsByConfirmationTime);
}

export async function getOrdinalIdFromUtxo(utxo: BtcUtxoDataResponse) {
  const ordinalContentUrl = `${XVERSE_API_BASE_URL}/v1/ordinals/output/${utxo.tx_hash}/${utxo.tx_output_n}`;
  try {
    const ordinal = await axios.get(ordinalContentUrl);
    if (ordinal) {
      if (ordinal.data.id) {
        return Promise.resolve(ordinal.data.id);
      } else {
        return null
      }
    } else {
      return null;
    }
  } catch (err) {
  }
}

export async function getTextOrdinalContent(url: string): Promise<string> {
  return axios
    .get<string>(url, {
      timeout: 30000,
      transformResponse: [(data) => parseOrdinalTextContentData(data)]
    })
    .then((response) => response!.data)
    .catch((error) => { 
      return '';
    });
}

export async function broadcastRawBtcOrdinalTransaction(
  rawTx: string,
  network: NetworkType,
): Promise<string> {
  const broadcastUrl = network === "Mainnet" ? ORDINAL_BROADCAST_URI : ORDINAL_TESTNET_BROADCAST_URI
  return axios.post(broadcastUrl, rawTx, {timeout: 45000}).then((response) => {
    return response.data;
  });
}

export function parseOrdinalTextContentData(content: string): string {
  try {
    const contentData = JSON.parse(content);
    if (contentData["p"]) {
      // check for sns protocol
      if (contentData["p"] === 'sns') {
        return contentData.hasOwnProperty('name') ? contentData["name"] : content;
      } else {
        return content;
      }
    } else {
      return content;
    }
  } catch (error) {
    return content;
  }
}

export async function getNonOrdinalUtxo(
  address: string,
  network: NetworkType,
): Promise<Array<UnspentOutput>> {
  const unspentOutputs = await fetchBtcAddressUnspent(address, network)
  const nonOrdinalOutputs: Array<UnspentOutput> = []

  for (let i = 0; i < unspentOutputs.length; i++) {
    const ordinalId = await getOrdinalIdFromUtxo(unspentOutputs[i])
    if (ordinalId) {
    } else {
      nonOrdinalOutputs.push(unspentOutputs[i])
    }
  }

  return nonOrdinalOutputs
}
