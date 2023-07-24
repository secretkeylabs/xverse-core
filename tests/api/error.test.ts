import { describe, expect, it } from 'vitest';
import { AxiosError, AxiosResponse } from 'axios';
import { ApiResponseError } from '../../types';
import { handleAxiosError } from '../../api/error';

describe('handleAxiosError', () => {
  it('throws ApiResponseError when response found', () => {
    expect(async () =>
      handleAxiosError(
        new AxiosError(undefined, undefined, undefined, undefined, {
          status: 400,
          data: {},
          headers: {},
        } as AxiosResponse),
      ),
    ).rejects.toThrow(ApiResponseError);
  });

  it('throws Error when no response found', () => {
    expect(async () => handleAxiosError(new AxiosError())).rejects.toThrow(Error);
  });
});
