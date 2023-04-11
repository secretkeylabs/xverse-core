import {
  NetworkType,
  BtcOrdinal,
  UTXO,
} from '../types';
import axios from 'axios';
import { XVERSE_API_BASE_URL } from '../constant';
import { fetchBtcAddressUnspent } from './btc';
import { BtcUtxoDataResponse } from '../types/api/blockcypher/wallet';
import { UnspentOutput } from '../transactions/btc'
import BitcoinEsploraApiProvider from '../api/esplora/esploraAPiProvider';

const sortOrdinalsByConfirmationTime = (prev: BtcOrdinal, next: BtcOrdinal) => {
  if (prev.confirmationTime > next.confirmationTime) {
    return 1;
  }
  if (prev.confirmationTime < next.confirmationTime) {
    return -1;
  }
  return 0;
};

export async function fetchBtcOrdinalsData(
  btcAddress: string,
  network: NetworkType
): Promise<BtcOrdinal[]> {
  const btcClient = new BitcoinEsploraApiProvider({
    network,
  });
  const unspentUTXOS = await btcClient.getUnspentUtxos(btcAddress);
  const ordinals: BtcOrdinal[] = [];
  await Promise.all(
    unspentUTXOS.map(async (utxo: UTXO) => {
      const ordinalContentUrl = `${XVERSE_API_BASE_URL}/v1/ordinals/output/${utxo.txid}/${utxo.vout}`;
      try {
        const ordinal = await axios.get(ordinalContentUrl);
        if (ordinal) {
          ordinals.push({
            id: ordinal.data.id,
            confirmationTime: utxo.status.block_time || 0,
            utxo,
          });
        }
        return Promise.resolve(ordinal);
      } catch (err) {}
    })
  );
  return ordinals.sort(sortOrdinalsByConfirmationTime);
}

export async function getOrdinalIdFromUtxo(utxo: UTXO) {
  const ordinalContentUrl = `${XVERSE_API_BASE_URL}/v1/ordinals/output/${utxo.txid}/${utxo.vout}`;
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
): Promise<Array<UTXO>> {
  const btcClient = new BitcoinEsploraApiProvider({
    network,
  });
  const unspentOutputs = await btcClient.getUnspentUtxos(address);
  const nonOrdinalOutputs: Array<UTXO> = []

  for (let i = 0; i < unspentOutputs.length; i++) {
    const ordinalId = await getOrdinalIdFromUtxo(unspentOutputs[i])
    if (ordinalId) {
    } else {
      nonOrdinalOutputs.push(unspentOutputs[i])
    }
  }

  return nonOrdinalOutputs
}
