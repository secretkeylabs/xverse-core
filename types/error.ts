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
