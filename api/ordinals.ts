import axios from 'axios';
import BitcoinEsploraApiProvider from '../api/esplora/esploraAPiProvider';
import { INSCRIPTION_REQUESTS_SERVICE_URL, ORDINALS_URL, XVERSE_API_BASE_URL, XVERSE_INSCRIBE_URL } from '../constant';
import {
  Account,
  Brc20HistoryTransactionData,
  BtcOrdinal,
  FungibleToken,
  HiroApiBrc20TxHistoryResponse,
  Inscription,
  InscriptionRequestResponse,
  NetworkType,
  UTXO,
  UtxoOrdinalBundle,
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
        const ordinalContentUrl = `${XVERSE_INSCRIBE_URL(network)}/v1/inscriptions/utxo/${utxo.txid}/${utxo.vout}`;

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

export async function getOrdinalIdsFromUtxo(network: NetworkType, utxo: UTXO): Promise<string[]> {
  const ordinalContentUrl = `${XVERSE_INSCRIBE_URL(network)}/v1/inscriptions/utxo/${utxo.txid}/${utxo.vout}`;

  const { data: ordinalIds } = await axios.get<string[]>(ordinalContentUrl);

  return ordinalIds;
}

export async function getOrdinalIdFromUtxo(network: NetworkType, utxo: UTXO) {
  const ordinalIds = await getOrdinalIdsFromUtxo(network, utxo);
  if (ordinalIds.length > 0) {
    return ordinalIds[ordinalIds.length - 1];
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
    const ordinalId = await getOrdinalIdFromUtxo(network, unspentOutputs[i]);
    if (!ordinalId) {
      nonOrdinalOutputs.push(unspentOutputs[i]);
    }
  }

  return nonOrdinalOutputs;
}

export async function getOrdinalsFtBalance(network: NetworkType, address: string): Promise<FungibleToken[]> {
  const url = `${XVERSE_API_BASE_URL(network)}/v1/ordinals/token/balances/${address}`;
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

export async function getBrc20History(
  network: NetworkType,
  address: string,
  token: string,
): Promise<Brc20HistoryTransactionData[]> {
  const url = `${XVERSE_API_BASE_URL(network)}/v1/ordinals/token/${token}/history/${address}`;
  return axios
    .get(url, {
      timeout: 30000,
    })
    .then((response) => {
      const data: HiroApiBrc20TxHistoryResponse = response.data;
      const transactions: Brc20HistoryTransactionData[] = [];
      data.results.forEach((tx) => {
        transactions.push(parseBrc20TransactionData(tx, address));
      });
      return transactions;
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

type AddressBundleResponse = {
  total: number;
  offset: number;
  limit: number;
  results: UtxoOrdinalBundle[];
};
export const getAddressUtxoOrdinalBundles = async (
  network: NetworkType,
  address: string,
  offset: number,
  limit: number,
  options?: {
    /** Filter out unconfirmed UTXOs */
    hideUnconfirmed?: boolean;
    /** Filter out UTXOs that only have one or more inscriptions (and no rare sats) */
    hideInscriptionOnly?: boolean;
  },
) => {
  const params: Record<string, unknown> = {
    offset,
    limit,
  };

  if (options?.hideUnconfirmed) {
    params.hideUnconfirmed = 'true';
  }
  if (options?.hideInscriptionOnly) {
    params.hideInscriptionOnly = 'true';
  }

  const response = await axios.get<AddressBundleResponse>(
    `${XVERSE_API_BASE_URL(network)}/v1/address/${address}/ordinal-utxo`,
    {
      params,
    },
  );

  return response.data;
};

export const getUtxoOrdinalBundle = async (
  network: NetworkType,
  txid: string,
  vout: number,
): Promise<UtxoOrdinalBundle> => {
  const response = await axios.get<UtxoOrdinalBundle>(
    `${XVERSE_API_BASE_URL(network)}/v1/ordinal-utxo/${txid}:${vout}`,
  );
  return response.data;
};
