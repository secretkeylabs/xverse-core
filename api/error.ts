import { AxiosError } from 'axios';
import { ApiResponseError } from '../types';

/**
 * Axios error handling helper for axios catch blocks
 *
 * @param {AxiosError} error
 * @throws {ApiResponseError} - if api responded with an error status
 * @throws {Error} - for all other errors
 */
export const handleAxiosError = (error: AxiosError) => {
  if (error.response) {
    throw new ApiResponseError({
      status: error.response.status,
      data: error.response.data,
      headers: error.response.headers,
    });
  }
  throw new Error(error.message);
};
