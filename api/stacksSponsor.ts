import { StacksTransactionWire } from '@stacks/transactions';
import axios, { AxiosResponse } from 'axios';
import { XVERSE_SPONSOR_URL } from '../constant';
import { SponsorInfoResponse, SponsorTransactionResponse } from '../types';
import { handleAxiosError } from './error';

/**
 * Return the sponsored signed transaction ID
 *
 * @param {StacksTransactionWire} signedTx
 * @param {string} [sponsorHost] - optional host for stacks-transaction-sponsor fork
 * @returns {Promise<string>}
 * @throws {ApiResponseError} - if api responded with an error status
 */
export async function sponsorTransaction(signedTx: StacksTransactionWire, sponsorHost?: string): Promise<string> {
  const url = `${sponsorHost ?? XVERSE_SPONSOR_URL}/v1/sponsor`;

  const data = {
    tx: signedTx.serialize().toString(),
  };

  return axios
    .post(url, data, { timeout: 45000 })
    .then((response: AxiosResponse<SponsorTransactionResponse>) => {
      return response.data.txid;
    })
    .catch(handleAxiosError);
}

/**
 * Get whether sponsor service is active
 *
 * @param {string} [sponsorHost] - optional host for stacks-transaction-sponsor fork
 * @returns {Promise<boolean>}
 * @throws {ApiResponseError} - if api responded with an error status
 */
export async function getSponsorInfo(sponsorHost?: string): Promise<boolean> {
  const url = `${sponsorHost ?? XVERSE_SPONSOR_URL}/v1/info`;

  return axios
    .get(url)
    .then((response: AxiosResponse<SponsorInfoResponse>) => {
      return response.data.active;
    })
    .catch(handleAxiosError);
}
