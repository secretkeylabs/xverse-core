import {
  NetworkType,
  BtcOrdinal,
  UTXO,
  FungibleToken
} from '../types';
import axios from 'axios';
import { 
  ORDINALS_URL, 
  XVERSE_API_BASE_URL,
  ORDINALS_FT_INDEXER_API_URL
} from '../constant';
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
        return null;
      }
    } else {
      return null;
    }
  } catch (err) {}
}

export async function getTextOrdinalContent(content: string): Promise<string> {
  const url = `${ORDINALS_URL}${content}`;
  return axios
    .get<string>(url, {
      timeout: 30000,
      transformResponse: [(data) => parseOrdinalTextContentData(data)],
    })
    .then((response) => response!.data)
    .catch((error) => {
      return '';
    });
}

export function parseOrdinalTextContentData(content: string): string {
  try {
    const contentData = JSON.parse(content);
    if (contentData['p']) {
      // check for sns protocol
      if (contentData['p'] === 'sns') {
        return contentData.hasOwnProperty('name') ? contentData['name'] : content;
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
    const ordinalId = await getOrdinalIdFromUtxo(unspentOutputs[i]);
    if (ordinalId) {
    } else {
      nonOrdinalOutputs.push(unspentOutputs[i]);
    }
  }

  return nonOrdinalOutputs;
}

export async function getOrdinalsFtBalance(
  address: string,
): Promise<FungibleToken[]> {
  const url = `${ORDINALS_FT_INDEXER_API_URL}/${address}/brc20/summary?start=0&limit=200`;
  return axios
    .get(url, {
      timeout: 30000,
    })
    .then((response) => { 
      if(response.data.msg == "ok") {
        const responseTokensList = response!.data.data.detail;
        var tokensList: Array<FungibleToken> = [];
        responseTokensList.forEach((responseToken: any) => {
          const token: FungibleToken = {
            name: responseToken.ticker,
            balance: responseToken.overallBalance,
            total_sent: "0",
            total_received: "0",
            principal: "",
            assetName: "",
            ticker: responseToken.ticker,
            decimals: 0,
            image: "",
            visible: true,
            supported: true,
            tokenFiatRate: null,
            protocol: "brc-20",
          }
          tokensList.push(token)
        })
        return tokensList
      } else {
        return []
      }
    })
    .catch((error) => {
      return [];
    });
}
