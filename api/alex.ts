import axios, { AxiosResponse } from 'axios';
import { ALEX_SPONSOR_HOST } from '../constant';
import { handleAxiosError } from './error';

/**
 * Get whether alex sponsor service is active
 *
 * @returns {Promise<string>}
 * @throws {ApiResponseError} - if api responded with an error status
 */
export async function getAlexSponsorInfo(): Promise<string> {
  return axios
    .get(`${ALEX_SPONSOR_HOST}/healthz`)
    .then((response: AxiosResponse<string>) => {
      return response.data;
    })
    .catch(handleAxiosError);
}
