import axios, { AxiosResponse } from 'axios';
import { AlexSupportedToken } from 'types/api/alex';
import { ALEX_TOKEN_LIST_HOST } from '../constant';
import { handleAxiosError } from './error';

/**
 * Get alex lab token list
 *
 * @returns {Promise<AlexSupportedToken[]>}
 * @throws {ApiResponseError} - if api responded with an error status
 */
export async function getAlexTokenList(): Promise<AlexSupportedToken[]> {
  return axios
    .get(ALEX_TOKEN_LIST_HOST)
    .then((response: AxiosResponse<AlexSupportedToken[]>) => {
      return response.data;
    })
    .catch(handleAxiosError);
}
