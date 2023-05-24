import {
  NetworkType,
  BtcOrdinal,
  UTXO,
  FungibleToken,
  InscriptionRequestResponse,
  Inscription
} from '../types';
import axios from 'axios';
import { 
  ORDINALS_URL, 
  XVERSE_API_BASE_URL,
  ORDINALS_FT_INDEXER_API_URL,
  INSCRIPTION_REQUESTS_SERVICE_URL
} from '../constant';
import BitcoinEsploraApiProvider from '../api/esplora/esploraAPiProvider';

export function parseOrdinalTextContentData(content: string): string {
  try {
    const contentData = JSON.parse(content);
    if (contentData.p) {
      // check for sns protocol
      if (contentData.p === 'sns') {
        return contentData.hasOwnProperty('name') ? contentData.name : content;
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
        return await Promise.resolve(ordinal);
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
        return await Promise.resolve(ordinal.data.id);
      } else {
        return null;
      }
    } else {
      return null;
    }
  } catch (err) {}
}

export async function getTextOrdinalContent(inscriptionId: string): Promise<string> {
  const url = ORDINALS_URL(inscriptionId);
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
  const url = `${XVERSE_API_BASE_URL}/v1/ordinals/token/balances/${address}`;
  return axios
    .get(url, {
      timeout: 30000,
    })
    .then((response) => { 
      if(response.data) {
        const responseTokensList = response!.data;
        const tokensList: Array<FungibleToken> = [];
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
            protocol: responseToken.protocol,
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


export async function createInscriptionRequest(
  recipientAddress: string,
  size: number,
  totalFeeSats: number,
  fileBase64: string,
  tokenName: string,
  amount: string
): Promise<InscriptionRequestResponse> {
  const response = await axios.post(INSCRIPTION_REQUESTS_SERVICE_URL, {
    fee: totalFeeSats,
    files: [
      {
        dataURL: `data:plain/text;base64,${fileBase64}`,
        name: `${tokenName}-${amount}-1.txt`,
        size: size,
        type: 'plain/text',
        url: '',
      },
    ],
    lowPostage: true,
    receiveAddress: recipientAddress,
    referral: '',
  });
  return response.data;
}

export const isBrcTransferValid = (inscription: Inscription) => inscription.address === inscription.genesis_address