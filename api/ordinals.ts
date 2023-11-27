import axios from 'axios';
import BitcoinEsploraApiProvider from '../api/esplora/esploraAPiProvider';
import XordApiProvider from '../api/ordinals/provider';
import { INSCRIPTION_REQUESTS_SERVICE_URL, ORDINALS_URL, XVERSE_API_BASE_URL, XVERSE_INSCRIBE_URL } from '../constant';
import {
  Account,
  AddressBundleResponse,
  Brc20HistoryTransactionData,
  BtcOrdinal,
  FungibleToken,
  HiroApiBrc20TxHistoryResponse,
  Inscription,
  InscriptionRequestResponse,
  NetworkType,
  UTXO,
  UtxoBundleResponse,
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
  const xordClient = new XordApiProvider({
    network,
  });

  const [addressUTXOs, inscriptions] = await Promise.all([
    btcClient.getUnspentUtxos(btcAddress),
    xordClient.getAllInscriptions(btcAddress),
  ]);
  const ordinals: BtcOrdinal[] = [];

  const utxoMap = addressUTXOs.reduce((acc, utxo) => {
    acc[`${utxo.txid}:${utxo.vout}`] = utxo;
    return acc;
  }, {} as Record<string, UTXO>);

  inscriptions.forEach((inscription) => {
    const utxo = utxoMap[inscription.output];
    if (utxo) {
      ordinals.push({
        id: inscription.id,
        confirmationTime: utxo.status.block_time || 0,
        utxo,
      });
    }
  });

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

export async function getTextOrdinalContent(network: NetworkType, inscriptionId: string): Promise<string> {
  const url = ORDINALS_URL(network, inscriptionId);
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
    `${XVERSE_API_BASE_URL(network)}/v2/address/${address}/ordinal-utxo`,
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
): Promise<UtxoBundleResponse> => {
  const response = await axios.get<UtxoBundleResponse>(
    `${XVERSE_API_BASE_URL(network)}/v2/ordinal-utxo/${txid}:${vout}`,
  );
  return response.data;
};
