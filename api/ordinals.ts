import axios, { isAxiosError } from 'axios';
import EsploraApiProvider from '../api/esplora/esploraAPiProvider';
import { OrdinalsApi } from '../api/ordinals/provider';
import { INSCRIPTION_REQUESTS_SERVICE_URL, ORDINALS_URL, XVERSE_API_BASE_URL, XVERSE_INSCRIBE_URL } from '../constant';
import {
  Account,
  AddressBundleResponse,
  Brc20HistoryTransactionData,
  BtcOrdinal,
  Bundle,
  BundleSatRange,
  FungibleToken,
  HiroApiBrc20TxHistoryResponse,
  Inscription,
  InscriptionRequestResponse,
  NetworkType,
  RareSatsType,
  SatRangeInscription,
  UTXO,
  UtxoBundleResponse,
  UtxoOrdinalBundle,
  isApiSatributeKnown,
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

export async function fetchBtcOrdinalsData(
  btcAddress: string,
  esploraProvider: EsploraApiProvider,
  network: NetworkType,
): Promise<BtcOrdinal[]> {
  const xordClient = new OrdinalsApi({
    network,
  });

  const [addressUTXOs, inscriptions] = await Promise.all([
    esploraProvider.getUnspentUtxos(btcAddress),
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

export async function getNonOrdinalUtxo(
  address: string,
  esploraProvider: EsploraApiProvider,
  network: NetworkType,
): Promise<Array<UTXO>> {
  const unspentOutputs = await esploraProvider.getUnspentUtxos(address);
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
            principal: responseToken.ticker.toUpperCase(),
            assetName: '',
            ticker: responseToken.ticker.toUpperCase(),
            decimals: 0,
            image: '',
            // explicit undefined = unknown initial state,
            // consumers may then set it to true/false depending on the user's settings
            visible: undefined,
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

export const getUtxoOrdinalBundleIfFound = async (
  network: NetworkType,
  txid: string,
  vout: number,
): Promise<UtxoBundleResponse | undefined> => {
  try {
    const data = await getUtxoOrdinalBundle(network, txid, vout);
    return data;
  } catch (e) {
    // we don't reject on 404s because if the UTXO is not found,
    // it is likely this is a UTXO from an unpublished txn.
    // this is required for gamma.io purchase flow
    if (!isAxiosError(e) || e.response?.status !== 404) {
      // rethrow error if response was not 404
      throw e;
    }
    return undefined;
  }
};

export const mapRareSatsAPIResponseToBundle = (apiBundle: UtxoOrdinalBundle): Bundle => {
  const generalBundleInfo = {
    txid: apiBundle.txid,
    vout: apiBundle.vout,
    block_height: apiBundle.block_height,
    value: apiBundle.value,
  };

  const commonUnknownRange: BundleSatRange = {
    range: {
      start: '0',
      end: '0',
    },
    yearMined: 0,
    block: 0,
    offset: 0,
    satributes: ['COMMON'],
    inscriptions: [],
    totalSats: apiBundle.value,
  };

  // if bundle has empty sat ranges, it means that it's a common/unknown bundle
  if (!apiBundle.sat_ranges.length) {
    return {
      ...generalBundleInfo,
      satRanges: [commonUnknownRange],
      inscriptions: [],
      satributes: [['COMMON']],
      totalExoticSats: 0,
    };
  }

  let totalExoticSats = 0;
  let totalCommonUnknownInscribedSats = 0;
  const satRanges: BundleSatRange[] = [];

  apiBundle.sat_ranges.forEach((satRange) => {
    const { year_mined: yearMined, ...satRangeProps } = satRange;

    // filter out unsupported satributes
    // filter is not able to infer the type of the array, so we need to cast it
    const supportedSatributes = satRange.satributes.filter(isApiSatributeKnown);

    const rangeWithUnsupportedSatsAndWithoutInscriptions = !satRange.inscriptions.length && !supportedSatributes.length;
    // if range has no inscriptions and only unsupported satributes, we skip it
    if (rangeWithUnsupportedSatsAndWithoutInscriptions) {
      return;
    }

    // if range has inscribed sats of unsupported type or unknown, we map it to a common/unknown sat range
    const satributes = !supportedSatributes.length ? (['COMMON'] as RareSatsType[]) : supportedSatributes;

    const totalSats = Number(BigInt(satRange.range.end) - BigInt(satRange.range.start));

    if (satributes.includes('COMMON')) {
      totalCommonUnknownInscribedSats += totalSats;
    } else {
      totalExoticSats += totalSats;
    }

    const range = {
      ...satRangeProps,
      totalSats,
      yearMined,
      satributes,
    };

    satRanges.push(range);
  });

  // if totalExoticSatsAndCommonUnknownInscribedSats < apiBundle.value,
  // it means that the bundle has common/unknown sats and we need to add a common/unknown sat range
  const totalExoticSatsAndCommonUnknownInscribedSats = totalExoticSats + totalCommonUnknownInscribedSats;
  if (totalExoticSatsAndCommonUnknownInscribedSats < apiBundle.value) {
    satRanges.push({
      ...commonUnknownRange,
      totalSats: apiBundle.value - totalExoticSatsAndCommonUnknownInscribedSats,
    });
  }

  const inscriptions = satRanges.reduce((acc, curr) => [...acc, ...curr.inscriptions], [] as SatRangeInscription[]);
  const satributes = satRanges.reduce((acc, curr) => [...acc, curr.satributes], [] as RareSatsType[][]);

  return {
    ...generalBundleInfo,
    satRanges,
    inscriptions,
    satributes,
    totalExoticSats,
  };
};
