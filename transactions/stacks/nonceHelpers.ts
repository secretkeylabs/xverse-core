import axios from 'axios';
import { LatestNonceResponse, StacksNetwork, StacksTransactionWire, StxMempoolTransactionData } from '../../types';

export async function getLatestNonce(stxAddress: string, network: StacksNetwork): Promise<LatestNonceResponse> {
  const baseUrl = network.client.baseUrl;
  const apiUrl = `${baseUrl}/extended/v1/address/${stxAddress}/nonces`;
  return axios.get<LatestNonceResponse>(apiUrl).then((response) => {
    return response.data;
  });
}

/**
 * Suggests the next best nonce, taking into account any missing nonces.
 */
export async function nextBestNonce(stxAddress: string, network: StacksNetwork): Promise<bigint> {
  const nonceData = await getLatestNonce(stxAddress, network);

  if (nonceData.detected_missing_nonces.length > 0) {
    return BigInt(nonceData.detected_missing_nonces.at(-1) as number);
  }

  return BigInt(nonceData.possible_next_nonce);
}

export function getNonce(transaction: StacksTransactionWire): bigint {
  return transaction.auth.spendingCondition?.nonce ?? BigInt(0);
}

export function getNewNonce(pendingTransactions: StxMempoolTransactionData[], currentNonce: bigint): bigint {
  if ((pendingTransactions ?? []).length === 0) {
    // handle case where account nonce is 0 and no pending transactions
    return currentNonce;
  }
  const maxPendingNonce = Math.max(...(pendingTransactions ?? []).map((transaction) => transaction?.nonce));
  if (maxPendingNonce >= currentNonce) {
    return BigInt(maxPendingNonce + 1);
  } else {
    return currentNonce;
  }
}
