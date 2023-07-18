export enum ErrorCodes {
  InSufficientBalance = 600,
  InSufficientBalanceWithTxFee = 601,
  OrdinalUtxoNotfound = 700,
}

export class ResponseError extends Error {
  public statusCode: number;

  constructor(code: number) {
    super(code.toString());
    this.name = 'ResponseError';
    this.statusCode = code;
  }
}

/**
 * Error class where an API response was received
 */
export type ApiResponseErrorParams = {
  status: number;
  data: unknown;
  headers: Record<string,string>;
};
export class ApiResponseError extends Error implements ApiResponseErrorParams {
  public status;

  public data;

  public headers;

  constructor({status, data, headers}: ApiResponseErrorParams) {
    super(status.toString());
    this.name = 'ApiResponseError';
    this.status = status;
    this.data = data;
    this.headers = headers;
  }
}
