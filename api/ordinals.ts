import axios from 'axios';
import BitcoinEsploraApiProvider from '../api/esplora/esploraAPiProvider';
import { INSCRIPTION_REQUESTS_SERVICE_URL, ORDINALS_URL, XVERSE_API_BASE_URL, XVERSE_INSCRIBE_URL } from '../constant';
import {
  Account,
  Brc20HistoryTransactionData,
  BtcOrdinal,
  FungibleToken,
  Inscription,
  InscriptionRequestResponse,
  NetworkType,
  OrdinalTokenTransaction,
  UTXO,
} from '../types';
import { parseBrc20TransactionData } from './helper';

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

export async function fetchBtcOrdinalsData(btcAddress: string, network: NetworkType): Promise<BtcOrdinal[]> {
  const btcClient = new BitcoinEsploraApiProvider({
    network,
  });
  const addressUTXOs = await btcClient.getUnspentUtxos(btcAddress);
  const ordinals: BtcOrdinal[] = [];

  await Promise.all(
    addressUTXOs
      .filter((utxo) => utxo.status.confirmed) // we can only detect ordinals from confirmed utxos
      .map(async (utxo: UTXO) => {
        const ordinalContentUrl = `${XVERSE_INSCRIBE_URL}/v1/inscriptions/utxo/${utxo.txid}/${utxo.vout}`;

        const ordinalIds = await axios.get<string[]>(ordinalContentUrl);

        if (ordinalIds.data.length > 0) {
          ordinalIds.data.forEach((ordinalId) => {
            ordinals.push({
              id: ordinalId,
              confirmationTime: utxo.status.block_time || 0,
              utxo,
            });
          });
        }
      }),
  );

  return ordinals.sort(sortOrdinalsByConfirmationTime);
}

export async function getOrdinalIdFromUtxo(utxo: UTXO) {
  const ordinalContentUrl = `${XVERSE_INSCRIBE_URL}/v1/inscriptions/utxo/${utxo.txid}/${utxo.vout}`;

  const ordinalIds = await axios.get<string[]>(ordinalContentUrl);
  if (ordinalIds.data.length > 0) {
    return ordinalIds.data.at(-1);
  } else {
    return null;
  }
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

export async function getNonOrdinalUtxo(address: string, network: NetworkType): Promise<Array<UTXO>> {
  const btcClient = new BitcoinEsploraApiProvider({
    network,
  });
  const unspentOutputs = await btcClient.getUnspentUtxos(address);
  const nonOrdinalOutputs: Array<UTXO> = [];

  for (let i = 0; i < unspentOutputs.length; i++) {
    const ordinalId = await getOrdinalIdFromUtxo(unspentOutputs[i]);
    if (!ordinalId) {
      nonOrdinalOutputs.push(unspentOutputs[i]);
    }
  }

  return nonOrdinalOutputs;
}

export async function getOrdinalsFtBalance(address: string): Promise<FungibleToken[]> {
  const url = `${XVERSE_API_BASE_URL}/v1/ordinals/token/balances/${address}`;
  return axios
    .get(url, {
      timeout: 30000,
    })
    .then((response) => {
      if (response.data) {
        const responseTokensList = response!.data;
        const tokensList: Array<FungibleToken> = [];
        responseTokensList.forEach((responseToken: any) => {
          const token: FungibleToken = {
            name: responseToken.ticker,
            balance: responseToken.overallBalance,
            total_sent: '0',
            total_received: '0',
            principal: '',
            assetName: '',
            ticker: responseToken.ticker,
            decimals: 0,
            image: '',
            visible: true,
            supported: true,
            tokenFiatRate: null,
            protocol: responseToken.protocol,
          };
          tokensList.push(token);
        });
        return tokensList;
      } else {
        return [];
      }
    })
    .catch((error) => {
      return [];
    });
}

export async function getBrc20History(address: string, token: string): Promise<Brc20HistoryTransactionData[]> {
  const url = `${XVERSE_API_BASE_URL}/v1/ordinals/token/${token}/history/${address}`;
  return axios
    .get(url, {
      timeout: 30000,
    })
    .then((response) => {
      const data: OrdinalTokenTransaction[] = response.data;
      const transactions: Brc20HistoryTransactionData[] = [];
      data.forEach((tx) => {
        transactions.push(parseBrc20TransactionData(tx));
      });
      return transactions;
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
  amount: string,
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

export const isBrcTransferValid = (inscription: Inscription) => {
  const output: string = inscription.output.split(':')[0];
  return output === inscription.genesis_tx_id;
};

export const isOrdinalOwnedByAccount = (inscription: Inscription, account: Account) =>
  inscription.address === account.ordinalsAddress;
